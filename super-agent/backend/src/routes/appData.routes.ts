/**
 * App Data Routes
 *
 * Per-app JSONB data storage API. Provides CRUD + aggregation for
 * published mini-SaaS apps that need persistent backend data.
 *
 * All endpoints are scoped to the authenticated user's org and the app ID.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../config/database.js';

export async function appDataRoutes(fastify: FastifyInstance): Promise<void> {

  // ── List documents in a collection ──────────────────────────────────────
  fastify.get<{
    Params: { appId: string; collection: string };
    Querystring: { limit?: number; offset?: number; sort?: string; order?: string; filter?: string };
  }>(
    '/:appId/data/:collection',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { appId, collection } = request.params;
      const orgId = request.user!.orgId;
      const limit = Math.min(request.query.limit ?? 100, 1000);
      const offset = request.query.offset ?? 0;
      const sortField = request.query.sort;
      const order = request.query.order === 'asc' ? 'asc' : 'desc';

      // Parse optional JSON filter: { "status": "approved", "amount_gt": 100 }
      let where: Record<string, unknown> = {};
      if (request.query.filter) {
        try { where = JSON.parse(request.query.filter); } catch { /* ignore */ }
      }

      // Build Prisma where clause with JSONB path filters
      const jsonFilters = buildJsonFilters(where);

      const [rows, total] = await Promise.all([
        prisma.app_data.findMany({
          where: { app_id: appId, org_id: orgId, collection, ...jsonFilters },
          take: limit,
          skip: offset,
          orderBy: sortField
            ? { data: { path: [sortField], sort: order } } as any
            : { created_at: order },
        }),
        prisma.app_data.count({
          where: { app_id: appId, org_id: orgId, collection, ...jsonFilters },
        }),
      ]);

      return reply.send({
        data: rows.map(r => ({ id: r.id, ...r.data as object, _created_at: r.created_at, _updated_at: r.updated_at })),
        total,
        limit,
        offset,
      });
    },
  );

  // ── Get single document ─────────────────────────────────────────────────
  fastify.get<{ Params: { appId: string; collection: string; docId: string } }>(
    '/:appId/data/:collection/:docId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { appId, collection, docId } = request.params;
      const row = await prisma.app_data.findFirst({
        where: { id: docId, app_id: appId, org_id: request.user!.orgId, collection },
      });
      if (!row) return reply.status(404).send({ error: 'Not found' });
      return reply.send({ id: row.id, ...row.data as object, _created_at: row.created_at, _updated_at: row.updated_at });
    },
  );

  // ── Create document ─────────────────────────────────────────────────────
  fastify.post<{ Params: { appId: string; collection: string }; Body: Record<string, unknown> }>(
    '/:appId/data/:collection',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { appId, collection } = request.params;
      const orgId = request.user!.orgId;
      const body = request.body ?? {};

      const row = await prisma.app_data.create({
        data: {
          app_id: appId,
          org_id: orgId,
          collection,
          data: body,
          created_by: request.user!.id,
        },
      });

      return reply.status(201).send({ id: row.id, ...row.data as object, _created_at: row.created_at });
    },
  );

  // ── Update document ─────────────────────────────────────────────────────
  fastify.put<{ Params: { appId: string; collection: string; docId: string }; Body: Record<string, unknown> }>(
    '/:appId/data/:collection/:docId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { appId, collection, docId } = request.params;
      const orgId = request.user!.orgId;

      const existing = await prisma.app_data.findFirst({
        where: { id: docId, app_id: appId, org_id: orgId, collection },
      });
      if (!existing) return reply.status(404).send({ error: 'Not found' });

      const row = await prisma.app_data.update({
        where: { id: docId },
        data: { data: request.body ?? {} },
      });

      return reply.send({ id: row.id, ...row.data as object, _updated_at: row.updated_at });
    },
  );

  // ── Patch document (merge) ──────────────────────────────────────────────
  fastify.patch<{ Params: { appId: string; collection: string; docId: string }; Body: Record<string, unknown> }>(
    '/:appId/data/:collection/:docId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { appId, collection, docId } = request.params;
      const orgId = request.user!.orgId;

      const existing = await prisma.app_data.findFirst({
        where: { id: docId, app_id: appId, org_id: orgId, collection },
      });
      if (!existing) return reply.status(404).send({ error: 'Not found' });

      const merged = { ...(existing.data as object), ...request.body };
      const row = await prisma.app_data.update({
        where: { id: docId },
        data: { data: merged },
      });

      return reply.send({ id: row.id, ...row.data as object, _updated_at: row.updated_at });
    },
  );

  // ── Delete document ─────────────────────────────────────────────────────
  fastify.delete<{ Params: { appId: string; collection: string; docId: string } }>(
    '/:appId/data/:collection/:docId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { appId, collection, docId } = request.params;
      const orgId = request.user!.orgId;

      const existing = await prisma.app_data.findFirst({
        where: { id: docId, app_id: appId, org_id: orgId, collection },
      });
      if (!existing) return reply.status(404).send({ error: 'Not found' });

      await prisma.app_data.delete({ where: { id: docId } });
      return reply.status(204).send();
    },
  );

  // ── Aggregate ───────────────────────────────────────────────────────────
  fastify.post<{
    Params: { appId: string; collection: string };
    Body: {
      groupBy?: string;
      sum?: string | string[];
      avg?: string | string[];
      count?: boolean;
      min?: string | string[];
      max?: string | string[];
      where?: Record<string, unknown>;
      orderBy?: string;
      order?: string;
      limit?: number;
    };
  }>(
    '/:appId/data/:collection/aggregate',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { appId, collection } = request.params;
      const orgId = request.user!.orgId;
      const { groupBy, sum, avg, count, min, max, where, orderBy, order, limit } = request.body;

      // Build raw SQL for aggregation on JSONB
      const params: unknown[] = [appId, orgId, collection];
      let paramIdx = 4;

      // WHERE clause from filter
      let whereClause = '';
      if (where && typeof where === 'object') {
        for (const [key, value] of Object.entries(where)) {
          if (key.endsWith('_gt')) {
            const field = key.slice(0, -3);
            whereClause += ` AND (data->>'${sanitizeKey(field)}')::numeric > $${paramIdx}`;
            params.push(value); paramIdx++;
          } else if (key.endsWith('_gte')) {
            const field = key.slice(0, -4);
            whereClause += ` AND (data->>'${sanitizeKey(field)}')::numeric >= $${paramIdx}`;
            params.push(value); paramIdx++;
          } else if (key.endsWith('_lt')) {
            const field = key.slice(0, -3);
            whereClause += ` AND (data->>'${sanitizeKey(field)}')::numeric < $${paramIdx}`;
            params.push(value); paramIdx++;
          } else if (key.endsWith('_lte')) {
            const field = key.slice(0, -4);
            whereClause += ` AND (data->>'${sanitizeKey(field)}')::numeric <= $${paramIdx}`;
            params.push(value); paramIdx++;
          } else {
            whereClause += ` AND data->>'${sanitizeKey(key)}' = $${paramIdx}`;
            params.push(String(value)); paramIdx++;
          }
        }
      }

      // SELECT clause
      const selects: string[] = [];
      if (groupBy) selects.push(`data->>'${sanitizeKey(groupBy)}' AS "${sanitizeKey(groupBy)}"`);
      if (count) selects.push('COUNT(*)::int AS count');

      for (const field of toArray(sum)) {
        selects.push(`SUM((data->>'${sanitizeKey(field)}')::numeric) AS "sum_${sanitizeKey(field)}"`);
      }
      for (const field of toArray(avg)) {
        selects.push(`ROUND(AVG((data->>'${sanitizeKey(field)}')::numeric), 2) AS "avg_${sanitizeKey(field)}"`);
      }
      for (const field of toArray(min)) {
        selects.push(`MIN((data->>'${sanitizeKey(field)}')::numeric) AS "min_${sanitizeKey(field)}"`);
      }
      for (const field of toArray(max)) {
        selects.push(`MAX((data->>'${sanitizeKey(field)}')::numeric) AS "max_${sanitizeKey(field)}"`);
      }

      if (selects.length === 0) selects.push('COUNT(*)::int AS count');

      let sql = `SELECT ${selects.join(', ')} FROM app_data WHERE app_id = $1 AND org_id = $2 AND collection = $3${whereClause}`;

      if (groupBy) sql += ` GROUP BY data->>'${sanitizeKey(groupBy)}'`;

      // ORDER BY
      if (orderBy) {
        const dir = order === 'asc' ? 'ASC' : 'DESC';
        if (orderBy === groupBy) {
          sql += ` ORDER BY data->>'${sanitizeKey(orderBy)}' ${dir}`;
        } else {
          // Order by an aggregate column
          sql += ` ORDER BY "${sanitizeKey(orderBy)}" ${dir}`;
        }
      }

      if (limit && limit > 0) sql += ` LIMIT ${Math.min(limit, 10000)}`;

      const result = await prisma.$queryRawUnsafe(sql, ...params);
      return reply.send({ data: result });
    },
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Sanitize a JSONB key to prevent SQL injection (alphanumeric + underscore only) */
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '');
}

/** Normalize string | string[] to string[] */
function toArray(val: string | string[] | undefined): string[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

/** Build Prisma-compatible JSONB path filters from a simple filter object */
function buildJsonFilters(where: Record<string, unknown>): Record<string, unknown> {
  const filters: any = {};
  for (const [key, value] of Object.entries(where)) {
    if (key.startsWith('_')) continue; // skip meta keys
    // Prisma JSONB path filter
    filters.data = { ...filters.data, path: [key], equals: value };
  }
  return filters.data ? { data: filters.data } : {};
}
