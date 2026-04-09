/**
 * Workflow Plan Types
 * 
 * Defines the structured format for workflow plans that can be generated
 * from natural language descriptions. Inspired by Refly's workflow-plan system.
 */

import { z } from 'zod';

// ============================================================================
// Variable Types
// ============================================================================

/**
 * Variable value - can be text or resource reference
 */
export const workflowVariableValueSchema = z.object({
  type: z.enum(['text', 'resource']).default('text'),
  text: z.string().optional(),
  resource: z.object({
    name: z.string(),
    fileType: z.enum(['document', 'image', 'audio', 'video']),
  }).optional(),
});

export type WorkflowVariableValue = z.infer<typeof workflowVariableValueSchema>;

/**
 * Workflow variable - user input that can be referenced in tasks
 */
export const workflowVariableSchema = z.object({
  variableId: z.string().describe('Unique variable ID'),
  variableType: z.enum(['string', 'resource']).default('string'),
  name: z.string().describe('Variable name for reference'),
  description: z.string().describe('What this variable represents'),
  required: z.boolean().default(false),
  resourceTypes: z.array(z.enum(['document', 'image', 'audio', 'video'])).optional(),
  value: z.array(workflowVariableValueSchema).default([]),
});

export type WorkflowVariable = z.infer<typeof workflowVariableSchema>;

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task type - maps to canvas node types
 */
export const taskTypeSchema = z.enum([
  'agent',        // AI agent execution
  'action',       // Generic action (API call, etc.)
  'condition',    // Conditional branching
  'document',     // Document generation
  'codeArtifact', // Code generation
]);

export type TaskType = z.infer<typeof taskTypeSchema>;

/**
 * Workflow task - individual step in the workflow
 */
export const workflowTaskSchema = z.object({
  id: z.string().describe('Unique task ID'),
  title: z.string().describe('Display title'),
  type: taskTypeSchema.default('agent').describe('Task type'),
  prompt: z.string().describe('Detailed execution instructions'),
  dependentTasks: z.array(z.string()).optional().describe('Task IDs that must complete first'),
  agentId: z.string().optional().describe('Agent ID for agent tasks'),
  requiredIntegrations: z.array(z.string()).optional().describe('External services needed (e.g. SendGrid, GitHub API)'),
  config: z.record(z.string(), z.unknown()).optional().describe('Task-specific configuration'),
});

export type WorkflowTask = z.infer<typeof workflowTaskSchema>;

// ============================================================================
// Workflow Plan
// ============================================================================

/**
 * Complete workflow plan - generated from natural language
 */
export const workflowPlanSchema = z.object({
  title: z.string().describe('Workflow title'),
  description: z.string().optional().describe('Workflow description'),
  tasks: z.array(workflowTaskSchema).describe('Array of workflow tasks'),
  variables: z.array(workflowVariableSchema).default([]).describe('Input variables'),
});

export type WorkflowPlan = z.infer<typeof workflowPlanSchema>;

// ============================================================================
// Patch Operations
// ============================================================================

export const patchOperationSchema = z.enum([
  'updateTitle',
  'createTask',
  'updateTask',
  'deleteTask',
  'createVariable',
  'updateVariable',
  'deleteVariable',
  'reorderTasks',
]);

export type PatchOperation = z.infer<typeof patchOperationSchema>;

export const workflowPatchSchema = z.object({
  op: patchOperationSchema,
  // For updateTitle
  title: z.string().optional(),
  // For task operations
  taskId: z.string().optional(),
  task: workflowTaskSchema.optional(),
  taskData: workflowTaskSchema.partial().optional(),
  // For variable operations
  variableId: z.string().optional(),
  variable: workflowVariableSchema.optional(),
  variableData: workflowVariableSchema.partial().optional(),
  // For reorder
  taskOrder: z.array(z.string()).optional(),
});

export type WorkflowPatch = z.infer<typeof workflowPatchSchema>;

// ============================================================================
// Parse Functions
// ============================================================================

export function parseWorkflowPlan(data: unknown): { 
  success: boolean; 
  data?: WorkflowPlan; 
  error?: string;
} {
  const result = workflowPlanSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map(issue => 
    `[${issue.path.join('.')}]: ${issue.message}`
  ).join('\n');
  
  return { success: false, error: `Validation failed:\n${errors}` };
}

export function parseWorkflowPatch(data: unknown): {
  success: boolean;
  data?: WorkflowPatch;
  error?: string;
} {
  const result = workflowPatchSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map(issue =>
    `[${issue.path.join('.')}]: ${issue.message}`
  ).join('\n');
  
  return { success: false, error: `Validation failed:\n${errors}` };
}
