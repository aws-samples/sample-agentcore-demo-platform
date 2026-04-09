/**
 * Langfuse Observability Service
 *
 * Wraps the Langfuse JS SDK to provide tracing for Claude Agent conversations.
 * Each chat turn creates a trace with nested spans for the conversation lifecycle:
 *   trace (per user message)
 *   ├── generation (the Claude agent turn — captures all content blocks)
 *   │   ├── span: tool_use  (one per tool call)
 *   │   └── span: tool_result
 *   └── metadata (session, user, agent, scope)
 *
 * Safe to call even when Langfuse is not configured — all methods are no-ops.
 */

import { Langfuse } from 'langfuse';
import { config } from '../config/index.js';
import type { ConversationEvent, ContentBlock, AgentConfig } from './claude-agent.service.js';

// Re-export for convenience
export type { ContentBlock };

let langfuse: Langfuse | null = null;

function getLangfuse(): Langfuse | null {
  if (!config.langfuse.enabled) return null;
  if (!langfuse) {
    langfuse = new Langfuse({
      secretKey: config.langfuse.secretKey!,
      publicKey: config.langfuse.publicKey!,
      baseUrl: config.langfuse.baseUrl,
    });
    console.log('✅ Langfuse client initialized');
  }
  return langfuse;
}

/**
 * Represents an active trace for a single chat turn.
 */
export interface ActiveTrace {
  traceId: string;
  trace: ReturnType<Langfuse['trace']>;
  generationStartTime: Date;
  toolSpans: Map<string, ReturnType<ReturnType<Langfuse['trace']>['span']>>;
}

/**
 * Start a new Langfuse trace for a chat turn.
 */
export function startConversationTrace(opts: {
  sessionId: string;
  userId: string;
  organizationId: string;
  userMessage: string;
  agentConfig: AgentConfig;
  model: string;
}): ActiveTrace | null {
  const lf = getLangfuse();
  if (!lf) return null;

  const trace = lf.trace({
    name: 'chat-turn',
    sessionId: opts.sessionId,
    userId: opts.userId,
    input: opts.userMessage,
    metadata: {
      organizationId: opts.organizationId,
      agentId: opts.agentConfig.id,
      agentName: opts.agentConfig.displayName,
      model: opts.model,
    },
  });

  return {
    traceId: trace.id,
    trace,
    generationStartTime: new Date(),
    toolSpans: new Map(),
  };
}

/**
 * Record a conversation event into the active trace.
 * Call this for every ConversationEvent yielded by runConversation.
 */
export function recordEvent(active: ActiveTrace | null, event: ConversationEvent): void {
  if (!active) return;

  if (event.type === 'assistant' && event.content) {
    for (const block of event.content) {
      if (block.type === 'tool_use') {
        const span = active.trace.span({
          name: `tool: ${block.name}`,
          input: block.input,
          metadata: { toolUseId: block.id },
        });
        active.toolSpans.set(block.id, span);
      } else if (block.type === 'tool_result') {
        const span = active.toolSpans.get(block.tool_use_id);
        if (span) {
          span.update({
            output: block.content,
            level: block.is_error ? 'ERROR' : 'DEFAULT',
          });
          span.end();
          active.toolSpans.delete(block.tool_use_id);
        }
      }
    }
  }

  if (event.type === 'error') {
    active.trace.event({
      name: 'error',
      input: { code: event.code, message: event.message },
      level: 'ERROR',
    });
  }
}

/**
 * Finalize the trace after the conversation turn completes.
 */
export function endConversationTrace(
  active: ActiveTrace | null,
  allContentBlocks: ContentBlock[],
  result?: { durationMs?: number; numTurns?: number; model?: string },
): void {
  if (!active) return;

  // Close any unclosed tool spans
  for (const span of active.toolSpans.values()) {
    span.end();
  }

  // Extract text output for the trace
  const textOutput = allContentBlocks
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  // Create a generation observation for the full agent turn
  active.trace.generation({
    name: 'claude-agent-turn',
    model: result?.model ?? config.claude.model,
    startTime: active.generationStartTime,
    endTime: new Date(),
    output: textOutput || undefined,
    metadata: {
      numTurns: result?.numTurns,
      durationMs: result?.durationMs,
      totalContentBlocks: allContentBlocks.length,
      toolCalls: allContentBlocks.filter((b) => b.type === 'tool_use').length,
    },
  });

  // Update trace output
  active.trace.update({ output: textOutput || undefined });
}

/**
 * Flush pending events to Langfuse. Call on server shutdown.
 */
export async function flushLangfuse(): Promise<void> {
  if (langfuse) {
    await langfuse.flushAsync();
  }
}

/**
 * Shutdown the Langfuse client. Call on server shutdown.
 */
export async function shutdownLangfuse(): Promise<void> {
  if (langfuse) {
    await langfuse.shutdownAsync();
    langfuse = null;
  }
}
