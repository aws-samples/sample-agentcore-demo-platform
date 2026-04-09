import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

interface GetBriefingsQuery {
  limit?: number;
  status?: string;
  category?: string;
  unreadOnly?: boolean;
}

interface BriefingParams {
  scopeId: string;
  id?: string;
}

export async function briefingRoutes(app: FastifyInstance) {
  // Get briefings for a scope
  app.get<{
    Params: { scopeId: string };
    Querystring: GetBriefingsQuery;
  }>(
    '/api/business-scopes/:scopeId/briefings',
    { preHandler: [authenticate] },
    async (req: FastifyRequest<{ Params: { scopeId: string }; Querystring: GetBriefingsQuery }>, reply: FastifyReply) => {
      const { scopeId } = req.params;
      const { limit = 8, status, category, unreadOnly } = req.query;

      const briefings = await prisma.scope_briefings.findMany({
        where: {
          business_scope_id: scopeId,
          is_archived: false,
          ...(status && { status }),
          ...(category && { category }),
          ...(unreadOnly && { is_read: false }),
        },
        include: {
          agent: {
            select: {
              id: true,
              display_name: true,
              avatar: true,
            },
          },
        },
        orderBy: [
          { importance: 'desc' },
          { event_time: 'desc' },
        ],
        take: Number(limit),
      });

      return reply.send(briefings);
    }
  );

  // Mark briefing as read
  app.patch<{ Params: BriefingParams }>(
    '/api/business-scopes/:scopeId/briefings/:id/read',
    { preHandler: [authenticate] },
    async (req: FastifyRequest<{ Params: BriefingParams }>, reply: FastifyReply) => {
      const { scopeId, id } = req.params;

      await prisma.scope_briefings.update({
        where: {
          id,
          business_scope_id: scopeId,
        },
        data: { is_read: true },
      });

      return reply.send({ success: true });
    }
  );

  // Archive briefing
  app.delete<{ Params: BriefingParams }>(
    '/api/business-scopes/:scopeId/briefings/:id',
    { preHandler: [authenticate] },
    async (req: FastifyRequest<{ Params: BriefingParams }>, reply: FastifyReply) => {
      const { scopeId, id } = req.params;

      await prisma.scope_briefings.update({
        where: {
          id,
          business_scope_id: scopeId,
        },
        data: { is_archived: true },
      });

      return reply.send({ success: true });
    }
  );

  // Get briefing stats
  app.get<{ Params: { scopeId: string } }>(
    '/api/business-scopes/:scopeId/briefings/stats',
    { preHandler: [authenticate] },
    async (req: FastifyRequest<{ Params: { scopeId: string } }>, reply: FastifyReply) => {
      const { scopeId } = req.params;

      const [total, unread, byStatus] = await Promise.all([
        prisma.scope_briefings.count({
          where: { business_scope_id: scopeId, is_archived: false },
        }),
        prisma.scope_briefings.count({
          where: { business_scope_id: scopeId, is_archived: false, is_read: false },
        }),
        prisma.scope_briefings.groupBy({
          by: ['status'],
          where: { business_scope_id: scopeId, is_archived: false },
          _count: true,
        }),
      ]);

      return reply.send({
        total,
        unread,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
      });
    }
  );
}
