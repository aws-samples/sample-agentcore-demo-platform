/**
 * Webhook Routes
 * Management and trigger endpoints for webhooks.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { webhookService } from '../services/webhook.service.js';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

// ============================================================================
// Schemas
// ============================================================================

const createWebhookSchema = z.object({
  name: z.string().max(255).optional(),
  timeoutSeconds: z.number().int().min(1).max(300).optional(),
  generateSecret: z.boolean().optional(),
  allowedIps: z.array(z.string()).optional(),
});

const updateWebhookSchema = z.object({
  name: z.string().max(255).optional(),
  isEnabled: z.boolean().optional(),
  timeoutSeconds: z.number().int().min(1).max(300).optional(),
  allowedIps: z.array(z.string()).optional(),
});

const triggerWebhookSchema = z.object({
  variables: z.record(z.string(), z.any()).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================================
// Types
// ============================================================================

interface WorkflowIdParams {
  Params: { workflowId: string };
}

interface WebhookIdParams {
  Params: { webhookId: string };
}

interface CreateWebhookRequest extends WorkflowIdParams {
  Body: z.infer<typeof createWebhookSchema>;
}

interface UpdateWebhookRequest extends WebhookIdParams {
  Body: z.infer<typeof updateWebhookSchema>;
}

interface TriggerWebhookRequest extends WebhookIdParams {
  Body: z.infer<typeof triggerWebhookSchema>;
}

interface GetCallHistoryRequest extends WebhookIdParams {
  Querystring: { page?: number; limit?: number };
}

// ============================================================================
// Route Registration
// ============================================================================

export async function webhooksRoutes(fastify: FastifyInstance): Promise<void> {
  // ========================================================================
  // Management Routes (require authentication)
  // ========================================================================

  /**
   * GET /api/workflows/:workflowId/webhooks
   * List webhooks for a workflow
   */
  fastify.get<WorkflowIdParams>(
    '/workflows/:workflowId/webhooks',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List webhooks for a workflow',
        tags: ['Webhooks'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['workflowId'],
          properties: {
            workflowId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request: FastifyRequest<WorkflowIdParams>, reply: FastifyReply) => {
      const webhooks = await webhookService.listWebhooks(
        request.params.workflowId,
        request.user!.orgId
      );

      return reply.status(200).send({
        data: webhooks.map(w => ({
          id: w.id,
          webhookId: w.webhookId,
          name: w.name,
          isEnabled: w.isEnabled,
          timeoutSeconds: w.timeoutSeconds,
          allowedIps: w.allowedIps,
          webhookUrl: `${process.env.PUBLIC_API_URL || process.env.API_BASE_URL || 'http://localhost:3001'}/api/v1/webhook/${w.webhookId}/trigger`,
        })),
      });
    }
  );

  /**
   * POST /api/workflows/:workflowId/webhooks
   * Create a webhook for a workflow
   */
  fastify.post<CreateWebhookRequest>(
    '/workflows/:workflowId/webhooks',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Create a webhook',
        tags: ['Webhooks'],
        security: [{ bearerAuth: [] }],
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
            name: { type: 'string', maxLength: 255 },
            timeoutSeconds: { type: 'integer', minimum: 1, maximum: 300 },
            generateSecret: { type: 'boolean' },
            allowedIps: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<CreateWebhookRequest>, reply: FastifyReply) => {
      const body = createWebhookSchema.parse(request.body || {});

      const result = await webhookService.createWebhook(
        request.user!.orgId,
        request.params.workflowId,
        {
          ...body,
          createdBy: request.user!.id,
        }
      );

      return reply.status(201).send({
        webhook: {
          id: result.webhook.id,
          webhookId: result.webhook.webhookId,
          name: result.webhook.name,
          isEnabled: result.webhook.isEnabled,
          timeoutSeconds: result.webhook.timeoutSeconds,
          allowedIps: result.webhook.allowedIps,
        },
        secret: result.secret, // Only shown once if generated
        webhookUrl: result.webhookUrl,
      });
    }
  );

  /**
   * PATCH /api/webhooks/:webhookId
   * Update a webhook
   */
  fastify.patch<UpdateWebhookRequest>(
    '/webhooks/:webhookId',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Update a webhook',
        tags: ['Webhooks'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['webhookId'],
          properties: {
            webhookId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 255 },
            isEnabled: { type: 'boolean' },
            timeoutSeconds: { type: 'integer', minimum: 1, maximum: 300 },
            allowedIps: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request: FastifyRequest<UpdateWebhookRequest>, reply: FastifyReply) => {
      const body = updateWebhookSchema.parse(request.body || {});

      const webhook = await webhookService.updateWebhook(
        request.params.webhookId,
        request.user!.orgId,
        body
      );

      return reply.status(200).send({
        data: {
          id: webhook.id,
          webhookId: webhook.webhookId,
          name: webhook.name,
          isEnabled: webhook.isEnabled,
          timeoutSeconds: webhook.timeoutSeconds,
          allowedIps: webhook.allowedIps,
        },
      });
    }
  );

  /**
   * DELETE /api/webhooks/:webhookId
   * Delete a webhook
   */
  fastify.delete<WebhookIdParams>(
    '/webhooks/:webhookId',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Delete a webhook',
        tags: ['Webhooks'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['webhookId'],
          properties: {
            webhookId: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<WebhookIdParams>, reply: FastifyReply) => {
      await webhookService.deleteWebhook(request.params.webhookId, request.user!.orgId);

      return reply.status(200).send({
        success: true,
        message: 'Webhook deleted',
      });
    }
  );

  /**
   * GET /api/webhooks/:webhookId/history
   * Get webhook call history
   */
  fastify.get<GetCallHistoryRequest>(
    '/webhooks/:webhookId/history',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get webhook call history',
        tags: ['Webhooks'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['webhookId'],
          properties: {
            webhookId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request: FastifyRequest<GetCallHistoryRequest>, reply: FastifyReply) => {
      const pagination = paginationSchema.parse(request.query);

      const result = await webhookService.getCallHistory(
        request.params.webhookId,
        request.user!.orgId,
        pagination
      );

      return reply.status(200).send({
        data: result.records,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / pagination.limit),
        },
      });
    }
  );

  // ========================================================================
  // Public Trigger Route (no authentication required)
  // ========================================================================

  /**
   * POST /v1/webhook/:webhookId/trigger
   * Trigger a webhook (public endpoint)
   */
  fastify.post<TriggerWebhookRequest>(
    '/v1/webhook/:webhookId/trigger',
    {
      schema: {
        description: 'Trigger a webhook (public endpoint)',
        tags: ['Webhooks'],
        params: {
          type: 'object',
          required: ['webhookId'],
          properties: {
            webhookId: { type: 'string' },
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
              received: { type: 'boolean' },
              callRecordId: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<TriggerWebhookRequest>, reply: FastifyReply) => {
      const body = triggerWebhookSchema.parse(request.body || {});

      try {
        const result = await webhookService.triggerWebhook(request.params.webhookId, {
          variables: body.variables,
          headers: request.headers as Record<string, string>,
          ipAddress: request.ip,
        });

        return reply.status(200).send(result);
      } catch (error: any) {
        request.log.error({ err: error, webhookId: request.params.webhookId }, 'Webhook trigger failed');
        if (error.message === 'Webhook not found') {
          throw AppError.notFound('Webhook not found');
        }
        if (error.message === 'Webhook is disabled') {
          throw AppError.forbidden('Webhook is disabled');
        }
        if (error.message === 'IP address not allowed') {
          throw AppError.forbidden('IP address not allowed');
        }
        throw error;
      }
    }
  );

  // ========================================================================
  // Public Status Query Route (no authentication)
  // ========================================================================

  /**
   * GET /v1/webhook/status/:callRecordId
   * Query webhook call status and workflow execution progress (public endpoint)
   */
  fastify.get<{ Params: { callRecordId: string } }>(
    '/v1/webhook/status/:callRecordId',
    {
      schema: {
        description: 'Query webhook call status and execution progress (public endpoint)',
        tags: ['Webhooks'],
        params: {
          type: 'object',
          required: ['callRecordId'],
          properties: {
            callRecordId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              callRecordId: { type: 'string' },
              status: { type: 'string' },
              errorMessage: { type: ['string', 'null'] },
              createdAt: { type: 'string', format: 'date-time' },
              execution: {
                type: ['object', 'null'],
                properties: {
                  status: { type: 'string' },
                  startedAt: { type: 'string', format: 'date-time' },
                  completedAt: { type: ['string', 'null'], format: 'date-time' },
                  nodes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        nodeId: { type: 'string' },
                        nodeType: { type: 'string' },
                        status: { type: 'string' },
                        progress: { type: 'number' },
                        startedAt: { type: ['string', 'null'], format: 'date-time' },
                        completedAt: { type: ['string', 'null'], format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await webhookService.getCallStatus(request.params.callRecordId);
        return reply.status(200).send(result);
      } catch (error: any) {
        if (error.message === 'Call record not found') {
          throw AppError.notFound('Call record not found');
        }
        throw error;
      }
    }
  );
}
