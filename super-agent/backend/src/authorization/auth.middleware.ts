/**
 * Authorization Middleware Factories
 *
 * Fastify preHandler factories that integrate the AuthorizationService
 * with route-level permission enforcement.
 *
 * Usage:
 *   fastify.delete('/agents/:id', {
 *     preHandler: [authenticate, requirePermission('agents:delete')],
 *   }, handler)
 *
 *   // With resource ownership check (resourceOwnerId resolved at request time):
 *   fastify.delete('/agents/:id', {
 *     preHandler: [
 *       authenticate,
 *       requirePermission('agents:delete', async (req) => ({
 *         resourceOwnerId: await getAgentOwner(req.params.id),
 *       })),
 *     ],
 *   }, handler)
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { authorizationService, type AuthorizationContext } from './authorization.js';
import type { Permission } from './permissions.js';

type ContextResolver = (
  request: FastifyRequest
) => AuthorizationContext | Promise<AuthorizationContext>;

/**
 * Creates a Fastify preHandler that enforces a single permission.
 * Optionally accepts a context resolver to supply resource ownership info.
 */
export function requirePermission(permission: Permission, resolveCtx?: ContextResolver) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        requestId: request.id,
      });
    }

    try {
      const ctx = resolveCtx ? await resolveCtx(request) : undefined;
      authorizationService.authorize(request.user, permission, ctx);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'You do not have permission to perform this action.';
      return reply.status(403).send({
        error: message,
        code: 'FORBIDDEN',
        requestId: request.id,
      });
    }
  };
}

/**
 * Creates a Fastify preHandler that requires ALL listed permissions.
 */
export function requireAllPermissions(permissions: Permission[], resolveCtx?: ContextResolver) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        requestId: request.id,
      });
    }

    try {
      const ctx = resolveCtx ? await resolveCtx(request) : undefined;
      for (const permission of permissions) {
        authorizationService.authorize(request.user, permission, ctx);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'You do not have permission to perform this action.';
      return reply.status(403).send({
        error: message,
        code: 'FORBIDDEN',
        requestId: request.id,
      });
    }
  };
}

/**
 * Creates a Fastify preHandler that requires AT LEAST ONE of the listed permissions.
 */
export function requireAnyPermission(permissions: Permission[], resolveCtx?: ContextResolver) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        requestId: request.id,
      });
    }

    const ctx = resolveCtx ? await resolveCtx(request) : undefined;
    const hasAny = authorizationService.canAny(request.user, permissions, ctx);

    if (!hasAny) {
      return reply.status(403).send({
        error: `You need one of the following permissions: ${permissions.join(', ')}`,
        code: 'FORBIDDEN',
        requestId: request.id,
      });
    }
  };
}
