/**
 * Agent Metrics Service
 *
 * Records agent activity events and maintains daily rollup metrics.
 * Designed for inline use in the conversation event stream — all writes
 * are fire-and-forget to avoid blocking the SSE response.
 *
 * Event types:
 *   - subagent_invocation: a sub-agent was delegated to
 *   - skill_usage: a skill was invoked via the Skill tool
 *   - tool_call: a built-in tool (Bash, Write, Read, etc.) was used
 *   - error: a tool call resulted in an error
 *   - turn_complete: an agent turn finished (result event)
 */

import { prisma } from '../config/database.js';

export interface AgentEventInput {
  organizationId: string;
  sessionId?: string;
  agentId?: string;
  targetAgentId?: string;
  eventType: string;
  eventName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record an agent event and increment the daily rollup.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function recordAgentEvent(input: AgentEventInput): Promise<void> {
  try {
    // Insert fact row
    await prisma.agent_events.create({
      data: {
        organization_id: input.organizationId,
        session_id: input.sessionId ?? null,
        agent_id: input.agentId ?? null,
        target_agent_id: input.targetAgentId ?? null,
        event_type: input.eventType,
        event_name: input.eventName ?? null,
        metadata: (input.metadata ?? {}) as object,
      },
    });

    // Upsert daily rollup (only if we have an agent_id)
    if (input.agentId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.$executeRaw`
        INSERT INTO "agent_metrics_daily" ("id", "organization_id", "agent_id", "metric_date", "event_type", "event_name", "count", "metadata", "updated_at")
        VALUES (gen_random_uuid(), ${input.organizationId}::uuid, ${input.agentId}::uuid, ${today}::date, ${input.eventType}, ${input.eventName ?? null}, 1, '{}', NOW())
        ON CONFLICT ("organization_id", "agent_id", "metric_date", "event_type", "event_name")
        DO UPDATE SET "count" = "agent_metrics_daily"."count" + 1, "updated_at" = NOW()
      `;
    }
  } catch (err) {
    console.error('[agent-metrics] Failed to record event:', err);
  }
}

/**
 * Get aggregated metrics for an agent over a date range.
 */
export async function getAgentMetrics(
  organizationId: string,
  agentId: string,
  from?: Date,
  to?: Date,
): Promise<{ eventType: string; eventName: string | null; total: number }[]> {
  const fromDate = from ?? new Date(0);
  const toDate = to ?? new Date();

  const rows = await prisma.agent_metrics_daily.groupBy({
    by: ['event_type', 'event_name'],
    where: {
      organization_id: organizationId,
      agent_id: agentId,
      metric_date: { gte: fromDate, lte: toDate },
    },
    _sum: { count: true },
    orderBy: { _sum: { count: 'desc' } },
  });

  return rows.map((r) => ({
    eventType: r.event_type,
    eventName: r.event_name,
    total: r._sum.count ?? 0,
  }));
}

/**
 * Get daily time-series for a specific metric.
 */
export async function getAgentMetricsTimeSeries(
  organizationId: string,
  agentId: string,
  eventType: string,
  from: Date,
  to: Date,
): Promise<{ date: Date; eventName: string | null; count: number }[]> {
  const rows = await prisma.agent_metrics_daily.findMany({
    where: {
      organization_id: organizationId,
      agent_id: agentId,
      event_type: eventType,
      metric_date: { gte: from, lte: to },
    },
    orderBy: { metric_date: 'asc' },
    select: {
      metric_date: true,
      event_name: true,
      count: true,
    },
  });

  return rows.map((r) => ({
    date: r.metric_date,
    eventName: r.event_name,
    count: r.count,
  }));
}
