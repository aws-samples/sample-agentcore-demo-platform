/**
 * Task Routes
 * REST API endpoints for Task management.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { taskService } from '../services/task.service.js';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  taskFilterSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type UpdateTaskStatusInput,
  type TaskFilter,
} from '../schemas/task.schema.js';
import { paginationSchema, idParamSchema } from '../schemas/common.schema.js';
import { ZodError } from 'zod';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Request types for route handlers
 */
interface GetTasksRequest {
  Querystring: TaskFilter & { page?: number; limit?: number };
}

interface GetTaskByIdRequest {
  Params: { id: string };
}

interface CreateTaskRequest {
  Body: CreateTaskInput;
}

interface UpdateTaskRequest {
  Params: { id: string };
  Body: UpdateTaskInput;
}

interface UpdateTaskStatusRequest {
  Params: { id: string };
  Body: UpdateTaskStatusInput;
}

interface DeleteTaskRequest {
  Params: { id: string };
}

interface ExportTasksRequest {
  Querystring: TaskFilter;
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
 * Register task routes on the Fastify instance.
 * All routes require authentication and filter by organization_id.
 */
export async function taskRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/tasks
   * Get all tasks for the authenticated user's organization.
   * Supports filtering by status, agent_id, workflow_id, and created_by.
   * Requirements: 5.1, 5.2
   */
  fastify.get<GetTasksRequest>(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get all tasks for the organization',
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['complete', 'running', 'failed'] },
            agent_id: { type: 'string', format: 'uuid' },
            workflow_id: { type: 'string', format: 'uuid' },
            created_by: { type: 'string', format: 'uuid' },
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
    async (request: FastifyRequest<GetTasksRequest>, reply: FastifyReply) => {
      const { page, limit, ...filterParams } = request.query;

      // Validate filters
      const filters = validateSchema(taskFilterSchema, filterParams);
      const pagination = validateSchema(paginationSchema, { page, limit });

      const result = await taskService.getTasks(request.user!.orgId, filters, pagination);

      return reply.status(200).send(result);
    }
  );

  /**
   * GET /api/tasks/export
   * Export tasks to CSV format.
   * Requirements: 5.6
   */
  fastify.get<ExportTasksRequest>(
    '/export',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Export tasks to CSV format',
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['complete', 'running', 'failed'] },
            agent_id: { type: 'string', format: 'uuid' },
            workflow_id: { type: 'string', format: 'uuid' },
            created_by: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'string',
            description: 'CSV file content',
          },
        },
      },
    },
    async (request: FastifyRequest<ExportTasksRequest>, reply: FastifyReply) => {
      // Validate filters
      const filters = validateSchema(taskFilterSchema, request.query);

      const csv = await taskService.exportTasksToCsv(request.user!.orgId, filters);

      return reply
        .status(200)
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="tasks.csv"')
        .send(csv);
    }
  );

  /**
   * GET /api/tasks/:id
   * Get a single task by ID.
   * Requirements: 5.3
   */
  fastify.get<GetTaskByIdRequest>(
    '/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get a task by ID',
        tags: ['Tasks'],
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
              agent_id: { type: 'string', nullable: true },
              workflow_id: { type: 'string', nullable: true },
              description: { type: 'string' },
              status: { type: 'string' },
              details: { type: 'object' },
              created_by: { type: 'string', nullable: true },
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
    async (request: FastifyRequest<GetTaskByIdRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);

      const task = await taskService.getTaskById(id, request.user!.orgId);

      return reply.status(200).send(task);
    }
  );

  /**
   * POST /api/tasks
   * Create a new task.
   * Requirements: 5.4, 5.7
   */
  fastify.post<CreateTaskRequest>(
    '/',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Create a new task',
        tags: ['Tasks'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['description'],
          properties: {
            description: { type: 'string', minLength: 1, maxLength: 10000 },
            agent_id: { type: 'string', format: 'uuid', nullable: true },
            workflow_id: { type: 'string', format: 'uuid', nullable: true },
            status: { type: 'string', enum: ['complete', 'running', 'failed'], default: 'running' },
            details: { type: 'object', default: {} },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              description: { type: 'string' },
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
    async (request: FastifyRequest<CreateTaskRequest>, reply: FastifyReply) => {
      const data = validateSchema(createTaskSchema, request.body);

      const task = await taskService.createTask(data, request.user!.orgId, request.user!.id);

      return reply.status(201).send(task);
    }
  );

  /**
   * PUT /api/tasks/:id
   * Update an existing task.
   * Requirements: 5.4, 5.7
   */
  fastify.put<UpdateTaskRequest>(
    '/:id',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Update a task',
        tags: ['Tasks'],
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
            description: { type: 'string', minLength: 1, maxLength: 10000 },
            agent_id: { type: 'string', format: 'uuid', nullable: true },
            workflow_id: { type: 'string', format: 'uuid', nullable: true },
            status: { type: 'string', enum: ['complete', 'running', 'failed'] },
            details: { type: 'object' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              description: { type: 'string' },
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
    async (request: FastifyRequest<UpdateTaskRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);
      const data = validateSchema(updateTaskSchema, request.body);

      const task = await taskService.updateTask(id, data, request.user!.orgId);

      return reply.status(200).send(task);
    }
  );

  /**
   * PATCH /api/tasks/:id/status
   * Update task status only.
   * Requirements: 5.5
   */
  fastify.patch<UpdateTaskStatusRequest>(
    '/:id/status',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Update task status',
        tags: ['Tasks'],
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
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['complete', 'running', 'failed'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              organization_id: { type: 'string' },
              description: { type: 'string' },
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
    async (request: FastifyRequest<UpdateTaskStatusRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);
      const data = validateSchema(updateTaskStatusSchema, request.body);

      const task = await taskService.updateTaskStatus(id, data, request.user!.orgId);

      return reply.status(200).send(task);
    }
  );

  /**
   * DELETE /api/tasks/:id
   * Delete a task.
   */
  fastify.delete<DeleteTaskRequest>(
    '/:id',
    {
      preHandler: [authenticate, requireModifyAccess],
      schema: {
        description: 'Delete a task',
        tags: ['Tasks'],
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
            description: 'Task deleted successfully',
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
    async (request: FastifyRequest<DeleteTaskRequest>, reply: FastifyReply) => {
      const { id } = validateSchema(idParamSchema, request.params);

      await taskService.deleteTask(id, request.user!.orgId);

      return reply.status(204).send();
    }
  );
}
