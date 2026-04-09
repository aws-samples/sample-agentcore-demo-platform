/**
 * Enterprise Skills Marketplace Routes
 *
 * GET    /api/skills/enterprise          — Browse/search enterprise catalog
 * GET    /api/skills/enterprise/categories — List categories
 * POST   /api/skills/enterprise/publish   — Publish an existing skill
 * POST   /api/skills/enterprise/import    — Import from skills.sh → enterprise
 * POST   /api/skills/enterprise/:id/install — Install to session workspace
 * POST   /api/skills/enterprise/:id/vote  — Vote on a skill
 * POST   /api/chat/sessions/:sessionId/skills/:skillName/publish — Publish from workspace
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { enterpriseSkillService } from '../services/enterprise-skill.service.js';
import { authenticate } from '../middleware/auth.js';

interface BrowseQuery {
  Querystring: {
    q?: string;
    category?: string;
    sort?: 'popular' | 'recent' | 'top-rated';
    page?: string;
    limit?: string;
  };
}

interface PublishBody {
  Body: { skillId: string; category?: string; visibility?: string };
}

interface ImportBody {
  Body: { installRef: string; category?: string };
}

interface InstallBody {
  Params: { id: string };
  Body: { sessionId: string };
}

interface VoteBody {
  Params: { id: string };
  Body: { vote: 1 | -1 };
}

interface PublishFromWorkspaceBody {
  Params: { sessionId: string; skillName: string };
  Body: { displayName?: string; description?: string; category?: string; group_ids?: string[] };
}

export async function enterpriseSkillsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/skills/enterprise — Browse
  fastify.get<BrowseQuery>(
    '/',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<BrowseQuery>, reply: FastifyReply) => {
      const { q, category, sort, page, limit } = request.query;
      const result = await enterpriseSkillService.browse(request.user!.orgId, {
        query: q,
        category,
        sort,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      }, request.user!);
      return reply.send(result);
    },
  );

  // GET /api/skills/enterprise/categories
  fastify.get(
    '/categories',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const categories = await enterpriseSkillService.getCategories(request.user!.orgId);
      return reply.send({ data: categories });
    },
  );

  // POST /api/skills/enterprise/publish
  fastify.post<PublishBody>(
    '/publish',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<PublishBody>, reply: FastifyReply) => {
      const { skillId, category, visibility } = request.body;
      if (!skillId) {
        return reply.status(400).send({ error: 'skillId is required', code: 'VALIDATION_ERROR' });
      }
      const result = await enterpriseSkillService.publish(request.user!.orgId, {
        skillId,
        userId: request.user!.id,
        category,
        visibility,
      });
      return reply.status(201).send({ data: result });
    },
  );

  // POST /api/skills/enterprise/import
  fastify.post<ImportBody>(
    '/import',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<ImportBody>, reply: FastifyReply) => {
      const { installRef, category } = request.body;
      if (!installRef) {
        return reply.status(400).send({ error: 'installRef is required', code: 'VALIDATION_ERROR' });
      }
      const result = await enterpriseSkillService.importFromExternal(request.user!.orgId, {
        installRef,
        userId: request.user!.id,
        category,
      });
      return reply.status(201).send({ data: result });
    },
  );

  // POST /api/skills/enterprise/:id/install
  fastify.post<InstallBody>(
    '/:id/install',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<InstallBody>, reply: FastifyReply) => {
      const { sessionId } = request.body;
      if (!sessionId) {
        return reply.status(400).send({ error: 'sessionId is required', code: 'VALIDATION_ERROR' });
      }
      await enterpriseSkillService.installToWorkspace(
        request.user!.orgId,
        request.params.id,
        sessionId,
      );
      return reply.send({ success: true });
    },
  );

  // POST /api/skills/enterprise/:id/vote
  fastify.post<VoteBody>(
    '/:id/vote',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<VoteBody>, reply: FastifyReply) => {
      const { vote } = request.body;
      if (vote !== 1 && vote !== -1) {
        return reply.status(400).send({ error: 'vote must be 1 or -1', code: 'VALIDATION_ERROR' });
      }
      const result = await enterpriseSkillService.vote(
        request.user!.orgId,
        request.params.id,
        request.user!.id,
        vote,
      );
      return reply.send({ data: result });
    },
  );
}

/**
 * Publish-from-workspace route (registered under /api/chat).
 */
export async function enterpriseSkillPublishRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<PublishFromWorkspaceBody>(
    '/sessions/:sessionId/skills/:skillName/publish',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<PublishFromWorkspaceBody>, reply: FastifyReply) => {
      const { sessionId, skillName } = request.params;
      const { displayName, description, category, group_ids } = request.body;
      const result = await enterpriseSkillService.publishFromWorkspace(request.user!.orgId, {
        sessionId,
        skillName,
        userId: request.user!.id,
        displayName,
        description,
        category,
      });

      // Grant access to selected user groups
      if (group_ids && group_ids.length > 0 && result.skillId) {
        const { userGroupRepository } = await import('../repositories/userGroup.repository.js');
        await userGroupRepository.grantSkillAccess(result.skillId, group_ids, request.user!.id);
      }

      return reply.status(201).send({ data: result });
    },
  );
}
