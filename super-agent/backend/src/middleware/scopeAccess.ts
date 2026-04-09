/**
 * Scope Access Middleware
 *
 * Fastify preHandler factories that enforce scope-level access control.
 * Use after the `authenticate` middleware.
 *
 * Usage:
 *   fastify.get('/:id/agents', {
 *     preHandler: [authenticate, requireScopeAccess('viewer')],
 *   }, handler)
 *
 * The middleware reads the scope ID from:
 *   1. request.params.id (for /business-scopes/:id/... routes)
 *   2. request.params.scopeId (for routes with explicit scopeId param)
 *   3. request.body.business_scope_id (for POST requests like chat/stream)
 *   4. request.query.scope_id (for query-based filtering)
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { scopeAccessService, type ScopeAccessLevel } from '../services/scopeAccess.service.js';

type ScopeIdExtractor = (request: FastifyRequest) => string | undefined;

/**
 * Default scope ID extractor — tries params, body, query in order.
 */
const defaultExtractor: ScopeIdExtractor = (request) => {
  const params = request.params as Record<string, string>;
  const body = request.body as Record<string, string> | undefined;
  const query = request.query as Record<string, string>;

  return params?.id || params?.scopeId || body?.business_scope_id || query?.scope_id;
};

/**
 * Creates a Fastify preHandler that enforces scope-level access.
 *
 * @param minLevel - Minimum access level required ('viewer', 'member', or 'admin')
 * @param extractScopeId - Optional custom scope ID extractor
 */
export function requireScopeAccess(
  minLevel: ScopeAccessLevel = 'viewer',
  extractScopeId?: ScopeIdExtractor,
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        requestId: request.id,
      });
    }

    const scopeId = (extractScopeId ?? defaultExtractor)(request);
    if (!scopeId) {
      // No scope ID in request — skip scope check (route doesn't target a specific scope)
      return;
    }

    try {
      await scopeAccessService.requireAccess(request.user, scopeId, minLevel);
    } catch {
      return reply.status(403).send({
        error: 'You do not have access to this business scope.',
        code: 'SCOPE_ACCESS_DENIED',
        requestId: request.id,
      });
    }
  };
}
