/**
 * Agent Runner — wraps Claude Agent SDK query() for AgentCore invocations.
 *
 * Yields AgentEvent objects that get serialized as SSE `data:` lines.
 *
 * S3 sync strategy (replaces file-watcher.ts):
 *   - PostToolUse hook (Write|Edit): incremental sync of modified file to S3
 *   - Stop hook: full diff sync to S3 as safety net
 */

import * as claudeAgentSdk from '@anthropic-ai/claude-agent-sdk';
import { context } from '@opentelemetry/api';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { syncWorkspaceToS3 } from './workspace-sync.js';
import fs from 'fs';
import { execSync } from 'child_process';
import type { AgentPayload, AgentEvent, ContentBlock } from './types.js';
import { beginInvocation, instrumentClaudeAgentSdk, parentContextFromHeaders, type Invocation } from './otel.js';

// Patch the SDK once at module load with the official OpenInference
// instrumentation, which produces the AGENT/TOOL spans AgentCore Evaluations
// reads. The SDK is native ESM, so its namespace exports cannot be reassigned:
// `manuallyInstrument` returns a patched COPY and we must call query() through
// that copy — importing `query` directly would bypass instrumentation entirely.
// Falls back to the unpatched namespace when observability is off.
const { query } = instrumentClaudeAgentSdk(claudeAgentSdk);

const DEFAULT_TOOLS = [
  'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
  'WebSearch', 'WebFetch', 'Task', 'Skill',
  'TodoWrite', 'ToolSearch', 'NotebookEdit',
];

const s3 = new S3Client({ region: process.env.WORKSPACE_S3_REGION ?? 'us-east-1' });

// ---------------------------------------------------------------------------
// SDK Hooks for S3 sync (replaces file-watcher.ts)
// ---------------------------------------------------------------------------

/**
 * PostToolUse hook: after agent writes/edits a file, sync that single file to S3.
 * The hook input contains tool_input.file_path with the exact file modified.
 */
function createFileChangeHook(bucket: string, prefix: string) {
  return async (input: any, _toolUseId: string | undefined) => {
    const filePath: string | undefined = input?.tool_input?.file_path
      ?? input?.tool_input?.path;

    if (!filePath || !filePath.startsWith('/workspace/')) return {};

    const relativePath = filePath.replace('/workspace/', '');

    // Skip auto-generated directories that should never be synced to S3
    const firstSegment = relativePath.split('/')[0];
    const SKIP_PREFIXES = new Set([
      'node_modules', '.git', '__pycache__', '.venv', 'venv',
      '.next', '.nuxt', '.turbo', '.cache', '.parcel-cache',
      'bower_components', '.gradle', 'target', '.cargo',
    ]);
    if (SKIP_PREFIXES.has(firstSegment)) return {};

    const key = `${prefix}${relativePath}`;

    try {
      if (!fs.existsSync(filePath)) return {}; // file was deleted by the tool
      const content = fs.readFileSync(filePath);
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentLength: content.length,
      }));
      console.log(`[hook:PostToolUse] Synced ${relativePath} → s3://${bucket}/${key}`);
    } catch (err) {
      console.warn(`[hook:PostToolUse] Failed to sync ${relativePath}:`, err);
    }

    return {};
  };
}

/**
 * Stop hook: after agent finishes, do a full workspace sync to S3.
 * Catches files created by Bash tool or other indirect means.
 * Also extracts git diff and uploads it as __diff__.json.
 */
function createStopHook(bucket: string, prefix: string) {
  return async () => {
    // Fire-and-forget: run diff extraction + full S3 sync in the background
    // so the agent result is returned immediately without waiting for sync.
    // PostToolUse hooks already handle incremental file sync for Write/Edit,
    // and the frontend reads files directly from the container while it's alive.
    // This full sync is just a safety net for files created via Bash or other
    // indirect means.
    (async () => {
      try {
        extractAndUploadDiff(bucket, prefix);
      } catch (err) {
        console.warn('[hook:Stop] Diff extraction failed:', err);
      }

      try {
        const count = await syncWorkspaceToS3(s3, bucket, prefix);
        if (count > 0) {
          console.log(`[hook:Stop] Final sync: ${count} files → s3://${bucket}/${prefix}`);
        }
      } catch (err) {
        console.warn('[hook:Stop] Final sync failed:', err);
      }
    })();

    return {};
  };
}

// ---------------------------------------------------------------------------
// Git baseline & diff extraction
// ---------------------------------------------------------------------------

const WORKSPACE_DIR = '/workspace';

/**
 * Create a git baseline snapshot of the current workspace state.
 * Called BEFORE the agent runs so we can diff against it later.
 */
export function createGitBaseline(): boolean {
  try {
    // Check if git is available
    execSync('which git', { stdio: 'ignore' });
  } catch {
    console.warn('[git-diff] git not available in container, skipping baseline');
    return false;
  }

  try {
    // Configure git (required for commit)
    execSync('git config user.email "agent@superagent.local"', { cwd: WORKSPACE_DIR, stdio: 'ignore' });
    execSync('git config user.name "Agent"', { cwd: WORKSPACE_DIR, stdio: 'ignore' });

    // Init repo if not already (idempotent)
    execSync('git init', { cwd: WORKSPACE_DIR, stdio: 'ignore' });

    // Stage everything and commit as baseline
    execSync('git add -A', { cwd: WORKSPACE_DIR, stdio: 'ignore' });

    // Check if there's anything to commit
    try {
      execSync('git diff --cached --quiet', { cwd: WORKSPACE_DIR, stdio: 'ignore' });
      // No changes staged — either empty workspace or already committed
      // Try committing anyway (might be initial commit)
      try {
        execSync('git commit -m "baseline" --allow-empty', { cwd: WORKSPACE_DIR, stdio: 'ignore' });
      } catch { /* already committed, fine */ }
    } catch {
      // There are staged changes, commit them
      execSync('git commit -m "baseline"', { cwd: WORKSPACE_DIR, stdio: 'ignore' });
    }

    console.log('[git-diff] Baseline snapshot created');
    return true;
  } catch (err) {
    console.warn('[git-diff] Failed to create baseline:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Extract diff between baseline and current state, upload as __diff__.json to S3.
 */
function extractAndUploadDiff(bucket: string, prefix: string): void {
  // Check if git repo exists
  if (!fs.existsSync(`${WORKSPACE_DIR}/.git`)) {
    console.log('[git-diff] No git repo found, skipping diff extraction');
    return;
  }

  try {
    // Stage all current changes
    execSync('git add -A', { cwd: WORKSPACE_DIR, stdio: 'ignore' });

    // Get diff stat (structured)
    let diffStatOutput = '';
    try {
      diffStatOutput = execSync('git diff --cached --numstat HEAD', {
        cwd: WORKSPACE_DIR,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      }).trim();
    } catch { /* no changes */ }

    if (!diffStatOutput) {
      console.log('[git-diff] No changes detected');
      return;
    }

    // Parse numstat: "insertions\tdeletions\tfilepath"
    const files: Array<{ path: string; status: string; insertions: number; deletions: number }> = [];
    for (const line of diffStatOutput.split('\n')) {
      if (!line.trim()) continue;
      const [ins, del, filePath] = line.split('\t');
      // Binary files show as "-\t-\tfilepath"
      const insertions = ins === '-' ? 0 : parseInt(ins, 10) || 0;
      const deletions = del === '-' ? 0 : parseInt(del, 10) || 0;
      files.push({ path: filePath, status: 'modified', insertions, deletions });
    }

    // Get name-status to determine add/modify/delete
    let nameStatusOutput = '';
    try {
      nameStatusOutput = execSync('git diff --cached --name-status HEAD', {
        cwd: WORKSPACE_DIR,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      }).trim();
    } catch { /* ignore */ }

    const statusMap = new Map<string, string>();
    for (const line of nameStatusOutput.split('\n')) {
      if (!line.trim()) continue;
      const [status, ...pathParts] = line.split('\t');
      const filePath = pathParts.join('\t'); // handle paths with tabs (unlikely but safe)
      const statusLabel = status.startsWith('A') ? 'added'
        : status.startsWith('D') ? 'deleted'
        : status.startsWith('R') ? 'renamed'
        : 'modified';
      statusMap.set(filePath, statusLabel);
    }

    // Merge status into files
    for (const f of files) {
      f.status = statusMap.get(f.path) ?? f.status;
    }

    const totalInsertions = files.reduce((sum, f) => sum + f.insertions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

    const diffStat = {
      files_changed: files.length,
      insertions: totalInsertions,
      deletions: totalDeletions,
      files,
    };

    // Get full unified diff (capped at 1MB to avoid huge diffs)
    let diffPatch = '';
    try {
      diffPatch = execSync('git diff --cached HEAD', {
        cwd: WORKSPACE_DIR,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch { /* ignore if too large */ }

    // Cap patch size at 1MB
    if (diffPatch.length > 1024 * 1024) {
      diffPatch = diffPatch.substring(0, 1024 * 1024) + '\n\n... (diff truncated, exceeded 1MB)';
    }

    const diffData = {
      diff_stat: diffStat,
      diff_patch: diffPatch,
      created_at: new Date().toISOString(),
    };

    // Upload to S3 as __diff__.json
    const key = `${prefix}__diff__.json`;
    s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(diffData),
      ContentType: 'application/json',
    })).then(() => {
      console.log(`[git-diff] Uploaded diff (${files.length} files, +${totalInsertions}/-${totalDeletions}) → s3://${bucket}/${key}`);
    }).catch(err => {
      console.warn('[git-diff] Failed to upload diff to S3:', err);
    });

  } catch (err) {
    console.warn('[git-diff] Diff extraction failed:', err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------
// Agent execution
// ---------------------------------------------------------------------------

export async function* runAgent(
  payload: AgentPayload,
  requestHeaders?: Record<string, unknown>,
): AsyncGenerator<AgentEvent> {
  // One OTEL invocation scope per turn. The AGENT span itself is started by the
  // OpenInference instrumentation when the SDK stream is first iterated; this
  // only establishes the Context that carries the session id + raw user turn.
  // Session correlation uses the AgentCore session id (chat_session_id /
  // session_id from the backend). If the platform forwarded a trace context
  // (traceparent / X-Amzn-Trace-Id), the AGENT span is parented on it so the
  // platform's AgentCore.Runtime.Invoke span and ours form ONE connected trace
  // (the console groups a session's work this way) instead of two roots.
  const otelSessionId = payload.chat_session_id ?? payload.session_id ?? 'unknown-session';
  const parentCtx = parentContextFromHeaders(requestHeaders);
  const inv = beginInvocation(otelSessionId, payload.prompt, parentCtx);

  const baseOptions: Record<string, unknown> = {
    systemPrompt: payload.system_prompt ?? undefined,
    allowedTools: payload.allowed_tools ?? DEFAULT_TOOLS,
    cwd: '/workspace',
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    settingSources: ['project'],
  };

  // Dynamic model override: pass directly to SDK options so it takes effect
  // per-invocation (env var approach only works for the first call in a session).
  if (payload.model) {
    baseOptions.model = payload.model;
    console.log(`[agent-runner] Model override via options: ${payload.model}`);
  }

  // Per-invocation provider routing via SDK options.env (defaults to process.env).
  // litellm → point the SDK at an Anthropic-compatible gateway; bedrock → the
  // container's default Bedrock config. Never log the api_key.
  const provider = payload.provider ?? 'bedrock';
  if (provider === 'litellm') {
    // Drive the CLI with the `opus` alias and remap that alias to the gateway's
    // actual model id — the CLI rewrites its built-in aliases to canonical
    // Anthropic ids that a custom gateway may reject.
    const gatewayModel = payload.model;
    const env = { ...process.env } as Record<string, string | undefined>;
    if (payload.base_url) env.ANTHROPIC_BASE_URL = payload.base_url;
    if (payload.api_key) { env.ANTHROPIC_AUTH_TOKEN = payload.api_key; env.ANTHROPIC_API_KEY = payload.api_key; }
    if (gatewayModel) {
      env.ANTHROPIC_MODEL = 'opus';
      env.ANTHROPIC_DEFAULT_OPUS_MODEL = gatewayModel;
      env.ANTHROPIC_DEFAULT_SONNET_MODEL = gatewayModel;
      env.ANTHROPIC_DEFAULT_HAIKU_MODEL = gatewayModel;
      env.ANTHROPIC_SMALL_FAST_MODEL = gatewayModel;
      baseOptions.model = 'opus';
    }
    // Use gateway auth only — no Bedrock, no stored OAuth session.
    delete env.CLAUDE_CODE_USE_BEDROCK;
    delete env.CLAUDE_CODE_OAUTH_TOKEN;
    delete env.AWS_ACCESS_KEY_ID;
    delete env.AWS_SECRET_ACCESS_KEY;
    delete env.AWS_PROFILE;
    baseOptions.env = env;
    baseOptions.settingSources = ['project'];
    console.log(`[agent-runner] Provider=litellm base_url=${payload.base_url ?? '(none)'} model=${gatewayModel ?? '(none)'}`);
  } else {
    baseOptions.env = {
      ...process.env,
      CLAUDE_CODE_USE_BEDROCK: '1',
      ...(payload.model ? { ANTHROPIC_MODEL: payload.model } : {}),
    };
    delete (baseOptions.env as Record<string, string | undefined>).ANTHROPIC_BASE_URL;
    delete (baseOptions.env as Record<string, string | undefined>).ANTHROPIC_AUTH_TOKEN;
    console.log(`[agent-runner] Provider=bedrock model=${payload.model ?? '(default)'}`);
  }

  if (payload.mcp_servers && Object.keys(payload.mcp_servers).length > 0) {
    baseOptions.mcpServers = payload.mcp_servers;
  }

  // Register our S3-sync hooks. Tool TRACING hooks are no longer registered
  // here: the OpenInference instrumentation injects its own PreToolUse /
  // PostToolUse / PostToolUseFailure matchers into these same options, and its
  // `mergeHooks` is ADDITIVE (`[...existing, ...ours]` per event), so the hooks
  // below survive untouched. Its hooks give us what ours could not: TOOL spans
  // that close with ERROR status + a recorded exception when a tool fails.
  const bucket = payload.workspace_s3_bucket;
  const prefix = payload.workspace_s3_prefix;
  const hooks: Record<string, unknown[]> = {};
  if (bucket && prefix) {
    hooks.PostToolUse = [{ matcher: 'Write|Edit', hooks: [createFileChangeHook(bucket, prefix)] }];
    hooks.Stop = [{ hooks: [createStopHook(bucket, prefix)] }];
    baseOptions.hooks = hooks;
    console.log('[agent-runner] Hooks registered (s3sync=true)');
  }

  // Conversation continuity comes from history injection (buildContextualPrompt
  // replays payload.history), NOT Claude Code's native `resume`. We deliberately
  // do NOT attempt resume first: AgentCore microVMs are frequently recycled
  // between turns, so `resume: <session_id>` almost always fails with "Claude
  // Code process exited with code 1", and the old try/resume-then-fallback path
  // (a) wasted a full failed invocation per turn and (b) polluted telemetry —
  // the failed run closed the single root span first, so the successful
  // fallback's real token usage never landed on it (it showed 0 every multi-turn
  // turn). History injection is one clean run: one AGENT span with the correct
  // model + token totals. See git history for the resume path if native session
  // continuity is ever needed again.
  //
  // Note the SDK sees the history-replay prompt while the AGENT span's
  // `input.value` reports only the raw user turn (pinned in otel.ts) — that is
  // what evaluators should judge.
  const prompt = buildContextualPrompt(payload);
  yield* runWithOptions(inv, prompt, baseOptions);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function* runWithOptions(
  inv: Invocation,
  prompt: string,
  options: Record<string, unknown>,
): AsyncGenerator<AgentEvent> {
  // Enter the invocation context for BOTH `query()` and the iterator's creation:
  // the instrumentation captures `context.active()` at each of those points —
  // once for the parent of the AGENT span (and our pinned session id), once for
  // the parent of the tool spans. An implicit `for await` would call
  // [Symbol.asyncIterator]() outside the context, so take the iterator by hand.
  const iterator = context.with(inv.ctx, () => {
    const stream = query({ prompt, options }) as AsyncIterable<unknown>;
    return stream[Symbol.asyncIterator]();
  });

  // Mirrors `for await`: always release the underlying stream if the consumer
  // stops early or throws, so the instrumentation closes the AGENT span and any
  // in-flight TOOL spans instead of leaking them.
  let exhausted = false;
  try {
    for (;;) {
      const step = await iterator.next();
      if (step.done) { exhausted = true; break; }
      const msg = step.value as Record<string, unknown>;

      if (msg.type === 'system' && msg.subtype === 'init') {
        yield {
          type: 'session_start',
          session_id: msg.session_id as string,
        };
        continue;
      }

      if (msg.type === 'assistant') {
        const rawContent = (msg.message as Record<string, unknown>)?.content;
        const model = (msg.message as Record<string, unknown>)?.model as string | undefined;
        const blocks = Array.isArray(rawContent)
          ? rawContent.map(mapContentBlock)
          : [];
        yield {
          type: 'assistant',
          content: blocks,
          session_id: msg.session_id as string | undefined,
          model,
        };
        continue;
      }

      if (msg.type === 'result') {
        const resultMsg = msg as Record<string, unknown>;
        // Extract token usage from SDK result message
        const usage = resultMsg.usage as Record<string, number> | undefined;
        const modelUsage = resultMsg.modelUsage as Record<string, Record<string, number>> | undefined;
        let tokenUsage: import('./types.js').TokenUsage | undefined;

        if (usage) {
          tokenUsage = {
            input_tokens: usage.input_tokens ?? 0,
            output_tokens: usage.output_tokens ?? 0,
            cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
            total_cost_usd: (resultMsg.total_cost_usd as number) ?? 0,
          };
        } else if (modelUsage) {
          // Aggregate from per-model usage
          let inputTokens = 0, outputTokens = 0, cacheRead = 0, cacheCreation = 0, cost = 0;
          for (const mu of Object.values(modelUsage)) {
            inputTokens += mu.inputTokens ?? 0;
            outputTokens += mu.outputTokens ?? 0;
            cacheRead += mu.cacheReadInputTokens ?? 0;
            cacheCreation += mu.cacheCreationInputTokens ?? 0;
            cost += mu.costUSD ?? 0;
          }
          tokenUsage = {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cache_read_input_tokens: cacheRead,
            cache_creation_input_tokens: cacheCreation,
            total_cost_usd: cost,
          };
        }

        // Stamp the counters the instrumentation does not read (cache tokens +
        // the gen_ai.usage.* mirrors) NOW: the AGENT span is still open on the
        // result message and the library ends it on the next `next()`.
        inv.finalize({ numTurns: msg.num_turns as number | undefined, tokenUsage });

        yield {
          type: 'result',
          session_id: msg.session_id as string | undefined,
          duration_ms: msg.duration_ms as number | undefined,
          num_turns: msg.num_turns as number | undefined,
          is_error: msg.is_error as boolean | undefined,
          result: msg.result as string | undefined,
          token_usage: tokenUsage,
        };
        continue;
      }
    }
  } finally {
    // On early exit (consumer break / error), tell the SDK stream we're done.
    // The instrumentation's return() ends the AGENT span + in-flight TOOL spans.
    if (!exhausted) {
      try { await iterator.return?.(undefined); } catch { /* best effort */ }
    }
  }
}

function buildContextualPrompt(payload: AgentPayload): string {
  const userMessage = payload.prompt;
  const history = payload.history;

  if (!history || history.length === 0) {
    return userMessage;
  }

  const contextParts = history.map(msg =>
    msg.role === 'user' ? `User: ${msg.content}` : `Assistant: ${msg.content}`,
  );

  return (
    `Here is our conversation so far:\n\n${contextParts.join('\n\n')}\n\n` +
    `Now the user says:\n${userMessage}\n\n` +
    `Please respond based on the full conversation context above.`
  );
}

function mapContentBlock(block: Record<string, unknown>): ContentBlock {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text as string };
    case 'tool_use':
      return {
        type: 'tool_use',
        id: block.id as string,
        name: block.name as string,
        input: block.input,
      };
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: block.tool_use_id as string,
        content: block.content as string | undefined,
        is_error: block.is_error as boolean | undefined,
      };
    default:
      return block as unknown as ContentBlock;
  }
}
