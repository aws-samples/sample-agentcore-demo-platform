/**
 * AgentCore Agent Runtime — runs Claude Agent SDK inside Bedrock AgentCore
 * containers with a single shared runtime ARN.
 *
 * Before invoking AgentCore, the backend prepares the workspace (skills,
 * Claude config, agent files) and uploads it to S3. The container then
 * pulls everything from S3 — no need to call back to the backend API.
 *
 * Required env var:
 *   AGENTCORE_RUNTIME_ARN — the single runtime ARN to invoke
 */

import { config } from '../config/index.js';
import type { AgentRuntime, AgentRuntimeOptions } from './agent-runtime.js';
import type { ConversationEvent, AgentConfig, ContentBlock, MCPServerSDKConfig } from './claude-agent.service.js';
import type { SkillForWorkspace } from './workspace-manager.js';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, statSync, createWriteStream } from 'fs';
import { readdir, mkdir } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { pipeline } from 'stream/promises';

interface AgentCoreEvent {
  type: 'session_start' | 'assistant' | 'result' | 'error';
  session_id?: string;
  content?: Array<{
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
    tool_use_id?: string;
    content?: string;
    is_error?: boolean;
  }>;
  code?: string;
  message?: string;
  duration_ms?: number;
  num_turns?: number;
  is_error?: boolean;
  result?: string;
}

export class AgentCoreAgentRuntime implements AgentRuntime {
  readonly name = 'agentcore';

  private runtimeClient: any;
  private InvokeCommand: any;
  private sdkLoaded = false;
  private s3Client: S3Client;
  private readonly workspaceBucket: string;

  constructor() {
    this.s3Client = new S3Client({ region: config.aws.region });
    this.workspaceBucket = config.agentcore.workspaceS3Bucket;
  }

  private async ensureSDK(): Promise<void> {
    if (this.sdkLoaded) return;
    try {
      const mod = await import('@aws-sdk/client-bedrock-agentcore' as string);
      // Extract region from the runtime ARN (arn:aws:bedrock-agentcore:{region}:...)
      // to ensure the client targets the correct region regardless of AWS_REGION.
      const arnRegion = config.agentcore.runtimeArn?.split(':')[3];
      const region = arnRegion || config.agentcore.region;
      console.log(`[agentcore-runtime] SDK region=${region} (from ARN: ${arnRegion}, config: ${config.agentcore.region})`);
      this.runtimeClient = new mod.BedrockAgentCoreClient({ region });
      this.InvokeCommand = mod.InvokeAgentRuntimeCommand;
      this.sdkLoaded = true;
    } catch (err) {
      throw new Error(`AgentCore SDK not available. Install @aws-sdk/client-bedrock-agentcore. Error: ${err}`);
    }
  }

  private get runtimeArn(): string {
    const arn = config.agentcore.runtimeArn;
    if (!arn) throw new Error('AGENTCORE_RUNTIME_ARN is not configured');
    return arn;
  }

  async *runConversation(
    options: AgentRuntimeOptions,
    agentConfig: AgentConfig,
    _skills: SkillForWorkspace[],
    _pluginPaths?: string[],
    mcpServers?: Record<string, MCPServerSDKConfig>,
  ): AsyncGenerator<ConversationEvent> {
    await this.ensureSDK();

    // --- Upload the locally-prepared workspace to S3 ---
    // chat.service already called ensureSessionWorkspace() which created the
    // full workspace (skills, agents, CLAUDE.md, settings.json) at the local
    // workspacePath. We upload that entire directory to S3 so the container
    // can pull it without calling back to the backend.
    const chatSessionId = options.sessionId;
    const scopeId = options.scopeId ?? 'default';
    const s3Prefix = `${options.organizationId}/${scopeId}/${chatSessionId ?? 'ephemeral'}/`;

    if (chatSessionId && options.workspacePath) {
      try {
        const count = await this.uploadDirToS3(options.workspacePath, s3Prefix);
        console.log(`[agentcore-runtime] Uploaded ${count} files to s3://${this.workspaceBucket}/${s3Prefix}`);
      } catch (err) {
        console.warn('[agentcore-runtime] Failed to upload workspace to S3:', err);
      }
    }

    // Load recent chat history from DB — used as fallback when Claude Code
    // session resume fails (microVM recycled after idle timeout / max lifetime).
    const history = await this.loadChatHistory(options.organizationId, options.sessionId);

    const payload = JSON.stringify({
      prompt: options.message,
      session_id: options.providerSessionId ?? undefined,
      chat_session_id: chatSessionId ?? undefined,
      history: history.length > 0 ? history : undefined,
      scope_id: scopeId,
      org_id: options.organizationId,
      agent_id: options.agentId,
      system_prompt: agentConfig.systemPrompt ?? undefined,
      mcp_servers: mcpServers && Object.keys(mcpServers).length > 0 ? mcpServers : undefined,
      workspace_s3_bucket: this.workspaceBucket,
      workspace_s3_prefix: s3Prefix,
    });

    console.log(`[agentcore-runtime] S3 workspace: s3://${this.workspaceBucket}/${s3Prefix}`);
    console.log(`[agentcore-runtime] History count: ${history.length}, workspacePath: ${options.workspacePath ?? 'none'}`);

    // Use the chat session ID as runtimeSessionId so the same conversation
    // always routes to the same AgentCore microVM. This keeps Claude Code's
    // session data (~/.claude/projects/) alive between invocations.
    // Falls back to org_user if no chat session ID is available.
    const rawSessionId = options.sessionId
      ?? `${options.organizationId}_${options.userId}`;
    const sessionId = rawSessionId.length >= 33
      ? rawSessionId
      : rawSessionId.padEnd(33, '_');

    console.log(`[agentcore-runtime] Invoking session=${sessionId} agent=${agentConfig.id}`);
    console.log(`[agentcore-runtime] runtimeArn=${this.runtimeArn}`);
    console.log(`[agentcore-runtime] client class=${this.runtimeClient?.constructor?.name}`);
    console.log(`[agentcore-runtime] command class=${this.InvokeCommand?.name}`);

    const commandInput = {
      agentRuntimeArn: this.runtimeArn,
      runtimeSessionId: sessionId,
      payload,
      qualifier: 'DEFAULT',
    };
    console.log(`[agentcore-runtime] command input:`, JSON.stringify({ ...commandInput, payload: '(omitted)' }));

    let response: any;
    try {
      response = await this.runtimeClient.send(new this.InvokeCommand(commandInput));
      console.log(`[agentcore-runtime] response status=${response.$metadata?.httpStatusCode}`);
    } catch (err: any) {
      console.error(`[agentcore-runtime] INVOKE ERROR:`);
      console.error(`[agentcore-runtime]   name=${err?.name}`);
      console.error(`[agentcore-runtime]   message=${err?.message}`);
      console.error(`[agentcore-runtime]   code=${err?.$metadata?.httpStatusCode}`);
      console.error(`[agentcore-runtime]   requestId=${err?.$metadata?.requestId}`);
      console.error(`[agentcore-runtime]   stack=${err?.stack?.split('\n').slice(0, 5).join('\n')}`);
      yield {
        type: 'error',
        code: 'AGENTCORE_INVOKE_ERROR',
        message: `Failed to invoke AgentCore: ${err instanceof Error ? err.message : String(err)}`,
        suggestedAction: 'Check AGENTCORE_RUNTIME_ARN and IAM permissions',
      };
      return;
    }

    const contentType: string = response.contentType ?? '';
    if (contentType.includes('text/event-stream')) {
      yield* this.parseSSEStream(response.response);
    } else {
      const body = await this.readBody(response.response);
      try {
        yield this.mapEvent(JSON.parse(body));
      } catch {
        yield { type: 'error', code: 'PARSE_ERROR', message: `Failed to parse response: ${body.slice(0, 200)}` };
      }
    }

    // --- S3 sync-back disabled: local workspace is read-only cache, not critical ---
    // if (options.workspacePath) { ... }
  }

  async disconnectSession(_sessionId: string): Promise<void> { /* managed by AgentCore */ }
  async disconnectAll(): Promise<number> { return 0; }
  get activeSessionCount(): number { return 0; }
  hasSession(_sessionId: string): boolean { return false; }

  // ---------------------------------------------------------------------------
  // Chat history loading
  // ---------------------------------------------------------------------------

  private async loadChatHistory(
    organizationId: string,
    sessionId?: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    if (!sessionId) return [];
    try {
      const { prisma } = await import('../config/database.js');
      // Load recent messages, excluding the very latest user message
      // (which is the current prompt — already passed separately in payload.prompt).
      const messages = await prisma.chat_messages.findMany({
        where: { session_id: sessionId, organization_id: organizationId },
        orderBy: { created_at: 'desc' },
        take: 21, // one extra so we can drop the latest user message
        select: { type: true, content: true },
      });
      const reversed = messages.reverse();
      // Drop the last user message (it's the current prompt being sent)
      let lastUserIdx = -1;
      for (let i = reversed.length - 1; i >= 0; i--) {
        if (reversed[i]!.type === 'user') { lastUserIdx = i; break; }
      }
      if (lastUserIdx >= 0) {
        reversed.splice(lastUserIdx, 1);
      }
      return reversed.map((m: { type: string; content: string }) => ({
        role: m.type === 'ai' ? 'assistant' as const : 'user' as const,
        content: this.extractTextFromContent(m.content),
      }));
    } catch (err) {
      console.warn('[agentcore-runtime] Failed to load chat history:', err);
      return [];
    }
  }

  private extractTextFromContent(content: string): string {
    // AI messages are stored as JSON array of content blocks
    try {
      const blocks = JSON.parse(content);
      if (Array.isArray(blocks)) {
        return blocks
          .filter((b: any) => b.type === 'text' && b.text)
          .map((b: any) => b.text)
          .join('\n');
      }
    } catch {
      // Not JSON — return as-is (user messages are plain text)
    }
    return content;
  }

  // ---------------------------------------------------------------------------
  // S3 workspace upload
  // ---------------------------------------------------------------------------

  private async uploadDirToS3(localDir: string, s3Prefix: string): Promise<number> {
    let count = 0;
    const SKIP = new Set(['node_modules', '.git', 'dist', '__pycache__']);

    const walk = async (dir: string): Promise<void> => {
      let entries;
      try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (SKIP.has(entry.name)) continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isSymbolicLink()) {
          // Follow symlink — if it points to a directory, walk it; if file, upload
          try {
            const linkStat = statSync(fullPath); // follows symlink
            if (linkStat.isDirectory()) {
              await walk(fullPath);
            } else if (linkStat.isFile() && linkStat.size <= 50 * 1024 * 1024) {
              const relPath = relative(localDir, fullPath);
              const key = `${s3Prefix}${relPath}`;
              await this.s3Client.send(new PutObjectCommand({
                Bucket: this.workspaceBucket,
                Key: key,
                Body: createReadStream(fullPath),
                ContentLength: linkStat.size,
              }));
              count++;
            }
          } catch {
            // Broken symlink or permission error — skip silently
          }
        } else {
          const relPath = relative(localDir, fullPath);
          const key = `${s3Prefix}${relPath}`;
          try {
            const fileStat = statSync(fullPath);
            if (fileStat.size > 50 * 1024 * 1024) continue; // skip >50MB
            await this.s3Client.send(new PutObjectCommand({
              Bucket: this.workspaceBucket,
              Key: key,
              Body: createReadStream(fullPath),
              ContentLength: fileStat.size,
            }));
            count++;
          } catch (err) {
            console.warn(`[agentcore-runtime] Upload failed: ${key}`, err);
          }
        }
      }
    };

    await walk(localDir);
    return count;
  }

  // ---------------------------------------------------------------------------
  // S3 → local sync (pull container changes back to local workspace)
  // ---------------------------------------------------------------------------

  private async syncBackFromS3(s3Prefix: string, localDir: string): Promise<number> {
    let downloaded = 0;
    let continuationToken: string | undefined;

    do {
      const result = await this.s3Client.send(new ListObjectsV2Command({
        Bucket: this.workspaceBucket,
        Prefix: s3Prefix,
        ContinuationToken: continuationToken,
      }));

      for (const obj of result.Contents ?? []) {
        if (!obj.Key) continue;
        const relativePath = obj.Key.slice(s3Prefix.length);
        if (!relativePath || relativePath.endsWith('/')) continue;

        const localPath = join(localDir, relativePath);
        const localDirPath = dirname(localPath);

        try {
          await mkdir(localDirPath, { recursive: true });
          // Skip if localPath is already a directory
          try {
            const s = await import('fs/promises').then(m => m.stat(localPath));
            if (s.isDirectory()) continue;
          } catch { /* doesn't exist yet, fine */ }
          const response = await this.s3Client.send(new GetObjectCommand({
            Bucket: this.workspaceBucket,
            Key: obj.Key,
          }));
          if (response.Body) {
            await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(localPath));
            downloaded++;
          }
        } catch (err) {
          // Non-critical — local workspace is a cache
          console.warn(`[agentcore-runtime] syncBack failed for ${relativePath}:`, err instanceof Error ? err.message : err);
        }
      }

      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    if (downloaded > 0) {
      console.log(`[agentcore-runtime] Synced back ${downloaded} files from S3 to local`);
    }
    return downloaded;
  }

  private async *parseSSEStream(stream: any): AsyncGenerator<ConversationEvent> {
    let buffer = '';
    const iterable = stream[Symbol.asyncIterator]
      ? stream
      : stream.transformToByteArray ? [await stream.transformToByteArray()] : [stream];

    for await (const chunk of iterable) {
      buffer += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        for (const line of part.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try { yield this.mapEvent(JSON.parse(data)); } catch { /* skip */ }
        }
      }
    }
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try { yield this.mapEvent(JSON.parse(data)); } catch { /* skip */ }
      }
    }
  }

  private mapEvent(event: AgentCoreEvent): ConversationEvent {
    switch (event.type) {
      case 'session_start':
        return { type: 'session_start', sessionId: event.session_id };
      case 'assistant':
        return { type: 'assistant', sessionId: event.session_id, content: (event.content ?? []) as ContentBlock[] };
      case 'result':
        return { type: 'result', sessionId: event.session_id, durationMs: event.duration_ms, numTurns: event.num_turns };
      case 'error':
        return { type: 'error', sessionId: event.session_id, code: event.code ?? 'AGENTCORE_ERROR', message: event.message ?? 'Unknown error' };
      default:
        return { type: 'error', code: 'UNKNOWN_EVENT', message: `Unknown event type: ${(event as any).type}` };
    }
  }

  private async readBody(stream: any): Promise<string> {
    if (typeof stream.transformToString === 'function') return stream.transformToString();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf-8');
  }
}
