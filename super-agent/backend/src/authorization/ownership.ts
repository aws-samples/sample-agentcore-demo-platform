/**
 * Resource ownership resolvers
 *
 * Context resolvers for `requirePermission(...)` that look up who owns the
 * resource named in the route params, scoped to the caller's organization.
 *
 * A resource that is missing, belongs to another organization, or has no
 * recorded owner resolves to `resourceOwnerId: null`. AuthorizationService
 * then denies owner-only permissions for non-admin roles, while admins and
 * owners fall through to the handler (which returns the usual 404).
 */

import type { FastifyRequest } from 'fastify';
import { prisma } from '../config/database.js';
import type { AuthorizationContext } from './authorization.js';

type OwnerLookup = (id: string, organizationId: string) => Promise<string | null | undefined>;

function ownerResolver(param: string, lookup: OwnerLookup) {
  return async (request: FastifyRequest): Promise<AuthorizationContext> => {
    const id = (request.params as Record<string, string> | undefined)?.[param];
    const orgId = request.user?.orgId;
    if (!id || !orgId) return { resourceOwnerId: null };
    try {
      return { resourceOwnerId: (await lookup(id, orgId)) ?? null };
    } catch {
      // Malformed IDs (e.g. not a UUID) make Prisma throw; treat as unowned.
      return { resourceOwnerId: null };
    }
  };
}

export const workflowOwner = ownerResolver(
  'id',
  async (id, organization_id) =>
    (
      await prisma.workflows.findFirst({
        where: { id, organization_id },
        select: { created_by: true },
      })
    )?.created_by
);

export const taskOwner = ownerResolver(
  'id',
  async (id, organization_id) =>
    (await prisma.tasks.findFirst({ where: { id, organization_id }, select: { created_by: true } }))
      ?.created_by
);

export const documentOwner = ownerResolver(
  'id',
  async (id, organization_id) =>
    (
      await prisma.documents.findFirst({
        where: { id, organization_id },
        select: { created_by: true },
      })
    )?.created_by
);

export const apiKeyOwner = ownerResolver(
  'keyId',
  async (id, organization_id) =>
    (await prisma.api_keys.findFirst({ where: { id, organization_id }, select: { user_id: true } }))
      ?.user_id
);
