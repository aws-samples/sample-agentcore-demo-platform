/**
 * Skill Marketplace Routes
 * REST API endpoints for browsing and installing skills from skills.sh marketplace.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { skillMarketplaceService } from '../services/skill-marketplace.service.js';
import { chatService } from '../services/chat.service.js';
import { workspaceManager } from '../services/workspace-manager.js';
import { authenticate } from '../middleware/auth.js';

interface SearchQuery { Querystring: { q: string } }
interface DetailQuery { Querystring: { ref: string } }
interface InstallBody {
  Body: {
    installRef: string;
    displayName?: string;
    description?: string;
    tags?: string[];
    assignToAgentId?: string;
    sessionId?: string;
  };
}

export async function skillMarketplaceRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/skills/marketplace/featured — popular/featured skills (no query needed)
  fastify.get('/featured', { preHandler: [authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const results = await skillMarketplaceService.featured();
      return reply.status(200).send({ data: results });
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to load featured skills', code: 'FEATURED_FAILED' });
    }
  });

  // GET /api/skills/marketplace/search?q=...
  fastify.get<SearchQuery>('/search', { preHandler: [authenticate] }, async (request: FastifyRequest<SearchQuery>, reply: FastifyReply) => {
    const query = request.query.q;
    if (!query || query.trim().length === 0) {
      return reply.status(400).send({ error: 'Query parameter "q" is required', code: 'MISSING_QUERY' });
    }
    const results = await skillMarketplaceService.search(query.trim());
    return reply.status(200).send({ data: results });
  });

  // GET /api/skills/marketplace/detail?ref=...
  fastify.get<DetailQuery>('/detail', { preHandler: [authenticate] }, async (request: FastifyRequest<DetailQuery>, reply: FastifyReply) => {
    const installRef = request.query.ref;
    if (!installRef || installRef.trim().length === 0) {
      return reply.status(400).send({ error: 'Query parameter "ref" is required', code: 'MISSING_REF' });
    }
    const detail = await skillMarketplaceService.getDetail(installRef.trim());
    if (!detail) {
      return reply.status(404).send({ error: `Skill not found: ${installRef}`, code: 'SKILL_NOT_FOUND' });
    }
    return reply.status(200).send({ data: detail });
  });

  // POST /api/skills/marketplace/install
  fastify.post<InstallBody>('/install', { preHandler: [authenticate] }, async (request: FastifyRequest<InstallBody>, reply: FastifyReply) => {
    const { installRef, displayName, description, tags, assignToAgentId, sessionId } = request.body;
    if (!installRef || installRef.trim().length === 0) {
      return reply.status(400).send({ error: 'installRef is required', code: 'MISSING_INSTALL_REF' });
    }

    let result;
    try {
      result = await skillMarketplaceService.install({
        organizationId: request.user!.orgId,
        installRef: installRef.trim(),
        displayName,
        description,
        tags,
        assignToAgentId,
        userId: request.user!.id,
      });
    } catch (err) {
      request.log.error({ err, installRef }, 'Skill marketplace install failed');
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'Failed to install skill',
        code: 'INSTALL_FAILED',
      });
    }

    // Copy skill into session workspace so it appears in the installed list
    if (sessionId) {
      try {
        const session = await chatService.getSessionById(sessionId, request.user!.orgId);
        if (session.business_scope_id) {
          await workspaceManager.installSkillToWorkspace(
            request.user!.orgId,
            session.business_scope_id,
            sessionId,
            result.name,
            result.localPath,
          );

          // In agentcore mode, also write skill files directly to the container
          const { config: appConfig } = await import('../config/index.js');
          if (appConfig.agentRuntime === 'agentcore') {
            try {
              const { agentCoreCommandService } = await import('../services/agentcore-command.service.js');
              const { readdir, readFile, stat } = await import('fs/promises');
              const { join } = await import('path');

              // Recursively write all skill files to the container
              const writeSkillFiles = async (srcDir: string, destPrefix: string): Promise<void> => {
                const entries = await readdir(srcDir, { withFileTypes: true });
                for (const entry of entries) {
                  const srcPath = join(srcDir, entry.name);
                  const destPath = `${destPrefix}/${entry.name}`;
                  if (entry.isDirectory()) {
                    await writeSkillFiles(srcPath, destPath);
                  } else {
                    const content = await readFile(srcPath, 'utf-8');
                    await agentCoreCommandService.writeFile(sessionId, destPath, content);
                  }
                }
              };

              await agentCoreCommandService.runCommand(sessionId,
                `mkdir -p /workspace/.claude/skills/${result.name}`
              );
              await writeSkillFiles(result.localPath, `.claude/skills/${result.name}`);
              request.log.info({ skillName: result.name, sessionId }, 'Skill synced to AgentCore container');
            } catch (cmdErr) {
              request.log.warn({ err: cmdErr, skillName: result.name }, 'Failed to sync skill to container (will sync on next invoke)');
            }
          }
        }
      } catch (err) {
        request.log.error({ err, sessionId, skillName: result.name }, 'Failed to copy skill to session workspace');
      }
    }

    return reply.status(201).send({ data: result });
  });
}
