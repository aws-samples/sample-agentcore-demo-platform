/**
 * Token Usage Routes
 *
 * Endpoints for querying token consumption data.
 * - Regular users can view their own usage
 * - Admin/Owner can view all members' usage
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getOrganizationUsage,
  getUserUsage,
  getUserUsageLogs,
} from '../services/token-usage.service.js';

interface MonthQuery {
  Querystring: { month?: string };
}

interface UserUsageParams {
  Params: { userId: string };
  Querystring: { months?: string };
}

interface UserLogsParams {
  Params: { userId: string };
  Querystring: { limit?: string; offset?: string };
}

/** Serialize BigInt values to numbers for JSON response */
function serializeUsage(rows: any[]) {
  return rows.map((r) => ({
    ...r,
    inputTokens: Number(r.inputTokens),
    outputTokens: Number(r.outputTokens),
    cacheReadInputTokens: Number(r.cacheReadInputTokens),
    cacheCreationInputTokens: Number(r.cacheCreationInputTokens),
    totalTokens: Number(r.inputTokens) + Number(r.outputTokens),
  }));
}

export async function tokenUsageRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /api/token-usage/me — current user's usage history */
  fastify.get<UserUsageParams>(
    '/me',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<UserUsageParams>, reply: FastifyReply) => {
      const months = request.query.months ? parseInt(request.query.months, 10) : 6;
      const rows = await getUserUsage(request.user!.orgId, request.user!.id, months);
      return reply.send({ data: serializeUsage(rows) });
    },
  );

  /** GET /api/token-usage/organization — all members' usage for a month (Admin/Owner) */
  fastify.get<MonthQuery>(
    '/organization',
    { preHandler: [authenticate, requireRole('owner', 'admin')] },
    async (request: FastifyRequest<MonthQuery>, reply: FastifyReply) => {
      const month = request.query.month;
      const rows = await getOrganizationUsage(request.user!.orgId, month);
      return reply.send({ data: serializeUsage(rows) });
    },
  );

  /** GET /api/token-usage/users/:userId — specific user's usage (Admin/Owner) */
  fastify.get<UserUsageParams>(
    '/users/:userId',
    { preHandler: [authenticate, requireRole('owner', 'admin')] },
    async (request: FastifyRequest<UserUsageParams>, reply: FastifyReply) => {
      const months = request.query.months ? parseInt(request.query.months, 10) : 6;
      const rows = await getUserUsage(request.user!.orgId, request.params.userId, months);
      return reply.send({ data: serializeUsage(rows) });
    },
  );

  /** GET /api/token-usage/users/:userId/logs — detailed logs (Admin/Owner) */
  fastify.get<UserLogsParams>(
    '/users/:userId/logs',
    { preHandler: [authenticate, requireRole('owner', 'admin')] },
    async (request: FastifyRequest<UserLogsParams>, reply: FastifyReply) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;
      const offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;
      const rows = await getUserUsageLogs(request.user!.orgId, request.params.userId, limit, offset);
      return reply.send({ data: rows });
    },
  );
}
