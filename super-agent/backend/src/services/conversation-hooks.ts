/**
 * Conversation Event Hooks
 *
 * Inspects ConversationEvents inline during streaming and fires
 * metrics recording for detected patterns (sub-agent invocations,
 * skill usage, tool calls, errors, turn completions).
 *
 * All actions are fire-and-forget — they never block the SSE stream.
 */

import type { ConversationEvent, ContentBlock } from './claude-agent.service.js';
import { recordAgentEvent } from './agent-metrics.service.js';
import { recordTokenUsage } from './token-usage.service.js';
import { agentStatusService } from './agent-status.service.js';

export interface ConversationHookContext {
  organizationId: string;
  sessionId: string;
  agentId: string;
  userId: string;
  /** Source of the conversation: chat, workflow, or scope_generator */
  source: 'chat' | 'workflow' | 'scope_generator';
  /** Names of sub-agents available in this session's workspace */
  subAgentNames: Set<string>;
  /** Maps sub-agent name → agent UUID for populating target_agent_id */
  subAgentNameToId: Map<string, string>;
  /**
   * Tracks in-flight sub-agent calls: tool_use_id → agent UUID.
   * Used to set the sub-agent back to active when the tool_result arrives.
   */
  activeSubAgentCalls: Map<string, string>;
  /**
   * Tracks when each sub-agent delegation started: tool_use_id → timestamp (ms).
   * Used to compute working duration when the tool_result arrives.
   */
  subAgentStartTimes: Map<string, number>;
}

/**
 * Process a conversation event through all registered hooks.
 * Call this for every event in the streaming callback.
 */
export function processConversationEvent(
  ctx: ConversationHookContext,
  event: ConversationEvent,
): void {
  if (event.type === 'assistant' && event.content) {
    for (const block of event.content) {
      processContentBlock(ctx, block);
    }
  }

  if (event.type === 'result') {
    recordAgentEvent({
      organizationId: ctx.organizationId,
      sessionId: ctx.sessionId,
      agentId: ctx.agentId,
      eventType: 'turn_complete',
      metadata: {
        durationMs: event.durationMs,
        numTurns: event.numTurns,
      },
    });

    // Record token usage if available
    if (event.tokenUsage) {
      recordTokenUsage({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        agentId: ctx.agentId,
        source: ctx.source,
        tokenUsage: event.tokenUsage,
      });
    }

    // Safety net: set any still-tracked sub-agents back to active
    flushActiveSubAgents(ctx);
  }

  if (event.type === 'error') {
    recordAgentEvent({
      organizationId: ctx.organizationId,
      sessionId: ctx.sessionId,
      agentId: ctx.agentId,
      eventType: 'error',
      eventName: event.code,
      metadata: { message: event.message },
    });

    // Safety net: set any still-tracked sub-agents back to active
    flushActiveSubAgents(ctx);
  }
}

function processContentBlock(ctx: ConversationHookContext, block: ContentBlock): void {
  // --- Sub-agent completion: tool_result for a tracked sub-agent call ---
  if (block.type === 'tool_result') {
    const targetAgentId = ctx.activeSubAgentCalls.get(block.tool_use_id);
    if (targetAgentId) {
      ctx.activeSubAgentCalls.delete(block.tool_use_id);
      agentStatusService.setActive(targetAgentId, ctx.organizationId).catch(() => {});

      // Compute working duration and record a subagent_complete event
      const startTime = ctx.subAgentStartTimes.get(block.tool_use_id);
      ctx.subAgentStartTimes.delete(block.tool_use_id);
      const durationMs = startTime != null ? Date.now() - startTime : undefined;

      recordAgentEvent({
        organizationId: ctx.organizationId,
        sessionId: ctx.sessionId,
        agentId: ctx.agentId,
        targetAgentId,
        eventType: 'subagent_complete',
        metadata: { durationMs },
      });
    }
    return;
  }

  if (block.type !== 'tool_use') return;

  const toolName = block.name;

  // Sub-agent invocation detection — two patterns:
  //
  // 1. Claude Code "Task" tool with subagent_type in input
  //    e.g. { name: "Task", input: { subagent_type: "compliance-officer", prompt: "..." } }
  //
  // 2. Direct tool call whose name matches a known sub-agent name
  //    (less common but possible with custom setups)
  if (toolName === 'Task') {
    const input = block.input as Record<string, unknown>;
    const subAgentName = (input.subagent_type ?? input.agent) as string | undefined;
    if (typeof subAgentName === 'string') {
      const targetAgentId = ctx.subAgentNameToId.get(subAgentName);
      if (targetAgentId) {
        ctx.activeSubAgentCalls.set(block.id, targetAgentId);
        ctx.subAgentStartTimes.set(block.id, Date.now());
        agentStatusService.setBusy(targetAgentId, ctx.organizationId).catch(() => {});
      }
      recordAgentEvent({
        organizationId: ctx.organizationId,
        sessionId: ctx.sessionId,
        agentId: ctx.agentId,
        targetAgentId,
        eventType: 'subagent_invocation',
        eventName: subAgentName,
        metadata: { prompt: input.prompt, description: input.description },
      });
      return;
    }
  }

  if (ctx.subAgentNames.has(toolName)) {
    const targetAgentId = ctx.subAgentNameToId.get(toolName);
    if (targetAgentId) {
      ctx.activeSubAgentCalls.set(block.id, targetAgentId);
      ctx.subAgentStartTimes.set(block.id, Date.now());
      agentStatusService.setBusy(targetAgentId, ctx.organizationId).catch(() => {});
    }
    recordAgentEvent({
      organizationId: ctx.organizationId,
      sessionId: ctx.sessionId,
      agentId: ctx.agentId,
      targetAgentId,
      eventType: 'subagent_invocation',
      eventName: toolName,
      metadata: { input: block.input },
    });
    return;
  }

  // Skill usage detection:
  // Skills are invoked via the "Skill" tool with a skill_name in the input.
  if (toolName === 'Skill') {
    const skillName = (block.input as Record<string, unknown>)?.skill_name
      ?? (block.input as Record<string, unknown>)?.skill;
    recordAgentEvent({
      organizationId: ctx.organizationId,
      sessionId: ctx.sessionId,
      agentId: ctx.agentId,
      eventType: 'skill_usage',
      eventName: typeof skillName === 'string' ? skillName : toolName,
      metadata: { input: block.input },
    });
    return;
  }

  // General tool call tracking
  recordAgentEvent({
    organizationId: ctx.organizationId,
    sessionId: ctx.sessionId,
    agentId: ctx.agentId,
    eventType: 'tool_call',
    eventName: toolName,
    metadata: { toolUseId: block.id },
  });
}

/**
 * Safety net: set all still-tracked sub-agents back to active.
 * Called on conversation result/error to avoid leaving agents stuck as "busy"
 * if a tool_result was never received (e.g. timeout, abort).
 */
export function flushActiveSubAgents(ctx: ConversationHookContext): void {
  for (const [toolUseId, agentId] of ctx.activeSubAgentCalls) {
    agentStatusService.setActive(agentId, ctx.organizationId).catch(() => {});
  }
  ctx.activeSubAgentCalls.clear();
  ctx.subAgentStartTimes.clear();
}
