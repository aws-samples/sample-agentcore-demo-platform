/**
 * Node Executor Types
 *
 * Type definitions for node executors used in workflow execution.
 *
 * Requirements:
 * - 3.1: Agent node execution with AI service
 * - 3.2: Action node execution
 * - 3.3: Condition node evaluation
 * - 3.4: Human approval node pause/resume
 * - 3.5: Document node generation
 * - 3.6: Code artifact node generation/execution
 * - 3.7: Start/end node pass-through
 */

import type { CanvasNode, CanvasNodeType } from '../../types/workflow-execution.js';

/**
 * Node execution result
 */
export interface NodeExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Output data from execution */
  output?: unknown;
  /** Error message if failed */
  error?: string;
  /** Error stack trace if failed */
  errorStack?: string;
  /** Active branch for condition nodes */
  activeBranch?: string;
  /** Whether execution is paused (for human approval) */
  paused?: boolean;
}

/**
 * Node execution context
 * Contains all data needed for node execution
 */
export interface NodeExecutionContext {
  /** Execution ID */
  executionId: string;
  /** Current node ID */
  nodeId: string;
  /** Outputs from completed parent nodes */
  nodeOutputs: Map<string, unknown>;
  /** Workflow variables */
  variables: Map<string, unknown>;
  /** User ID */
  userId?: string;
  /** Organization ID */
  organizationId?: string;
  /** Workflow ID (for workspace reuse) */
  workflowId?: string;
  /** Business scope ID (for loading scope context) */
  businessScopeId?: string;
}

/**
 * Parameters for node execution
 */
export interface NodeExecutionParams {
  /** Node data */
  node: CanvasNode;
  /** Execution context */
  context: NodeExecutionContext;
}

/**
 * Interface for node executors
 * Each node type has its own executor implementation
 */
export interface INodeExecutor {
  /**
   * Execute the node
   * @param params - Execution parameters
   * @returns Execution result
   */
  execute(params: NodeExecutionParams): Promise<NodeExecutionResult>;

  /**
   * Check if this executor supports the given node type
   * @param nodeType - Node type to check
   * @returns True if supported
   */
  supports(nodeType: CanvasNodeType): boolean;

  /**
   * Get the node types this executor handles
   */
  readonly supportedTypes: CanvasNodeType[];
}

/**
 * Condition operator types
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'custom';

/**
 * Condition rule for evaluation
 */
export interface ConditionRule {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
  customExpression?: string;
}

/**
 * Action types for action nodes
 */
export type ActionType =
  | 'api_call'
  | 'database'
  | 'notification'
  | 'transform'
  | 'custom';

/**
 * API call configuration
 */
export interface ApiCallConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

/**
 * Transform configuration
 */
export interface TransformConfig {
  type: 'map' | 'filter' | 'reduce' | 'custom';
  expression?: string;
  mapping?: Record<string, string>;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  type: 'email' | 'slack' | 'webhook';
  recipient?: string;
  message: string;
  subject?: string;
}
