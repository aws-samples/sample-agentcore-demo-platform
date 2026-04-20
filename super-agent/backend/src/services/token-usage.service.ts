/**
 * Token Usage Service
 *
 * Records per-invocation token consumption and maintains monthly rollups.
 * All writes are fire-and-forget to avoid blocking the SSE stream.
 */

import { prisma } from '../config/database.js';
import type { TokenUsage } from './claude-agent.service.js';

export interface TokenUsageInput {
  organizationId: string;
  userId: string;
  sessionId?: string;
  agentId?: string;
  source: 'chat' | 'workflow' | 'scope_generator';
  tokenUsage: TokenUsage;
  model?: string;
}

/**
 * Record a token usage event: insert a log row and upsert the monthly rollup.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function recordTokenUsage(input: TokenUsageInput): Promise<void> {
  try {
    const { organizationId, userId, sessionId, agentId, source, tokenUsage, model } = input;
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Insert detailed log
    await prisma.token_usage_log.create({
      data: {
        organization_id: organizationId,
        user_id: userId,
        session_id: sessionId ?? null,
        agent_id: agentId ?? null,
        source,
        input_tokens: tokenUsage.inputTokens,
        output_tokens: tokenUsage.outputTokens,
        cache_read_input_tokens: tokenUsage.cacheReadInputTokens,
        cache_creation_input_tokens: tokenUsage.cacheCreationInputTokens,
        total_cost_usd: tokenUsage.totalCostUsd,
        model: model ?? null,
      },
    });

    // Upsert monthly rollup
    await prisma.$executeRaw`
      INSERT INTO "token_usage_monthly" (
        "id", "organization_id", "user_id", "month",
        "input_tokens", "output_tokens",
        "cache_read_input_tokens", "cache_creation_input_tokens",
        "total_cost_usd", "invocation_count", "updated_at"
      ) VALUES (
        gen_random_uuid(), ${organizationId}::uuid, ${userId}::uuid, ${currentMonth},
        ${BigInt(tokenUsage.inputTokens)}, ${BigInt(tokenUsage.outputTokens)},
        ${BigInt(tokenUsage.cacheReadInputTokens)}, ${BigInt(tokenUsage.cacheCreationInputTokens)},
        ${tokenUsage.totalCostUsd}::decimal, 1, NOW()
      )
      ON CONFLICT ("organization_id", "user_id", "month")
      DO UPDATE SET
        "input_tokens" = "token_usage_monthly"."input_tokens" + EXCLUDED."input_tokens",
        "output_tokens" = "token_usage_monthly"."output_tokens" + EXCLUDED."output_tokens",
        "cache_read_input_tokens" = "token_usage_monthly"."cache_read_input_tokens" + EXCLUDED."cache_read_input_tokens",
        "cache_creation_input_tokens" = "token_usage_monthly"."cache_creation_input_tokens" + EXCLUDED."cache_creation_input_tokens",
        "total_cost_usd" = "token_usage_monthly"."total_cost_usd" + EXCLUDED."total_cost_usd",
        "invocation_count" = "token_usage_monthly"."invocation_count" + 1,
        "updated_at" = NOW()
    `;
  } catch (err) {
    console.error('[token-usage] Failed to record usage:', err);
  }
}

export interface MonthlyUsageSummary {
  userId: string;
  userName?: string;
  email?: string;
  month: string;
  inputTokens: bigint;
  outputTokens: bigint;
  cacheReadInputTokens: bigint;
  cacheCreationInputTokens: bigint;
  totalCostUsd: number;
  invocationCount: number;
}

/**
 * Get monthly token usage for all members of an organization.
 * Used by Admin/Owner to view all users' usage.
 */
export async function getOrganizationUsage(
  organizationId: string,
  month?: string,
): Promise<MonthlyUsageSummary[]> {
  const targetMonth = month ?? new Date().toISOString().slice(0, 7);

  const rows = await prisma.token_usage_monthly.findMany({
    where: { organization_id: organizationId, month: targetMonth },
    orderBy: { input_tokens: 'desc' },
  });

  // Join with profiles for display names
  const userIds = rows.map((r) => r.user_id);
  const profiles = userIds.length > 0
    ? await prisma.profiles.findMany({
        where: { id: { in: userIds } },
        select: { id: true, full_name: true, username: true },
      })
    : [];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return rows.map((r) => {
    const profile = profileMap.get(r.user_id);
    return {
      userId: r.user_id,
      userName: profile?.full_name ?? profile?.username ?? undefined,
      email: profile?.username ?? undefined,
      month: r.month,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      cacheReadInputTokens: r.cache_read_input_tokens,
      cacheCreationInputTokens: r.cache_creation_input_tokens,
      totalCostUsd: Number(r.total_cost_usd),
      invocationCount: r.invocation_count,
    };
  });
}

/**
 * Get monthly token usage for a specific user.
 * Used by individual users to view their own usage.
 */
export async function getUserUsage(
  organizationId: string,
  userId: string,
  months?: number,
): Promise<MonthlyUsageSummary[]> {
  const limit = months ?? 6;
  const rows = await prisma.token_usage_monthly.findMany({
    where: { organization_id: organizationId, user_id: userId },
    orderBy: { month: 'desc' },
    take: limit,
  });

  return rows.map((r) => ({
    userId: r.user_id,
    month: r.month,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    cacheReadInputTokens: r.cache_read_input_tokens,
    cacheCreationInputTokens: r.cache_creation_input_tokens,
    totalCostUsd: Number(r.total_cost_usd),
    invocationCount: r.invocation_count,
  }));
}

/**
 * Get detailed usage logs for a user (for drill-down).
 */
export async function getUserUsageLogs(
  organizationId: string,
  userId: string,
  limit = 50,
  offset = 0,
) {
  return prisma.token_usage_log.findMany({
    where: { organization_id: organizationId, user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit,
    skip: offset,
  });
}
