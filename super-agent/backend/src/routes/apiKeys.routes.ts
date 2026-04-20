/**
 * API Keys Routes
 * Management endpoints for API keys.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { apiKeyService } from '../services/apiKey.service.js';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';

// ============================================================================
// Schemas
// ============================================================================

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).optional(),
  rateLimitPerMinute: z.number().int().min(1).max(1000).optional(),
  expiresAt: z.string().datetime().optional(),
});

const apiKeyIdParamSchema = z.object({
  keyId: z.string().uuid(),
});

// ============================================================================
// Types
// ============================================================================

interface CreateApiKeyRequest {
  Body: {
    name: string;
    scopes?: string[];
    rateLimitPerMinute?: number;
    expiresAt?: string;
  };
}

interface ApiKeyIdRequest {
  Params: { keyId: string };
}

// ============================================================================
// Route Registration
// ============================================================================

export async function apiKeysRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/api-keys
   * List all API keys for the organization
   */
  fastify.get(
    '/api-keys',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List API keys',
        tags: ['API Keys'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    keyPrefix: { type: 'string' },
                    scopes: { type: 'array', items: { type: 'string' } },
                    rateLimitPerMinute: { type: 'integer' },
                    isActive: { type: 'boolean' },
                    lastUsedAt: { type: 'string', nullable: true },
                    expiresAt: { type: 'string', nullable: true },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const keys = await apiKeyService.listApiKeys(request.user!.orgId);

      return reply.status(200).send({
        data: keys.map(k => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          scopes: k.scopes,
          rateLimitPerMinute: k.rateLimitPerMinute,
          isActive: k.isActive,
          lastUsedAt: k.lastUsedAt?.toISOString() || null,
          expiresAt: k.expiresAt?.toISOString() || null,
          createdAt: k.createdAt.toISOString(),
        })),
      });
    }
  );

  /**
   * POST /api/api-keys
   * Create a new API key
   */
  fastify.post<CreateApiKeyRequest>(
    '/api-keys',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Create API key',
        tags: ['API Keys'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            scopes: { type: 'array', items: { type: 'string' } },
            rateLimitPerMinute: { type: 'integer', minimum: 1, maximum: 1000 },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              apiKey: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  keyPrefix: { type: 'string' },
                  scopes: { type: 'array', items: { type: 'string' } },
                  rateLimitPerMinute: { type: 'integer' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<CreateApiKeyRequest>, reply: FastifyReply) => {
      const body = createApiKeySchema.parse(request.body);

      const result = await apiKeyService.createApiKey(
        request.user!.orgId,
        request.user!.id,
        {
          name: body.name,
          scopes: body.scopes,
          rateLimitPerMinute: body.rateLimitPerMinute,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        }
      );

      return reply.status(201).send({
        apiKey: result.apiKey, // Only shown once!
        data: {
          id: result.data.id,
          name: result.data.name,
          keyPrefix: result.data.keyPrefix,
          scopes: result.data.scopes,
          rateLimitPerMinute: result.data.rateLimitPerMinute,
          isActive: result.data.isActive,
          lastUsedAt: null,
          expiresAt: result.data.expiresAt?.toISOString() || null,
          createdAt: result.data.createdAt.toISOString(),
        },
      });
    }
  );

  /**
   * POST /api/api-keys/:keyId/revoke
   * Revoke an API key (soft disable)
   */
  fastify.post<ApiKeyIdRequest>(
    '/api-keys/:keyId/revoke',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Revoke API key',
        tags: ['API Keys'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['keyId'],
          properties: {
            keyId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<ApiKeyIdRequest>, reply: FastifyReply) => {
      const { keyId } = apiKeyIdParamSchema.parse(request.params);

      await apiKeyService.revokeApiKey(keyId, request.user!.orgId);

      return reply.status(200).send({
        success: true,
        message: 'API key revoked',
      });
    }
  );

  /**
   * DELETE /api/api-keys/:keyId
   * Delete an API key permanently
   */
  fastify.delete<ApiKeyIdRequest>(
    '/api-keys/:keyId',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Delete API key',
        tags: ['API Keys'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['keyId'],
          properties: {
            keyId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<ApiKeyIdRequest>, reply: FastifyReply) => {
      const { keyId } = apiKeyIdParamSchema.parse(request.params);

      await apiKeyService.deleteApiKey(keyId, request.user!.orgId);

      return reply.status(200).send({
        success: true,
        message: 'API key deleted',
      });
    }
  );
}
