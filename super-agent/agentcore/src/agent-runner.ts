/**
 * Agent Runner — wraps Claude Agent SDK query() for AgentCore invocations.
 *
 * Yields AgentEvent objects that get serialized as SSE `data:` lines.
 *
 * S3 sync strategy (replaces file-watcher.ts):
 *   - PostToolUse hook (Write|Edit): incremental sync of modified file to S3
 *   - Stop hook: full diff sync to S3 as safety net
 */

import { query } from '@anthropic-ai/claude-agent-sdk'; 
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { syncWorkspaceToS3 } from './workspace-sync.js';
import fs from 'fs';
import type { AgentPayload, AgentEvent, ContentBlock } from './types.js';

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
 */
function createStopHook(bucket: string, prefix: string) {
  return async () => {
    try {
      const count = await syncWorkspaceToS3(s3, bucket, prefix);
      if (count > 0) {
        console.log(`[hook:Stop] Final sync: ${count} files → s3://${bucket}/${prefix}`);
      }
    } catch (err) {
      console.warn('[hook:Stop] Final sync failed:', err);
    }
    return {};
  };
}

// ---------------------------------------------------------------------------
// Agent execution
// ---------------------------------------------------------------------------

export async function* runAgent(payload: AgentPayload): AsyncGenerator<AgentEvent> {
  const baseOptions: Record<string, unknown> = {
    systemPrompt: payload.system_prompt ?? undefined,
    allowedTools: payload.allowed_tools ?? DEFAULT_TOOLS,
    cwd: '/workspace',
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    settingSources: ['project'],
  };

  if (payload.mcp_servers && Object.keys(payload.mcp_servers).length > 0) {
    baseOptions.mcpServers = payload.mcp_servers;
  }

  // Register S3 sync hooks (replaces file-watcher)
  const bucket = payload.workspace_s3_bucket;
  const prefix = payload.workspace_s3_prefix;
  if (bucket && prefix) {
    baseOptions.hooks = {
      PostToolUse: [
        {
          matcher: 'Write|Edit',
          hooks: [createFileChangeHook(bucket, prefix)],
        },
      ],
      Stop: [
        {
          hooks: [createStopHook(bucket, prefix)],
        },
      ],
    };
    console.log(`[agent-runner] S3 sync hooks registered for s3://${bucket}/${prefix}`);
  }

  // Strategy: try Claude Code session resume first (fast, native history).
  // If resume fails (microVM was recycled), fallback to history-injected prompt.
  if (payload.session_id) {
    try {
      yield* runWithOptions(payload.prompt, { ...baseOptions, resume: payload.session_id });
      return;
    } catch (err) {
      console.log(`[agent-runner] Session resume failed (${err}), falling back to history injection`);
    }
  }

  const prompt = buildContextualPrompt(payload);
  yield* runWithOptions(prompt, baseOptions);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function* runWithOptions(
  prompt: string,
  options: Record<string, unknown>,
): AsyncGenerator<AgentEvent> {
  for await (const message of query({ prompt, options })) {
    const msg = message as Record<string, unknown>;

    if (msg.type === 'system' && msg.subtype === 'init') {
      yield {
        type: 'session_start',
        session_id: msg.session_id as string,
      };
      continue;
    }

    if (msg.type === 'assistant') {
      const rawContent = (msg.message as Record<string, unknown>)?.content;
      const blocks = Array.isArray(rawContent)
        ? rawContent.map(mapContentBlock)
        : [];
      yield {
        type: 'assistant',
        content: blocks,
        session_id: msg.session_id as string | undefined,
      };
      continue;
    }

    if (msg.type === 'result') {
      yield {
        type: 'result',
        session_id: msg.session_id as string | undefined,
        duration_ms: msg.duration_ms as number | undefined,
        num_turns: msg.num_turns as number | undefined,
        is_error: msg.is_error as boolean | undefined,
        result: msg.result as string | undefined,
      };
      continue;
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
