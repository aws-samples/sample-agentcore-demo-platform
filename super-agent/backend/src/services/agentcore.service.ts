/**
 * AgentCore Service
 *
 * Invokes Claude Agent SDK running inside AWS Bedrock AgentCore Runtime
 * containers. Replaces ClaudeAgentService for scope-bound agent execution
 * when config.agentcore.enabled is true.
 *
 * System-level agents (scope generator, workflow generator) continue to
 * use ClaudeAgentService directly — they don't need container isolation.
 */

import { config } from '../config/index.js';
import type { ConversationEvent, AgentConfig, ContentBlock } from './claude-agent.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentCoreInvokeOptions {
  scopeId: string;
  organizationId: string;
  userId: string;
  agentId?: string;
  sessionId?: string;
  claudeSessionId?: string;
  message: string;
  systemPrompt?: string;
  mcpServers?: Record<string, unknown>;
}

/** Event shape emitted by the AgentCore container (matches agentcore/src/types.ts AgentEvent). */
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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AgentCoreService {
  private runtimeClient: any; // @aws-sdk/client-bedrock-agentcore
  private sdkLoaded = false;

  /**
   * Lazily load the AWS SDK clients (they may not be installed in dev).
   */
  private async ensureSDK(): Promise<void> {
    if (this.sdkLoaded) return;

    try {
      // Dynamic import — these packages are only needed when AgentCore is enabled
      const runtimeMod = await import('@aws-sdk/client-bedrock-agentcore' as string);

      const region = config.agentcore.region;
      this.runtimeClient = new runtimeMod.BedrockAgentCore({ region });
      this.sdkLoaded = true;
    } catch (err) {
      throw new Error(
        `AgentCore SDK not available. Install @aws-sdk/client-bedrock-agentcore and @aws-sdk/client-bedrock-agentcore-control. Error: ${err}`,
      );
    }
  }

  // =========================================================================
  // Runtime lifecycle
  // =========================================================================

  /**
   * Get the AgentCore Runtime ARN for a scope.
   * Returns null if no runtime is deployed for this scope.
   */
  async getRuntimeArn(orgId: string, scopeId: string): Promise<string | null> {
    // Query the agentcore_runtimes table (added by migration)
    const { prisma } = await import('../config/database.js');
    const result = await prisma.$queryRaw<Array<{ runtime_arn: string }>>`
      SELECT runtime_arn FROM agentcore_runtimes
      WHERE organization_id = ${orgId}::uuid AND scope_id = ${scopeId}::uuid
      AND status = 'ready'
      LIMIT 1
    `.catch(() => []);
    return result.length > 0 ? result[0]!.runtime_arn : null;
  }

  /**
   * Ensure a runtime exists for the scope. If not, throw an error
   * instructing the admin to deploy one.
   *
   * In the future this could auto-deploy, but for Sprint 2 we require
   * manual deployment via the admin API.
   */
  async ensureRuntime(orgId: string, scopeId: string): Promise<string> {
    const arn = await this.getRuntimeArn(orgId, scopeId);
    if (!arn) {
      throw new Error(
        `No AgentCore Runtime deployed for scope ${scopeId}. ` +
        `Deploy one via POST /api/admin/runtimes/${scopeId}/deploy`,
      );
    }
    return arn;
  }

  // =========================================================================
  // Agent invocation (streaming)
  // =========================================================================

  /**
   * Invoke the AgentCore Runtime and yield ConversationEvents.
   *
   * This is the drop-in replacement for ClaudeAgentService.runConversation()
   * when running in AgentCore mode.
   */
  async *runConversation(
    options: AgentCoreInvokeOptions,
    agentConfig: AgentConfig,
  ): AsyncGenerator<ConversationEvent> {
    await this.ensureSDK();

    const agentArn = await this.ensureRuntime(options.organizationId, options.scopeId);

    const payload = JSON.stringify({
      prompt: options.message,
      session_id: options.claudeSessionId ?? undefined,
      scope_id: options.scopeId,
      org_id: options.organizationId,
      agent_id: options.agentId,
      system_prompt: options.systemPrompt ?? agentConfig.systemPrompt ?? undefined,
      mcp_servers: options.mcpServers ?? undefined,
    });

    console.log(
      `[agentcore] Invoking runtime for scope=${options.scopeId} session=${options.claudeSessionId ?? 'new'}`,
    );

    const response = await this.runtimeClient.invokeAgentRuntime({
      agentRuntimeArn: agentArn,
      runtimeSessionId: options.claudeSessionId ?? undefined,
      payload,
    });

    // Parse the SSE stream from the response body
    const contentType: string = response.contentType ?? '';

    if (contentType.includes('text/event-stream')) {
      // Streaming SSE response
      yield* this.parseSSEStream(response.response);
    } else {
      // Non-streaming JSON response (fallback)
      const body = await this.readResponseBody(response.response);
      try {
        const event: AgentCoreEvent = JSON.parse(body);
        yield this.mapEvent(event);
      } catch {
        yield {
          type: 'error',
          code: 'PARSE_ERROR',
          message: `Failed to parse AgentCore response: ${body.slice(0, 200)}`,
        };
      }
    }
  }

  // =========================================================================
  // SSE parsing
  // =========================================================================

  private async *parseSSEStream(
    stream: any, // StreamingBody or ReadableStream
  ): AsyncGenerator<ConversationEvent> {
    let buffer = '';

    // Handle different stream types
    const iterable = stream[Symbol.asyncIterator]
      ? stream
      : stream.transformToByteArray
        ? [await stream.transformToByteArray()]
        : [stream];

    for await (const chunk of iterable) {
      const text = typeof chunk === 'string'
        ? chunk
        : Buffer.from(chunk).toString('utf-8');

      buffer += text;

      // Split on double newline (SSE event boundary)
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        for (const line of part.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const event: AgentCoreEvent = JSON.parse(data);
            yield this.mapEvent(event);
          } catch {
            console.warn('[agentcore] Failed to parse SSE event:', data.slice(0, 100));
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const event: AgentCoreEvent = JSON.parse(data);
          yield this.mapEvent(event);
        } catch { /* skip */ }
      }
    }
  }

  // =========================================================================
  // Event mapping (AgentCoreEvent → ConversationEvent)
  // =========================================================================

  private mapEvent(event: AgentCoreEvent): ConversationEvent {
    switch (event.type) {
      case 'session_start':
        return {
          type: 'session_start',
          sessionId: event.session_id,
        };

      case 'assistant':
        return {
          type: 'assistant',
          sessionId: event.session_id,
          content: (event.content ?? []) as ContentBlock[],
        };

      case 'result':
        return {
          type: 'result',
          sessionId: event.session_id,
          durationMs: event.duration_ms,
          numTurns: event.num_turns,
        };

      case 'error':
        return {
          type: 'error',
          sessionId: event.session_id,
          code: event.code ?? 'AGENTCORE_ERROR',
          message: event.message ?? 'Unknown AgentCore error',
        };

      default:
        return {
          type: 'error',
          code: 'UNKNOWN_EVENT',
          message: `Unknown event type: ${(event as any).type}`,
        };
    }
  }

  private async readResponseBody(stream: any): Promise<string> {
    if (typeof stream.transformToString === 'function') {
      return stream.transformToString();
    }
    // Fallback: read chunks
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}

export const agentCoreService = new AgentCoreService();
