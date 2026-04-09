/**
 * Schedule Routes
 * Management endpoints for workflow schedules.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { scheduleService } from '../services/schedule.service.js';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

// ============================================================================
// Schemas
// ============================================================================

const createScheduleSchema = z.object({
  name: z.string().min(1).max(255),
  cronExpression: z.string().min(1).max(100),
  timezone: z.string().max(50).optional(),
  variables: z.array(z.any()).optional(),
  isEnabled: z.boolean().optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
});

const updateScheduleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  cronExpression: z.string().min(1).max(100).optional(),
  timezone: z.string().max(50).optional(),
  variables: z.array(z.any()).optional(),
  isEnabled: z.boolean().optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
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

interface ScheduleIdParams {
  Params: { scheduleId: string };
}

interface CreateScheduleRequest extends WorkflowIdParams {
  Body: z.infer<typeof createScheduleSchema>;
}

interface UpdateScheduleRequest extends ScheduleIdParams {
  Body: z.infer<typeof updateScheduleSchema>;
}

interface GetRecordsRequest extends ScheduleIdParams {
  Querystring: { page?: number; limit?: number };
}

// ============================================================================
// Route Registration
// ============================================================================

export async function schedulesRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/workflows/:workflowId/schedules
   * List schedules for a workflow
   */
  fastify.get<WorkflowIdParams>(
    '/workflows/:workflowId/schedules',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List schedules for a workflow',
        tags: ['Schedules'],
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
      const schedules = await scheduleService.listSchedules(
        request.params.workflowId,
        request.user!.orgId
      );

      return reply.status(200).send({
        data: schedules.map(s => ({
          id: s.id,
          name: s.name,
          cronExpression: s.cronExpression,
          timezone: s.timezone,
          isEnabled: s.isEnabled,
          nextRunAt: s.nextRunAt?.toISOString() || null,
          lastRunAt: s.lastRunAt?.toISOString() || null,
          runCount: s.runCount,
          failureCount: s.failureCount,
          createdAt: s.createdAt.toISOString(),
        })),
      });
    }
  );

  /**
   * POST /api/workflows/:workflowId/schedules
   * Create a schedule for a workflow
   */
  fastify.post<CreateScheduleRequest>(
    '/workflows/:workflowId/schedules',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Create a schedule',
        tags: ['Schedules'],
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
          required: ['name', 'cronExpression'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            cronExpression: { type: 'string', minLength: 1, maxLength: 100 },
            timezone: { type: 'string', maxLength: 50 },
            variables: { type: 'array' },
            isEnabled: { type: 'boolean' },
            maxRetries: { type: 'integer', minimum: 0, maximum: 10 },
          },
        },
      },
    },
    async (request: FastifyRequest<CreateScheduleRequest>, reply: FastifyReply) => {
      const body = createScheduleSchema.parse(request.body);

      try {
        const schedule = await scheduleService.createSchedule(
          request.user!.orgId,
          request.params.workflowId,
          {
            ...body,
            createdBy: request.user!.id,
          }
        );

        return reply.status(201).send({
          data: {
            id: schedule.id,
            name: schedule.name,
            cronExpression: schedule.cronExpression,
            timezone: schedule.timezone,
            isEnabled: schedule.isEnabled,
            nextRunAt: schedule.nextRunAt?.toISOString() || null,
            createdAt: schedule.createdAt.toISOString(),
          },
        });
      } catch (error: any) {
        if (error.message === 'Invalid cron expression') {
          throw AppError.validation('Invalid cron expression');
        }
        throw error;
      }
    }
  );

  /**
   * GET /api/schedules/:scheduleId
   * Get a schedule by ID
   */
  fastify.get<ScheduleIdParams>(
    '/schedules/:scheduleId',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get a schedule',
        tags: ['Schedules'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['scheduleId'],
          properties: {
            scheduleId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request: FastifyRequest<ScheduleIdParams>, reply: FastifyReply) => {
      const schedule = await scheduleService.getSchedule(
        request.params.scheduleId,
        request.user!.orgId
      );

      if (!schedule) {
        throw AppError.notFound('Schedule not found');
      }

      return reply.status(200).send({
        data: {
          id: schedule.id,
          workflowId: schedule.workflowId,
          name: schedule.name,
          cronExpression: schedule.cronExpression,
          timezone: schedule.timezone,
          isEnabled: schedule.isEnabled,
          variables: schedule.variables,
          nextRunAt: schedule.nextRunAt?.toISOString() || null,
          lastRunAt: schedule.lastRunAt?.toISOString() || null,
          runCount: schedule.runCount,
          failureCount: schedule.failureCount,
          maxRetries: schedule.maxRetries,
          createdAt: schedule.createdAt.toISOString(),
        },
      });
    }
  );

  /**
   * PATCH /api/schedules/:scheduleId
   * Update a schedule
   */
  fastify.patch<UpdateScheduleRequest>(
    '/schedules/:scheduleId',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Update a schedule',
        tags: ['Schedules'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['scheduleId'],
          properties: {
            scheduleId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            cronExpression: { type: 'string', minLength: 1, maxLength: 100 },
            timezone: { type: 'string', maxLength: 50 },
            variables: { type: 'array' },
            isEnabled: { type: 'boolean' },
            maxRetries: { type: 'integer', minimum: 0, maximum: 10 },
          },
        },
      },
    },
    async (request: FastifyRequest<UpdateScheduleRequest>, reply: FastifyReply) => {
      const body = updateScheduleSchema.parse(request.body || {});

      try {
        const schedule = await scheduleService.updateSchedule(
          request.params.scheduleId,
          request.user!.orgId,
          body
        );

        return reply.status(200).send({
          data: {
            id: schedule.id,
            name: schedule.name,
            cronExpression: schedule.cronExpression,
            timezone: schedule.timezone,
            isEnabled: schedule.isEnabled,
            nextRunAt: schedule.nextRunAt?.toISOString() || null,
          },
        });
      } catch (error: any) {
        if (error.message === 'Invalid cron expression') {
          throw AppError.validation('Invalid cron expression');
        }
        if (error.message === 'Schedule not found') {
          throw AppError.notFound('Schedule not found');
        }
        throw error;
      }
    }
  );

  /**
   * DELETE /api/schedules/:scheduleId
   * Delete a schedule
   */
  fastify.delete<ScheduleIdParams>(
    '/schedules/:scheduleId',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Delete a schedule',
        tags: ['Schedules'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['scheduleId'],
          properties: {
            scheduleId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request: FastifyRequest<ScheduleIdParams>, reply: FastifyReply) => {
      try {
        await scheduleService.deleteSchedule(
          request.params.scheduleId,
          request.user!.orgId
        );

        return reply.status(200).send({
          success: true,
          message: 'Schedule deleted',
        });
      } catch (error: any) {
        if (error.message === 'Schedule not found') {
          throw AppError.notFound('Schedule not found');
        }
        throw error;
      }
    }
  );

  /**
   * POST /api/schedules/:scheduleId/trigger
   * Manually trigger a schedule
   */
  fastify.post<ScheduleIdParams>(
    '/schedules/:scheduleId/trigger',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Manually trigger a schedule',
        tags: ['Schedules'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['scheduleId'],
          properties: {
            scheduleId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request: FastifyRequest<ScheduleIdParams>, reply: FastifyReply) => {
      try {
        const result = await scheduleService.triggerSchedule(
          request.params.scheduleId,
          request.user!.orgId
        );

        return reply.status(200).send({
          data: {
            executionId: result.executionId,
            triggeredAt: result.triggeredAt.toISOString(),
          },
        });
      } catch (error: any) {
        if (error.message === 'Schedule not found') {
          throw AppError.notFound('Schedule not found');
        }
        throw error;
      }
    }
  );

  /**
   * GET /api/schedules/:scheduleId/records
   * Get execution records for a schedule
   */
  fastify.get<GetRecordsRequest>(
    '/schedules/:scheduleId/records',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get schedule execution records',
        tags: ['Schedules'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['scheduleId'],
          properties: {
            scheduleId: { type: 'string', format: 'uuid' },
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
    async (request: FastifyRequest<GetRecordsRequest>, reply: FastifyReply) => {
      const pagination = paginationSchema.parse(request.query);

      try {
        const result = await scheduleService.getExecutionRecords(
          request.params.scheduleId,
          request.user!.orgId,
          pagination
        );

        return reply.status(200).send({
          data: result.records.map(r => ({
            id: r.id,
            executionId: r.executionId,
            scheduledAt: r.scheduledAt.toISOString(),
            triggeredAt: r.triggeredAt?.toISOString() || null,
            completedAt: r.completedAt?.toISOString() || null,
            status: r.status,
            errorMessage: r.errorMessage,
            retryCount: r.retryCount,
            logs: (r as any).logs || [],
          })),
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total: result.total,
            totalPages: Math.ceil(result.total / pagination.limit),
          },
        });
      } catch (error: any) {
        if (error.message === 'Schedule not found') {
          throw AppError.notFound('Schedule not found');
        }
        throw error;
      }
    }
  );
}
