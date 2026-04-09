/**
 * MCP Server Routes
 * REST API endpoints for MCP Server management.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mcpServerService } from '../services/mcp.service.js';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';
import {
  createMcpServerSchema,
  updateMcpServerSchema,
  mcpServerFilterSchema,
  mcpServerTestRequestSchema,
  type CreateMcpServerInput,
  type UpdateMcpServerInput,
  type McpServerFilter,
  type McpServerTestRequest,
} from '../schemas/mcp.schema.js';
import { paginationSchema, idParamSchema } from '../schemas/common.schema.js';
import { ZodError } from 'zod';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Request types for route handlers
 */
interface GetMcpServersRequest {
  Querystring: McpServerFilter & { page?: number; limit?: number };
}

interface GetMcpServerByIdRequest {
  Params: { id: string };
}

interface CreateMcpServerRequest {
  Body: CreateMcpServerInput;
}

interface UpdateMcpServerRequest {
  Params: { id: string };
  Body: UpdateMcpServerInput;
}

interface DeleteMcpServerRequest {
  Params: { id: string };
}

interface TestMcpServerRequest {
  Params: { id: string };
  Body: McpServerTestRequest;
}

/**
 * Parse and validate Zod schema, throwing AppError on failure
 */
function validateSchema<T>(schema: { parse: (data: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw AppError.validation('Validation failed', error.issues);
    }
    throw error;
  }
}

/**
 * Register MCP server routes on the Fastify instance.
 * All routes require authentication and filter by organization_id.
 */
export async function mcpRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/mcp/servers
   * Get all MCP servers for the authenticated user's organization.
   * Supports filtering by status and name.
   * Requirements: 9.1
   */
  fastify.get<GetMcpServersRequest>(
    '/servers',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all MCP servers for the organization',
        tags: ['MCP'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['active', 'inactive', 'error'] },
            name: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array' },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<GetMcpServersRequest>, reply: FastifyReply) => {
      const { page, limit, ...filterParams } = request.query;

      // Validate filters
      const filters = validateSchema(mcpServerFilterSchema, filterParams);
      const pagination = validateSchema(paginationSchema, { page, limit });

      const result = await mcpServerService.getMcpServers(request.user!.orgId, filters, pagination);

      return reply.status(200).send(result);
    }
  );

  /**
   * GET /api/mcp/servers/:id
   * Get a single MCP server by ID.
   * Requirements: 9.1
   */
  fastify.get<GetMcpServerByIdRequest>(
    '/servers/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get an MCP server by ID',
        tags: ['MCP'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              host_address: { type: 'string' },
              oauth_secret_id: { type: 'string', nullable: true },
              headers: { type: 'object' },
              config: { type: 'object', nullable: true },
              status: { type: 'string' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<GetMcpServerByIdRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);

      const server = await mcpServerService.getMcpServerById(id, request.user!.orgId);

      return reply.status(200).send(server);
    }
  );

  /**
   * POST /api/mcp/servers
   * Create a new MCP server.
   * Requirements: 9.2
   */
  fastify.post<CreateMcpServerRequest>(
    '/servers',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Create a new MCP server',
        tags: ['MCP'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'host_address'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000, nullable: true },
            host_address: { type: 'string' },
            oauth_secret_id: { type: 'string', format: 'uuid', nullable: true },
            headers: { type: 'object', additionalProperties: { type: 'string' }, default: {} },
            config: { type: 'object', nullable: true },
            status: { type: 'string', enum: ['active', 'inactive', 'error'], default: 'inactive' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              host_address: { type: 'string' },
              status: { type: 'string' },
              created_at: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              details: { type: 'array' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<CreateMcpServerRequest>, reply: FastifyReply) => {
      const data = validateSchema(createMcpServerSchema, request.body);

      const server = await mcpServerService.createMcpServer(data, request.user!.orgId);

      return reply.status(201).send(server);
    }
  );

  /**
   * PUT /api/mcp/servers/:id
   * Update an existing MCP server.
   * Requirements: 9.3
   */
  fastify.put<UpdateMcpServerRequest>(
    '/servers/:id',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Update an MCP server',
        tags: ['MCP'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000, nullable: true },
            host_address: { type: 'string' },
            oauth_secret_id: { type: 'string', format: 'uuid', nullable: true },
            headers: { type: 'object', additionalProperties: { type: 'string' } },
            config: { type: 'object', nullable: true },
            status: { type: 'string', enum: ['active', 'inactive', 'error'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              host_address: { type: 'string' },
              status: { type: 'string' },
              updated_at: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<UpdateMcpServerRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);
      const data = validateSchema(updateMcpServerSchema, request.body);

      const server = await mcpServerService.updateMcpServer(id, data, request.user!.orgId);

      return reply.status(200).send(server);
    }
  );

  /**
   * DELETE /api/mcp/servers/:id
   * Delete an MCP server.
   * Requirements: 9.4
   */
  fastify.delete<DeleteMcpServerRequest>(
    '/servers/:id',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Delete an MCP server',
        tags: ['MCP'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: {
            type: 'null',
            description: 'MCP server deleted successfully',
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<DeleteMcpServerRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);

      await mcpServerService.deleteMcpServer(id, request.user!.orgId);

      return reply.status(204).send();
    }
  );

  /**
   * POST /api/mcp/servers/:id/test
   * Test connection to an MCP server.
   * Requirements: 9.5
   */
  fastify.post<TestMcpServerRequest>(
    '/servers/:id/test',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Test connection to an MCP server',
        tags: ['MCP'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        // body is optional — defaults handled in handler via mcpServerTestRequestSchema
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              latency_ms: { type: 'number' },
              error: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<TestMcpServerRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);
      const { timeout_ms } = validateSchema(mcpServerTestRequestSchema, request.body || {});

      const result = await mcpServerService.testMcpServerConnection(
        id,
        request.user!.orgId,
        timeout_ms
      );

      return reply.status(200).send(result);
    }
  );
}
