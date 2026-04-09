/**
 * Zod validation schemas for MCP Server entity
 */
import { z } from 'zod';
import { uuidSchema } from './common.schema.js';

/**
 * MCP server status enum values
 */
export const mcpServerStatusValues = ['active', 'inactive', 'error'] as const;
export const mcpServerStatusSchema = z.enum(mcpServerStatusValues);

/**
 * Structured MCP server config schema (for stdio/sse/http)
 */
export const mcpServerConfigSchema = z.object({
  type: z.enum(['stdio', 'sse', 'http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
}).optional().nullable();

/**
 * Schema for creating a new MCP server
 */
export const createMcpServerSchema = z.object({
  name: z
    .string()
    .min(1, 'MCP server name is required')
    .max(255, 'MCP server name must be 255 characters or less'),
  description: z.string().max(1000).optional().nullable(),
  host_address: z.string().min(1, 'Host address is required'),
  oauth_secret_id: uuidSchema.optional().nullable(),
  headers: z.record(z.string(), z.string()).default({}),
  config: mcpServerConfigSchema,
  status: mcpServerStatusSchema.default('inactive'),
});

/**
 * Schema for updating an MCP server
 */
export const updateMcpServerSchema = createMcpServerSchema.partial();

/**
 * Schema for MCP server query filters
 */
export const mcpServerFilterSchema = z.object({
  status: mcpServerStatusSchema.optional(),
  name: z.string().optional(),
});

/**
 * Schema for MCP server response (includes all fields)
 */
export const mcpServerResponseSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  host_address: z.string(),
  oauth_secret_id: uuidSchema.nullable(),
  headers: z.record(z.string(), z.string()),
  status: mcpServerStatusSchema,
  created_at: z.date(),
  updated_at: z.date(),
});

/**
 * Schema for MCP server connection test request
 */
export const mcpServerTestRequestSchema = z.object({
  timeout_ms: z.number().int().positive().max(30000).default(5000),
});

/**
 * Schema for MCP server connection test response
 */
export const mcpServerTestResponseSchema = z.object({
  success: z.boolean(),
  latency_ms: z.number().optional(),
  error: z.string().optional(),
});

// Type exports
export type McpServerStatus = z.infer<typeof mcpServerStatusSchema>;
export type CreateMcpServerInput = z.infer<typeof createMcpServerSchema>;
export type UpdateMcpServerInput = z.infer<typeof updateMcpServerSchema>;
export type McpServerFilter = z.infer<typeof mcpServerFilterSchema>;
export type McpServerResponse = z.infer<typeof mcpServerResponseSchema>;
export type McpServerTestRequest = z.infer<typeof mcpServerTestRequestSchema>;
export type McpServerTestResponse = z.infer<typeof mcpServerTestResponseSchema>;
