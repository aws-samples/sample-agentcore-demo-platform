/**
 * Agent Routes
 * REST API endpoints for Agent management.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { agentService } from '../services/agent.service.js';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';
import {
  createAgentSchema,
  updateAgentSchema,
  agentFilterSchema,
  type CreateAgentInput,
  type UpdateAgentInput,
  type AgentFilter,
} from '../schemas/agent.schema.js';
import { paginationSchema, idParamSchema } from '../schemas/common.schema.js';
import { ZodError } from 'zod';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../config/database.js';

/**
 * Request types for route handlers
 */
interface GetAgentsRequest {
  Querystring: AgentFilter & { page?: number; limit?: number };
}

interface GetAgentByIdRequest {
  Params: { id: string };
}

interface CreateAgentRequest {
  Body: CreateAgentInput;
}

interface UpdateAgentRequest {
  Params: { id: string };
  Body: UpdateAgentInput;
}

interface DeleteAgentRequest {
  Params: { id: string };
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
 * Register agent routes on the Fastify instance.
 * All routes require authentication and filter by organization_id.
 */
export async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/agents
   * Get all agents for the authenticated user's organization.
   * Supports filtering by status and business_scope_id.
   * Requirements: 4.1, 4.7, 4.8
   */
  fastify.get<GetAgentsRequest>(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all agents for the organization',
        tags: ['Agents'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['active', 'busy', 'offline'] },
            business_scope_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: { 
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
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
    async (request: FastifyRequest<GetAgentsRequest>, reply: FastifyReply) => {
      const { page, limit, ...filterParams } = request.query;

      // Validate filters
      const filters = validateSchema(agentFilterSchema, filterParams);
      const pagination = validateSchema(paginationSchema, { page, limit });

      const result = await agentService.getAgents(request.user!.orgId, filters, pagination);

      return reply.status(200).send(result);
    }
  );

  /**
   * GET /api/agents/:id
   * Get a single agent by ID.
   * Requirements: 4.2
   */
  fastify.get<GetAgentByIdRequest>(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get an agent by ID',
        tags: ['Agents'],
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
            additionalProperties: true,
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              business_scope_id: { type: 'string', nullable: true },
              name: { type: 'string' },
              display_name: { type: 'string' },
              role: { type: 'string', nullable: true },
              avatar: { type: 'string', nullable: true },
              status: { type: 'string' },
              metrics: { type: 'object', additionalProperties: true },
              tools: { type: 'array', items: { type: 'object', additionalProperties: true } },
              scope: { type: 'array', items: { type: 'string' } },
              system_prompt: { type: 'string', nullable: true },
              model_config: { type: 'object', additionalProperties: true },
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
    async (request: FastifyRequest<GetAgentByIdRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);

      const agent = await agentService.getAgentById(id, request.user!.orgId);

      return reply.status(200).send(agent);
    }
  );

  /**
   * GET /api/agents/:id/events
   * Get execution log events for an agent (as source or target).
   */
  fastify.get<{ Params: { id: string }; Querystring: { limit?: number; event_type?: string } }>(
    '/:id/events',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get execution events for an agent',
        tags: ['Agents'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            event_type: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = validateSchema(idParamSchema, request.params);
      const orgId = request.user!.orgId;
      const limit = request.query.limit ?? 50;
      const eventType = request.query.event_type;

      // Fetch events where this agent is either the source or the target
      const where: Record<string, unknown> = {
        organization_id: orgId,
        OR: [{ agent_id: id }, { target_agent_id: id }],
      };
      if (eventType) {
        where.event_type = eventType;
      }

      const events = await prisma.agent_events.findMany({
        where: where as any,
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
          id: true,
          session_id: true,
          agent_id: true,
          target_agent_id: true,
          event_type: true,
          event_name: true,
          metadata: true,
          created_at: true,
        },
      });

      // Collect all referenced agent IDs to resolve display names
      const agentIdSet = new Set<string>();
      for (const e of events) {
        if (e.agent_id) agentIdSet.add(e.agent_id);
        if (e.target_agent_id) agentIdSet.add(e.target_agent_id);
      }
      const agentNames = new Map<string, string>();
      if (agentIdSet.size > 0) {
        const agents = await prisma.agents.findMany({
          where: { id: { in: Array.from(agentIdSet) }, organization_id: orgId },
          select: { id: true, display_name: true },
        });
        for (const a of agents) agentNames.set(a.id, a.display_name);
      }

      const data = events.map(e => ({
        id: e.id,
        sessionId: e.session_id,
        agentId: e.agent_id,
        agentName: e.agent_id ? agentNames.get(e.agent_id) ?? null : null,
        targetAgentId: e.target_agent_id,
        targetAgentName: e.target_agent_id ? agentNames.get(e.target_agent_id) ?? null : null,
        eventType: e.event_type,
        eventName: e.event_name,
        metadata: e.metadata,
        createdAt: e.created_at.toISOString(),
      }));

      return reply.status(200).send({ data });
    },
  );

  /**
   * POST /api/agents
   * Create a new agent.
   * Requirements: 4.3, 4.6
   */
  fastify.post<CreateAgentRequest>(
    '/',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Create a new agent',
        tags: ['Agents'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'display_name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            display_name: { type: 'string', minLength: 1, maxLength: 255 },
            business_scope_id: { type: 'string', format: 'uuid', nullable: true },
            role: { type: 'string', maxLength: 255, nullable: true },
            avatar: { type: 'string', nullable: true },
            status: {
              type: 'string',
              enum: ['active', 'busy', 'offline'],
              default: 'active',
            },
            metrics: { type: 'object', default: {} },
            tools: { type: 'array', default: [] },
            scope: { type: 'array', default: [] },
            system_prompt: { type: 'string', nullable: true },
            model_config: { type: 'object', default: {} },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              name: { type: 'string' },
              display_name: { type: 'string' },
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
    async (request: FastifyRequest<CreateAgentRequest>, reply: FastifyReply) => {
      const data = validateSchema(createAgentSchema, request.body);

      const agent = await agentService.createAgent(data, request.user!.orgId);

      return reply.status(201).send(agent);
    }
  );

  /**
   * PUT /api/agents/:id
   * Update an existing agent.
   * Requirements: 4.4, 4.6
   */
  fastify.put<UpdateAgentRequest>(
    '/:id',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Update an agent',
        tags: ['Agents'],
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
            display_name: { type: 'string', minLength: 1, maxLength: 255 },
            business_scope_id: { type: 'string', format: 'uuid', nullable: true },
            role: { type: 'string', maxLength: 255, nullable: true },
            avatar: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['active', 'busy', 'offline'] },
            metrics: { type: 'object' },
            tools: { type: 'array' },
            scope: { type: 'array' },
            system_prompt: { type: 'string', nullable: true },
            model_config: { type: 'object' },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: true,
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              business_scope_id: { type: 'string', nullable: true },
              name: { type: 'string' },
              display_name: { type: 'string' },
              role: { type: 'string', nullable: true },
              avatar: { type: 'string', nullable: true },
              status: { type: 'string' },
              metrics: { type: 'object', additionalProperties: true },
              tools: { type: 'array', items: { type: 'object', additionalProperties: true } },
              scope: { type: 'array', items: { type: 'string' } },
              system_prompt: { type: 'string', nullable: true },
              model_config: { type: 'object', additionalProperties: true },
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
    async (request: FastifyRequest<UpdateAgentRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);
      const data = validateSchema(updateAgentSchema, request.body);

      const agent = await agentService.updateAgent(id, data, request.user!.orgId);

      return reply.status(200).send(agent);
    }
  );

  /**
   * DELETE /api/agents/:id
   * Delete an agent (soft-delete).
   * Requirements: 4.5
   */
  fastify.delete<DeleteAgentRequest>(
    '/:id',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Delete an agent',
        tags: ['Agents'],
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
            description: 'Agent deleted successfully',
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              code: { type: 'string' },
              requestId: { type: 'string' },
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
    async (request: FastifyRequest<DeleteAgentRequest>, reply: FastifyReply) => {
      try {
        const { id } = validateSchema(idParamSchema, request.params);

        await agentService.deleteAgent(id, request.user!.orgId);

        return reply.status(204).send();
      } catch (error) {
        request.log.error({ error, params: request.params }, 'Delete agent failed');
        throw error;
      }
    }
  );

  // ==========================================================================
  // Agent Scope Binding Routes
  // ==========================================================================

  /**
   * GET /api/agents/:id/scopes — Get all scopes an agent belongs to
   */
  fastify.get<{ Params: { id: string } }>(
    '/:id/scopes',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { agentScopeService } = await import('../services/agent-scope.service.js');
      const assignments = await agentScopeService.getAgentScopes(request.user!.orgId, request.params.id);
      return reply.status(200).send({ scopes: assignments });
    }
  );

  /**
   * POST /api/agents/:id/scopes — Bind agent to a scope
   */
  fastify.post<{ Params: { id: string }; Body: { business_scope_id: string; is_primary?: boolean } }>(
    '/:id/scopes',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      const { agentScopeService } = await import('../services/agent-scope.service.js');
      const assignment = await agentScopeService.bindAgentToScope(
        request.user!.orgId,
        request.params.id,
        request.body.business_scope_id,
        request.body.is_primary ?? false,
        request.user!.id,
      );
      return reply.status(201).send(assignment);
    }
  );

  /**
   * DELETE /api/agents/:id/scopes/:scopeId — Unbind agent from a scope
   */
  fastify.delete<{ Params: { id: string; scopeId: string } }>(
    '/:id/scopes/:scopeId',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      const { agentScopeService } = await import('../services/agent-scope.service.js');
      await agentScopeService.unbindAgentFromScope(
        request.user!.orgId,
        request.params.id,
        request.params.scopeId,
      );
      return reply.status(204).send();
    }
  );

  // ==========================================================================
  // Conversational Agent Creation
  // ==========================================================================

  /**
   * POST /api/agents/suggest-from-conversation — AI-powered single agent suggestion
   */
  fastify.post<{ Body: { description: string; business_scope_name?: string; business_scope_description?: string; existing_agent_roles?: string[]; conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }> } }>(
    '/suggest-from-conversation',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { aiService } = await import('../services/ai.service.js');
      const result = await aiService.suggestAgentFromConversation({
        description: request.body.description,
        businessScopeName: request.body.business_scope_name,
        businessScopeDescription: request.body.business_scope_description,
        existingAgentRoles: request.body.existing_agent_roles,
        conversationHistory: request.body.conversation_history,
      });
      return reply.status(200).send(result);
    }
  );
}
