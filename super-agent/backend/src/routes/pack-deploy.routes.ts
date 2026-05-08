/**
 * Pack Deploy Routes — "领用" Industry Pack Scopes
 *
 * Allows users to browse available industry packs and deploy (provision)
 * specific scopes into their organization's workspace.
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { packDeployService } from '../services/pack-deploy.service.js';

export async function packDeployRoutes(fastify: FastifyInstance): Promise<void> {

  /**
   * GET /api/packs — List all available industry packs and their scopes
   *
   * Returns the catalog of deployable packs read from the file system.
   * No data is written to DB — this is purely a read operation.
   */
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const packs = await packDeployService.listAvailablePacks();
      return reply.send({ data: packs });
    } catch (err: any) {
      console.error('[pack-deploy] Failed to list packs:', err);
      return reply.status(500).send({ error: 'Failed to list available packs', code: 'PACK_LIST_ERROR' });
    }
  });

  /**
   * POST /api/packs/deploy — Deploy a pack scope into the organization
   *
   * This is the "领用" action. It reads the pack from file system and
   * creates all necessary DB records (scope, agents, skills, memories, SOP).
   *
   * Body:
   *   - packId: string (e.g. "customer-service")
   *   - scopeDirName: string (e.g. "ticket-processing")
   *   - customName?: string (optional override for the scope name)
   */
  fastify.post<{
    Body: {
      packId: string;
      scopeDirName: string;
      customName?: string;
    }
  }>('/deploy', { preHandler: [authenticate] }, async (request, reply) => {
    const { packId, scopeDirName, customName } = request.body;

    if (!packId || !scopeDirName) {
      return reply.status(400).send({
        error: 'packId and scopeDirName are required',
        code: 'INVALID_INPUT',
      });
    }

    try {
      const result = await packDeployService.deploy({
        organizationId: request.user!.orgId,
        userId: request.user!.id,
        packId,
        scopeDirName,
        customName,
      });

      return reply.status(201).send({ data: result });
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        // Find the existing scope and return its ID so frontend can navigate
        const existingScope = await packDeployService.findDeployedScope(
          request.user!.orgId, packId, scopeDirName
        );
        return reply.status(409).send({
          error: err.message,
          code: 'SCOPE_EXISTS',
          data: existingScope ? { scopeId: existingScope.id, scopeName: existingScope.name } : undefined,
        });
      }
      if (err.message?.includes('not found')) {
        return reply.status(404).send({ error: err.message, code: 'NOT_FOUND' });
      }
      console.error('[pack-deploy] Deploy failed:', err);
      return reply.status(500).send({ error: 'Deploy failed', code: 'DEPLOY_ERROR' });
    }
  });

  /**
   * GET /api/packs/status/:packId/:scopeDirName — Check if a scope is already deployed
   */
  fastify.get<{
    Params: { packId: string; scopeDirName: string }
  }>('/status/:packId/:scopeDirName', { preHandler: [authenticate] }, async (request, reply) => {
    const { packId, scopeDirName } = request.params;

    const deployed = await packDeployService.isDeployed(
      request.user!.orgId,
      packId,
      scopeDirName,
    );

    return reply.send({ data: { deployed } });
  });
}
