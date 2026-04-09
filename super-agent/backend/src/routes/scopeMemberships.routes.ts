/**
 * Scope Membership Routes
 *
 * API endpoints for managing scope-level access control.
 * Allows scope admins (and org admins/owners) to manage who can access each scope.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { requireScopeAccess } from '../middleware/scopeAccess.js';
import { scopeAccessService } from '../services/scopeAccess.service.js';
import { scopeMembershipRepository, type ScopeRole } from '../repositories/scopeMembership.repository.js';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

interface ScopeParams { id: string }
interface MemberParams { id: string; membershipId: string }
interface AddMemberBody { user_id: string; role?: ScopeRole }
interface UpdateRoleBody { role: ScopeRole }
interface UpdateVisibilityBody { visibility: 'open' | 'restricted' }

export async function scopeMembershipRoutes(fastify: FastifyInstance): Promise<void> {

  /**
   * GET /api/business-scopes/:id/members
   * List all members of a scope. Requires at least viewer access.
   */
  fastify.get<{ Params: ScopeParams }>(
    '/:id/members',
    { preHandler: [authenticate, requireScopeAccess('viewer')] },
    async (request: FastifyRequest<{ Params: ScopeParams }>, reply: FastifyReply) => {
      const members = await scopeAccessService.getScopeMembers(request.params.id);

      // Enrich with user info
      const userIds = members.map((m) => m.user_id);
      const profiles = await prisma.profiles.findMany({
        where: { id: { in: userIds } },
        select: { id: true, full_name: true, username: true, avatar_url: true },
      });
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      const enriched = members.map((m) => {
        const profile = profileMap.get(m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          name: profile?.full_name || profile?.username || null,
          email: profile?.username || null,
          avatar_url: profile?.avatar_url || null,
          created_at: m.created_at,
        };
      });

      return reply.status(200).send({ data: enriched });
    },
  );

  /**
   * POST /api/business-scopes/:id/members
   * Add a member to a scope. Requires scope admin access.
   */
  fastify.post<{ Params: ScopeParams; Body: AddMemberBody }>(
    '/:id/members',
    {
      preHandler: [authenticate, requireScopeAccess('admin')],
      schema: {
        body: {
          type: 'object',
          required: ['user_id'],
          properties: {
            user_id: { type: 'string', format: 'uuid' },
            role: { type: 'string', enum: ['admin', 'member', 'viewer'], default: 'viewer' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ScopeParams; Body: AddMemberBody }>, reply: FastifyReply) => {
      const { id: scopeId } = request.params;
      const { user_id, role } = request.body;
      const orgId = request.user!.orgId;

      // Verify user is in the same org
      const membership = await prisma.memberships.findFirst({
        where: { organization_id: orgId, user_id },
      });
      if (!membership) {
        throw AppError.notFound('User is not a member of this organization.');
      }

      try {
        const scopeMembership = await scopeAccessService.addMember(
          orgId, scopeId, user_id, role ?? 'viewer',
        );
        return reply.status(201).send(scopeMembership);
      } catch (err: unknown) {
        // Handle unique constraint violation (already a member)
        if ((err as { code?: string }).code === 'P2002') {
          throw AppError.conflict('User is already a member of this scope.');
        }
        throw err;
      }
    },
  );

  /**
   * PATCH /api/business-scopes/:id/members/:membershipId
   * Update a member's scope role. Requires scope admin access.
   */
  fastify.patch<{ Params: MemberParams; Body: UpdateRoleBody }>(
    '/:id/members/:membershipId',
    {
      preHandler: [authenticate, requireScopeAccess('admin')],
      schema: {
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['admin', 'member', 'viewer'] },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: MemberParams; Body: UpdateRoleBody }>, reply: FastifyReply) => {
      const updated = await scopeAccessService.updateMemberRole(
        request.params.membershipId,
        request.body.role,
      );
      return reply.status(200).send(updated);
    },
  );

  /**
   * DELETE /api/business-scopes/:id/members/:membershipId
   * Remove a member from a scope. Requires scope admin access.
   */
  fastify.delete<{ Params: MemberParams }>(
    '/:id/members/:membershipId',
    { preHandler: [authenticate, requireScopeAccess('admin')] },
    async (request: FastifyRequest<{ Params: MemberParams }>, reply: FastifyReply) => {
      await scopeAccessService.removeMember(request.params.membershipId);
      return reply.status(204).send();
    },
  );

  /**
   * PATCH /api/business-scopes/:id/visibility
   * Update scope visibility (open/restricted). Requires scope admin access.
   */
  fastify.patch<{ Params: ScopeParams; Body: UpdateVisibilityBody }>(
    '/:id/visibility',
    {
      preHandler: [authenticate, requireScopeAccess('admin')],
      schema: {
        body: {
          type: 'object',
          required: ['visibility'],
          properties: {
            visibility: { type: 'string', enum: ['open', 'restricted'] },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: ScopeParams; Body: UpdateVisibilityBody }>, reply: FastifyReply) => {
      const { id } = request.params;
      const orgId = request.user!.orgId;

      await prisma.business_scopes.update({
        where: { id },
        data: { visibility: request.body.visibility },
      });

      return reply.status(200).send({ id, visibility: request.body.visibility });
    },
  );
}
