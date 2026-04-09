/**
 * OpenAPI Routes
 * Public API endpoints for programmatic workflow access.
 * Requires API Key authentication.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ZodError } from 'zod';
import { apiKeyService } from '../services/apiKey.service.js';
import { workflowExecutionService } from '../services/workflow-execution.service.js';
import { workflowRepository } from '../repositories/workflow.repository.js';
import { AppError } from '../middleware/errorHandler.js';
import crypto from 'crypto';

// ============================================================================
// Schemas
// ============================================================================

const runWorkflowSchema = z.object({
  variables: z.record(z.unknown()).optional(),
});

const workflowIdParamSchema = z.object({
  workflowId: z.string().uuid(),
});

const executionIdParamSchema = z.object({
  executionId: z.string().uuid(),
});

// ============================================================================
// Types
// ============================================================================

interface RunWorkflowRequest {
  Params: { workflowId: string };
  Body: { variables?: Record<string, unknown> };
}

interface GetStatusRequest {
  Params: { executionId: string };
}

interface AbortRequest {
  Params: { executionId: string };
}

// ============================================================================
// API Key Authentication Hook
// ============================================================================

async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or invalid API key');
  }

  const apiKey = authHeader.substring(7);
  const keyData = await apiKeyService.validateApiKey(apiKey);

  if (!keyData) {
    throw AppError.unauthorized('Invalid or expired API key');
  }

  // Check rate limit
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const withinLimit = await apiKeyService.checkRateLimit(keyHash, keyData.rateLimitPerMinute);
  
  if (!withinLimit) {
    throw AppError.tooManyRequests('Rate limit exceeded');
  }

  // Attach key data to request
  (request as any).apiKeyData = keyData;
}

// ============================================================================
// Route Registration
// ============================================================================

export async function openapiRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/openapi/workflow/:workflowId/run
   * Run a workflow via API
   */
  fastify.post<RunWorkflowRequest>(
    '/v1/openapi/workflow/:workflowId/run',
    {
      preHandler: [apiKeyAuth],
      schema: {
        description: 'Run workflow via API (returns execution ID)',
        tags: ['OpenAPI'],
        security: [{ apiKey: [] }],
        params: {
          type: 'object',
          required: ['workflowId'],
          properties: {
            workflowId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            variables: { type: 'object' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  executionId: { type: 'string' },
                  status: { type: 'string' },
                  triggeredAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<RunWorkflowRequest>, reply: FastifyReply) => {
      const { workflowId } = workflowIdParamSchema.parse(request.params);
      const body = runWorkflowSchema.parse(request.body || {});
      const keyData = (request as any).apiKeyData;

      // Check scope
      if (!keyData.scopes.includes('workflow:execute')) {
        throw AppError.forbidden('API key does not have workflow:execute scope');
      }

      // Get workflow to verify it exists and belongs to org
      const workflow = await workflowRepository.findById(workflowId, keyData.organizationId);
      if (!workflow) {
        throw AppError.notFound('Workflow not found');
      }

      // Convert variables to workflow format
      const workflowVariables = body.variables 
        ? Object.entries(body.variables).map(([name, value]) => ({
            variableId: `var-${crypto.randomUUID()}`,
            name,
            value: [{ type: 'text' as const, text: String(value) }],
          }))
        : undefined;

      // Start execution
      const executionId = await workflowExecutionService.initializeWorkflowExecution(
        {
          id: keyData.userId,
          organizationId: keyData.organizationId,
        },
        workflowId,
        {
          canvasData: {
            nodes: workflow.nodes as any[],
            edges: workflow.connections as any[],
          },
          variables: workflowVariables,
          triggerType: 'api',
        }
      );

      return reply.status(200).send({
        success: true,
        data: {
          executionId,
          status: 'executing',
          triggeredAt: new Date().toISOString(),
        },
      });
    }
  );

  /**
   * GET /v1/openapi/workflow/:executionId/status
   * Get workflow execution status
   */
  fastify.get<GetStatusRequest>(
    '/v1/openapi/workflow/:executionId/status',
    {
      preHandler: [apiKeyAuth],
      schema: {
        description: 'Get workflow execution status',
        tags: ['OpenAPI'],
        security: [{ apiKey: [] }],
        params: {
          type: 'object',
          required: ['executionId'],
          properties: {
            executionId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  executionId: { type: 'string' },
                  status: { type: 'string' },
                  progress: { type: 'number' },
                  startedAt: { type: 'string' },
                  completedAt: { type: 'string', nullable: true },
                  error: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<GetStatusRequest>, reply: FastifyReply) => {
      const { executionId } = executionIdParamSchema.parse(request.params);
      const keyData = (request as any).apiKeyData;

      const execution = await workflowExecutionService.getExecution(
        executionId,
        keyData.organizationId
      );

      if (!execution) {
        throw AppError.notFound('Execution not found');
      }

      // Calculate overall progress
      const nodeExecutions = execution.node_executions || [];
      const completedNodes = nodeExecutions.filter(
        (n: any) => n.status === 'completed' || n.status === 'failed'
      ).length;
      const progress = nodeExecutions.length > 0 
        ? Math.round((completedNodes / nodeExecutions.length) * 100)
        : 0;

      return reply.status(200).send({
        success: true,
        data: {
          executionId: execution.id,
          status: execution.status,
          progress,
          startedAt: execution.started_at,
          completedAt: execution.completed_at,
          error: execution.error_message,
        },
      });
    }
  );

  /**
   * GET /v1/openapi/workflow/:executionId/output
   * Get workflow execution output
   */
  fastify.get<GetStatusRequest>(
    '/v1/openapi/workflow/:executionId/output',
    {
      preHandler: [apiKeyAuth],
      schema: {
        description: 'Get workflow execution output',
        tags: ['OpenAPI'],
        security: [{ apiKey: [] }],
        params: {
          type: 'object',
          required: ['executionId'],
          properties: {
            executionId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request: FastifyRequest<GetStatusRequest>, reply: FastifyReply) => {
      const { executionId } = executionIdParamSchema.parse(request.params);
      const keyData = (request as any).apiKeyData;

      const execution = await workflowExecutionService.getExecution(
        executionId,
        keyData.organizationId
      );

      if (!execution) {
        throw AppError.notFound('Execution not found');
      }

      // Collect outputs from all completed nodes
      const outputs: Record<string, any> = {};
      for (const node of (execution.node_executions || [])) {
        if (node.output_data) {
          outputs[node.node_id] = node.output_data;
        }
      }

      return reply.status(200).send({
        success: true,
        data: {
          executionId: execution.id,
          status: execution.status,
          outputs,
          completedAt: execution.completed_at,
        },
      });
    }
  );

  /**
   * POST /v1/openapi/workflow/:executionId/abort
   * Abort a running workflow execution
   */
  fastify.post<AbortRequest>(
    '/v1/openapi/workflow/:executionId/abort',
    {
      preHandler: [apiKeyAuth],
      schema: {
        description: 'Abort workflow execution',
        tags: ['OpenAPI'],
        security: [{ apiKey: [] }],
        params: {
          type: 'object',
          required: ['executionId'],
          properties: {
            executionId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request: FastifyRequest<AbortRequest>, reply: FastifyReply) => {
      const { executionId } = executionIdParamSchema.parse(request.params);
      const keyData = (request as any).apiKeyData;

      await workflowExecutionService.abortExecution(executionId, keyData.organizationId);

      return reply.status(200).send({
        success: true,
        data: {
          executionId,
          status: 'aborted',
          abortedAt: new Date().toISOString(),
        },
      });
    }
  );
}
