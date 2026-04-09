/**
 * OpenClaw Agent Runtime — invokes OpenClaw running inside AWS Bedrock
 * AgentCore Runtime containers.
 *
 * Based on the aws-samples/sample-host-openclaw-on-amazon-bedrock-agentcore
 * architecture: per-user serverless microVMs on AgentCore, with a contract
 * server (port 8080) that bridges to OpenClaw gateway (port 18789) inside
 * the container.
 *
 * This is architecturally similar to the existing AgentCoreService but
 * targets the OpenClaw bridge container instead of raw Claude Agent SDK.
 *
 * The invocation flow:
 *   Backend → InvokeAgentRuntime (AWS SDK) → AgentCore microVM
 *     → contract server (8080) → lightweight-agent or OpenClaw gateway (18789)
 *     → Bedrock proxy (18790) → Amazon Bedrock Claude
 *
 * Required env vars:
 *   OPENCLAW_AGENTCORE_RUNTIME_ARN — ARN of the deployed AgentCore Runtime
 *   AWS_REGION                     — AWS region (inherited from config)
 */

import { config } from '../config/index.js';
import type { AgentRuntime, AgentRuntimeOptions } from './agent-runtime.js';
import type { ConversationEvent, AgentConfig, ContentBlock, MCPServerSDKConfig } from './claude-agent.service.js';
import type { SkillForWorkspace } from './workspace-manager.js';

// ---------------------------------------------------------------------------
// AgentCore contract server event shape
// (matches bridge/agentcore-contract.js response format)
// ---------------------------------------------------------------------------

interface OpenClawContractEvent {
  type: 'session_start' | 'assistant' | 'result' | 'error' | 'heartbeat';
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
  model?: string;
  duration_ms?: number;
  num_turns?: number;
  code?: string;
  message?: string;
  is_error?: boolean;
  result?: string;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class OpenClawAgentRuntime implements AgentRuntime {
  readonly name = 'openclaw';

  private runtimeClient: any; // @aws-sdk/client-bedrock-agentcore
  private sdkLoaded = false;
  private activeSessions = new Map<string, AbortController>();

  /**
   * Lazily load the AWS SDK (may not be installed in dev environments).
   */
  private async ensureSDK(): Promise<void> {
    if (this.sdkLoaded) return;
    try {
      const mod = await import('@aws-sdk/client-bedrock-agentcore' as string);
      this.runtimeClient = new mod.BedrockAgentCore({ region: config.aws.region });
      this.sdkLoaded = true;
    } catch (err) {
      throw new Error(
        `AWS SDK for AgentCore not available. Install @aws-sdk/client-bedrock-agentcore. Error: ${err}`,
      );
    }
  }

  private get runtimeArn(): string {
    const arn = process.env.OPENCLAW_AGENTCORE_RUNTIME_ARN;
    if (!arn) throw new Error('OPENCLAW_AGENTCORE_RUNTIME_ARN is not configured');
    return arn;
  }

  async *runConversation(
    options: AgentRuntimeOptions,
    agentConfig: AgentConfig,
    _skills: SkillForWorkspace[],
    _pluginPaths?: string[],
    _mcpServers?: Record<string, MCPServerSDKConfig>,
  ): AsyncGenerator<ConversationEvent> {
    await this.ensureSDK();

    // Build the payload matching the contract server's expected format.
    // The contract server in the bridge container expects:
    //   { action: "chat", prompt: "...", session_id?: "..." }
    const payload = JSON.stringify({
      action: 'chat',
      prompt: options.message,
      session_id: options.providerSessionId ?? undefined,
      // Pass system prompt override if the agent has one
      system_prompt: agentConfig.systemPrompt ?? undefined,
    });

    // Use a per-user session ID for AgentCore (maps to isolated microVM).
    // The userId serves as the AgentCore session key so each user gets
    // their own container with persistent workspace.
    const agentCoreSessionId = options.providerSessionId
      ?? `${options.organizationId}_${options.userId}`;

    console.log(
      `[openclaw-runtime] Invoking AgentCore for user=${options.userId} ` +
      `session=${agentCoreSessionId} agent=${agentConfig.id}`,
    );

    let response: any;
    try {
      response = await this.runtimeClient.invokeAgentRuntime({
        agentRuntimeArn: this.runtimeArn,
        runtimeSessionId: agentCoreSessionId,
        payload,
      });
    } catch (err) {
      yield {
        type: 'error',
        code: 'OPENCLAW_INVOKE_ERROR',
        message: `Failed to invoke AgentCore Runtime: ${err instanceof Error ? err.message : String(err)}`,
        suggestedAction: 'Check OPENCLAW_AGENTCORE_RUNTIME_ARN and IAM permissions',
      };
      return;
    }

    // Parse the response — AgentCore can return SSE stream or JSON
    const contentType: string = response.contentType ?? '';

    if (contentType.includes('text/event-stream')) {
      yield* this.parseSSEStream(response.response);
    } else {
      // Non-streaming JSON fallback
      const body = await this.readResponseBody(response.response);
      try {
        const event: OpenClawContractEvent = JSON.parse(body);
        yield this.mapEvent(event);
      } catch {
        // The contract server may return a plain result string
        yield {
          type: 'assistant',
          content: [{ type: 'text', text: body }],
        };
      }
    }
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const controller = this.activeSessions.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeSessions.delete(sessionId);
    }
  }

  async disconnectAll(): Promise<number> {
    const count = this.activeSessions.size;
    for (const [id, controller] of this.activeSessions) {
      controller.abort();
      this.activeSessions.delete(id);
    }
    return count;
  }

  get activeSessionCount(): number {
    return this.activeSessions.size;
  }

  hasSession(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  // ---------------------------------------------------------------------------
  // SSE parsing (same pattern as agentcore.service.ts)
  // ---------------------------------------------------------------------------

  private async *parseSSEStream(
    stream: any,
  ): AsyncGenerator<ConversationEvent> {
    let buffer = '';

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

      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        for (const line of part.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const event: OpenClawContractEvent = JSON.parse(data);
            yield this.mapEvent(event);
          } catch {
            console.warn('[openclaw-runtime] Failed to parse SSE event:', data.slice(0, 100));
          }
        }
      }
    }

    // Drain remaining buffer
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const event: OpenClawContractEvent = JSON.parse(data);
          yield this.mapEvent(event);
        } catch { /* skip */ }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Event mapping (contract server events → ConversationEvent)
  // ---------------------------------------------------------------------------

  private mapEvent(event: OpenClawContractEvent): ConversationEvent {
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
          model: event.model,
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
          code: event.code ?? 'OPENCLAW_ERROR',
          message: event.message ?? 'Unknown OpenClaw error',
        };

      case 'heartbeat':
        return { type: 'heartbeat' };

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
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}
