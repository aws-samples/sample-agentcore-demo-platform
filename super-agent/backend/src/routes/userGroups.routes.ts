/**
 * User Group Routes
 * CRUD for user groups + member management + skill/MCP access grants.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';
import { userGroupRepository } from '../repositories/userGroup.repository.js';
import { prisma } from '../config/database.js';

export async function userGroupRoutes(fastify: FastifyInstance): Promise<void> {

  // ── Group CRUD ──

  /** GET /api/user-groups — List all groups in the org */
  fastify.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const groups = await userGroupRepository.findAll(request.user!.orgId);

    // Enrich members with profile info
    const allUserIds = new Set<string>();
    for (const g of groups) {
      for (const m of g.members) allUserIds.add(m.user_id);
    }
    const profiles = allUserIds.size > 0
      ? await prisma.profiles.findMany({
          where: { id: { in: [...allUserIds] } },
          select: { id: true, full_name: true, username: true },
        })
      : [];
    const profileMap = new Map(profiles.map(p => [p.id, p]));

    const enriched = groups.map(g => ({
      ...g,
      members: g.members.map(m => ({
        ...m,
        user: profileMap.get(m.user_id) ?? null,
      })),
      member_count: g._count?.members ?? g.members.length,
    }));

    return reply.status(200).send({ data: enriched });
  });

  /** GET /api/user-groups/:id — Get group details */
  fastify.get<{ Params: { id: string } }>(
    '/:id', { preHandler: [authenticate] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const group = await userGroupRepository.findById(request.params.id, request.user!.orgId);
      if (!group) return reply.status(404).send({ error: 'Group not found' });

      // Enrich members
      const userIds = group.members.map(m => m.user_id);
      const profiles = userIds.length > 0
        ? await prisma.profiles.findMany({
            where: { id: { in: userIds } },
            select: { id: true, full_name: true, username: true },
          })
        : [];
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      // Get skill and MCP access grants
      const [skillGroupIds, mcpGroupIds] = await Promise.all([
        prisma.skill_group_access.findMany({
          where: { group_id: group.id },
          include: { skill: { select: { id: true, name: true, display_name: true } } },
        }),
        prisma.mcp_group_access.findMany({
          where: { group_id: group.id },
          include: { mcp_server: { select: { id: true, name: true, description: true } } },
        }),
      ]);

      return reply.status(200).send({
        ...group,
        members: group.members.map(m => ({ ...m, user: profileMap.get(m.user_id) ?? null })),
        member_count: group._count?.members ?? group.members.length,
        skills: skillGroupIds.map(s => s.skill),
        mcp_servers: mcpGroupIds.map(m => m.mcp_server),
      });
    }
  );

  /** POST /api/user-groups — Create a group */
  fastify.post<{ Body: { name: string; description?: string } }>(
    '/', { preHandler: [authenticate, requireModifyAccess] },
    async (request: FastifyRequest<{ Body: { name: string; description?: string } }>, reply: FastifyReply) => {
      const { name, description } = request.body;
      if (!name?.trim()) return reply.status(400).send({ error: 'name is required' });

      try {
        const group = await userGroupRepository.create({
          organization_id: request.user!.orgId,
          name: name.trim(),
          description: description?.trim(),
          created_by: request.user!.id,
        });
        return reply.status(201).send(group);
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'P2002') {
          return reply.status(409).send({ error: 'A group with this name already exists' });
        }
        throw err;
      }
    }
  );

  /** PUT /api/user-groups/:id — Update a group */
  fastify.put<{ Params: { id: string }; Body: { name?: string; description?: string } }>(
    '/:id', { preHandler: [authenticate, requireModifyAccess] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { name?: string; description?: string } }>, reply: FastifyReply) => {
      const updated = await userGroupRepository.update(request.params.id, request.user!.orgId, request.body);
      if (!updated) return reply.status(404).send({ error: 'Group not found' });
      return reply.status(200).send(updated);
    }
  );

  /** DELETE /api/user-groups/:id — Delete a group */
  fastify.delete<{ Params: { id: string } }>(
    '/:id', { preHandler: [authenticate, requireModifyAccess] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const deleted = await userGroupRepository.delete(request.params.id, request.user!.orgId);
      if (!deleted) return reply.status(404).send({ error: 'Group not found' });
      return reply.status(204).send();
    }
  );

  // ── Member management ──

  /** POST /api/user-groups/:id/members — Add member */
  fastify.post<{ Params: { id: string }; Body: { user_id: string } }>(
    '/:id/members', { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      const group = await userGroupRepository.findById(request.params.id, request.user!.orgId);
      if (!group) return reply.status(404).send({ error: 'Group not found' });

      const member = await userGroupRepository.addMember(
        request.params.id, request.body.user_id, request.user!.id,
      );
      return reply.status(201).send(member);
    }
  );

  /** DELETE /api/user-groups/:id/members/:userId — Remove member */
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/:id/members/:userId', { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      await userGroupRepository.removeMember(request.params.id, request.params.userId);
      return reply.status(204).send();
    }
  );

  /** GET /api/user-groups/my-groups — Get groups for the current user */
  fastify.get('/my-groups', { preHandler: [authenticate] }, async (request, reply) => {
    const groups = await userGroupRepository.getGroupsForUser(request.user!.orgId, request.user!.id);
    return reply.status(200).send({ data: groups });
  });

  // ── Skill access grants ──

  /** PUT /api/user-groups/skills/:skillId/access — Set which groups can access a skill */
  fastify.put<{ Params: { skillId: string }; Body: { group_ids: string[] } }>(
    '/skills/:skillId/access', { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      await userGroupRepository.grantSkillAccess(
        request.params.skillId, request.body.group_ids, request.user!.id,
      );
      return reply.status(200).send({ ok: true, group_ids: request.body.group_ids });
    }
  );

  /** GET /api/user-groups/skills/:skillId/access — Get groups that can access a skill */
  fastify.get<{ Params: { skillId: string } }>(
    '/skills/:skillId/access', { preHandler: [authenticate] },
    async (request, reply) => {
      const groupIds = await userGroupRepository.getSkillGroupIds(request.params.skillId);
      return reply.status(200).send({ group_ids: groupIds });
    }
  );

  // ── MCP access grants ──

  /** PUT /api/user-groups/mcp/:mcpId/access — Set which groups can access an MCP server */
  fastify.put<{ Params: { mcpId: string }; Body: { group_ids: string[] } }>(
    '/mcp/:mcpId/access', { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      await userGroupRepository.grantMcpAccess(
        request.params.mcpId, request.body.group_ids, request.user!.id,
      );
      return reply.status(200).send({ ok: true, group_ids: request.body.group_ids });
    }
  );

  /** GET /api/user-groups/mcp/:mcpId/access — Get groups that can access an MCP server */
  fastify.get<{ Params: { mcpId: string } }>(
    '/mcp/:mcpId/access', { preHandler: [authenticate] },
    async (request, reply) => {
      const groupIds = await userGroupRepository.getMcpGroupIds(request.params.mcpId);
      return reply.status(200).send({ group_ids: groupIds });
    }
  );
}
