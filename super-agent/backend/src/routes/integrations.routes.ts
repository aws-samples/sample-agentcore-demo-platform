/**
 * Integration Routes
 *
 * Endpoints for managing scope-level API integrations.
 * Users upload OpenAPI specs which are parsed into skills.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { skillService } from '../services/skill.service.js';
import { apiSpecParserService } from '../services/api-spec-parser.service.js';
import { authenticate } from '../middleware/auth.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

interface ScopeParam {
  Params: { scopeId: string };
}

interface UploadIntegrationRequest {
  Params: { scopeId: string };
  Body: {
    specContent: string;
    name?: string;
    description?: string;
  };
}

interface DeleteIntegrationRequest {
  Params: { scopeId: string; skillId: string };
}

export async function integrationRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/business-scopes/:scopeId/integrations
   * List all API integration skills for a business scope.
   */
  fastify.get<ScopeParam>(
    '/:scopeId/integrations',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<ScopeParam>, reply: FastifyReply) => {
      const skills = await skillService.getScopeLevelSkills(
        request.user!.orgId,
        request.params.scopeId,
      );
      return reply.status(200).send({ data: skills });
    },
  );

  /**
   * POST /api/business-scopes/:scopeId/integrations
   * Upload an OpenAPI spec to create a scope-level API integration skill.
   */
  fastify.post<UploadIntegrationRequest>(
    '/:scopeId/integrations',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<UploadIntegrationRequest>, reply: FastifyReply) => {
      const { scopeId } = request.params;
      const { specContent, name, description } = request.body;

      if (!specContent || typeof specContent !== 'string') {
        return reply.status(400).send({
          error: 'specContent is required (OpenAPI JSON or YAML string)',
          code: 'VALIDATION_ERROR',
        });
      }

      // Parse the spec
      let parsed;
      try {
        parsed = apiSpecParserService.parseAndGenerate(specContent);
      } catch (err) {
        return reply.status(400).send({
          error: `Failed to parse API spec: ${err instanceof Error ? err.message : 'Invalid format'}`,
          code: 'SPEC_PARSE_ERROR',
        });
      }

      const skillName = name || apiSpecParserService['slugify'](parsed.parsed.title);
      const skillDisplayName = name || parsed.parsed.title;

      // Check for duplicate name in this scope
      const existing = await skillService.findByName(request.user!.orgId, skillName);
      if (existing && existing.business_scope_id === scopeId) {
        return reply.status(409).send({
          error: `Integration "${skillName}" already exists in this scope`,
          code: 'DUPLICATE_INTEGRATION',
        });
      }

      // Create the scope-level skill
      const skill = await skillService.createScopeLevelSkill(
        request.user!.orgId,
        scopeId,
        {
          name: skillName,
          display_name: skillDisplayName,
          description: description || parsed.parsed.description,
          version: parsed.parsed.version,
          tags: ['api_integration'],
          skillType: 'api_integration',
          metadata: {
            baseUrl: parsed.parsed.baseUrl,
            endpointCount: parsed.parsed.endpoints.length,
            specFormat: specContent.trim().startsWith('{') ? 'json' : 'yaml',
          },
        },
      );

      // Write SKILL.md to local path
      const skillDir = join(process.cwd(), 'data', 'skills', skill.hash_id);
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, 'SKILL.md'), parsed.skillMd, 'utf-8');

      // Store the raw spec for future reference
      await writeFile(join(skillDir, 'openapi-spec.json'), specContent, 'utf-8');

      // Update metadata with local path
      await skillService.updateSkill(request.user!.orgId, skill.id, {
        metadata: {
          ...(skill.metadata as Record<string, unknown>),
          localPath: skillDir,
          baseUrl: parsed.parsed.baseUrl,
          endpointCount: parsed.parsed.endpoints.length,
        },
      });

      return reply.status(201).send({
        data: {
          ...skill,
          parsedSpec: {
            title: parsed.parsed.title,
            baseUrl: parsed.parsed.baseUrl,
            endpointCount: parsed.parsed.endpoints.length,
            auth: parsed.parsed.auth,
          },
        },
      });
    },
  );

  /**
   * DELETE /api/business-scopes/:scopeId/integrations/:skillId
   * Remove an API integration skill from a business scope.
   */
  fastify.delete<DeleteIntegrationRequest>(
    '/:scopeId/integrations/:skillId',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<DeleteIntegrationRequest>, reply: FastifyReply) => {
      const deleted = await skillService.deleteScopeLevelSkill(
        request.user!.orgId,
        request.params.skillId,
      );
      if (!deleted) {
        return reply.status(404).send({
          error: 'Integration not found',
          code: 'INTEGRATION_NOT_FOUND',
        });
      }
      return reply.status(204).send();
    },
  );
}
