/**
 * Zod validation schemas for Workflow entity
 */
import { z } from 'zod';
import { uuidSchema } from './common.schema.js';

/**
 * Schema for workflow node
 */
export const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

/**
 * Schema for workflow connection
 */
export const workflowConnectionSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

/**
 * Schema for creating a new workflow
 */
export const createWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, 'Workflow name is required')
    .max(255, 'Workflow name must be 255 characters or less'),
  version: z
    .string()
    .min(1, 'Version is required')
    .max(50, 'Version must be 50 characters or less'),
  business_scope_id: uuidSchema.optional().nullable(),
  is_official: z.boolean().default(false),
  parent_version: z.string().max(50).optional().nullable(),
  nodes: z.array(z.unknown()).default([]),
  connections: z.array(z.unknown()).default([]),
});

/**
 * Schema for updating a workflow
 */
export const updateWorkflowSchema = createWorkflowSchema.partial();

/**
 * Schema for importing a workflow (JSON/YAML)
 */
export const importWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  version: z.string().min(1, 'Version is required'),
  nodes: z.array(z.unknown()),
  connections: z.array(z.unknown()),
  business_scope_id: uuidSchema.optional().nullable(),
});

/**
 * Schema for workflow query filters
 */
export const workflowFilterSchema = z.object({
  business_scope_id: uuidSchema.optional(),
  is_official: z.coerce.boolean().optional(),
  name: z.string().optional(),
});

/**
 * Schema for workflow response (includes all fields)
 */
export const workflowResponseSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  business_scope_id: uuidSchema.nullable(),
  name: z.string(),
  version: z.string(),
  is_official: z.boolean(),
  parent_version: z.string().nullable(),
  nodes: z.array(z.unknown()),
  connections: z.array(z.unknown()),
  created_by: uuidSchema.nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

// Type exports
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowConnection = z.infer<typeof workflowConnectionSchema>;
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>;
export type ImportWorkflowInput = z.infer<typeof importWorkflowSchema>;
export type WorkflowFilter = z.infer<typeof workflowFilterSchema>;
export type WorkflowResponse = z.infer<typeof workflowResponseSchema>;
