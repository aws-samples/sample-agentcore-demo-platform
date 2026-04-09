/**
 * Zod validation schemas for Task entity
 */
import { z } from 'zod';
import { uuidSchema } from './common.schema.js';

/**
 * Task status enum values
 */
export const taskStatusValues = ['complete', 'running', 'failed'] as const;
export const taskStatusSchema = z.enum(taskStatusValues);

/**
 * Schema for creating a new task
 */
export const createTaskSchema = z.object({
  description: z
    .string()
    .min(1, 'Task description is required')
    .max(10000, 'Task description must be 10000 characters or less')
    .refine(
      (val) => val.trim().length > 0,
      'Task description cannot be empty or whitespace only'
    ),
  agent_id: uuidSchema.optional().nullable(),
  workflow_id: uuidSchema.optional().nullable(),
  status: taskStatusSchema.default('running'),
  details: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Schema for updating a task
 */
export const updateTaskSchema = createTaskSchema.partial();

/**
 * Schema for updating task status only
 */
export const updateTaskStatusSchema = z.object({
  status: taskStatusSchema,
});

/**
 * Schema for task query filters
 */
export const taskFilterSchema = z.object({
  status: taskStatusSchema.optional(),
  agent_id: uuidSchema.optional(),
  workflow_id: uuidSchema.optional(),
  created_by: uuidSchema.optional(),
});

/**
 * Schema for task response (includes all fields)
 */
export const taskResponseSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  agent_id: uuidSchema.nullable(),
  workflow_id: uuidSchema.nullable(),
  description: z.string(),
  status: taskStatusSchema,
  details: z.record(z.string(), z.unknown()),
  created_by: uuidSchema.nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

// Type exports
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type TaskFilter = z.infer<typeof taskFilterSchema>;
export type TaskResponse = z.infer<typeof taskResponseSchema>;
