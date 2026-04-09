/**
 * Zod validation schemas for Agent entity
 */
import { z } from 'zod';
import { uuidSchema } from './common.schema.js';

/**
 * Agent status enum values
 */
export const agentStatusValues = ['active', 'busy', 'offline'] as const;
export const agentStatusSchema = z.enum(agentStatusValues);

/**
 * Schema for creating a new agent
 */
export const createAgentSchema = z.object({
  name: z
    .string()
    .min(1, 'Agent name is required')
    .max(255, 'Agent name must be 255 characters or less')
    .refine((val) => val.trim().length > 0, 'Agent name cannot be empty or whitespace only'),
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(255, 'Display name must be 255 characters or less')
    .refine((val) => val.trim().length > 0, 'Display name cannot be empty or whitespace only'),
  business_scope_id: uuidSchema.optional().nullable(),
  role: z.string().max(255).optional().nullable(),
  avatar: z.string().max(1024).optional().nullable(),
  status: agentStatusSchema.default('active'),
  metrics: z.record(z.string(), z.unknown()).default({}),
  tools: z.array(z.unknown()).default([]),
  scope: z.array(z.unknown()).default([]),
  system_prompt: z.string().optional().nullable(),
  model_config: z.record(z.string(), z.unknown()).default({}),
  origin: z.enum(['scope_generation', 'manual', 'chat_created', 'cloned', 'imported', 'digital_twin']).default('scope_generation'),
  is_shared: z.boolean().default(false),
});

/**
 * Schema for updating an agent
 * Note: We use a separate schema without defaults to avoid overwriting existing values
 * when only partial updates are intended
 */
export const updateAgentSchema = z.object({
  name: z
    .string()
    .min(1, 'Agent name is required')
    .max(255, 'Agent name must be 255 characters or less')
    .refine((val) => val.trim().length > 0, 'Agent name cannot be empty or whitespace only')
    .optional(),
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(255, 'Display name must be 255 characters or less')
    .refine((val) => val.trim().length > 0, 'Display name cannot be empty or whitespace only')
    .optional(),
  business_scope_id: uuidSchema.optional().nullable(),
  role: z.string().max(255).optional().nullable(),
  avatar: z.string().max(1024).optional().nullable(),
  status: agentStatusSchema.optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  tools: z.array(z.unknown()).optional(),
  scope: z.array(z.unknown()).optional(),
  system_prompt: z.string().optional().nullable(),
  model_config: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for agent query filters
 */
export const agentFilterSchema = z.object({
  status: agentStatusSchema.optional(),
  business_scope_id: uuidSchema.optional(),
  name: z.string().optional(),
});

/**
 * Schema for agent response (includes all fields)
 */
export const agentResponseSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  business_scope_id: uuidSchema.nullable(),
  name: z.string(),
  display_name: z.string(),
  role: z.string().nullable(),
  avatar: z.string().nullable(),
  status: agentStatusSchema,
  metrics: z.record(z.string(), z.unknown()),
  tools: z.array(z.unknown()),
  scope: z.array(z.unknown()),
  system_prompt: z.string().nullable(),
  model_config: z.record(z.string(), z.unknown()),
  created_at: z.date(),
  updated_at: z.date(),
});

// Type exports
export type AgentStatus = z.infer<typeof agentStatusSchema>;
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type AgentFilter = z.infer<typeof agentFilterSchema>;
export type AgentResponse = z.infer<typeof agentResponseSchema>;
