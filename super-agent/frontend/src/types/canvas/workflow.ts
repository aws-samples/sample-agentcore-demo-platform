/**
 * Workflow Types - Execution graph and workflow management
 * 
 * Adapted from Refly's workflow.ts for workflow execution logic.
 */

import type { 
  CanvasNode, 
  CanvasEdge, 
  CanvasNodeType, 
  CanvasNodeFilter,
  ActionStatus,
  CanvasData
} from './node-types';
import type { 
  WorkflowVariableDefinition,
  AgentNodeMeta 
} from './metadata';

// ============================================================================
// Workflow Node Types
// ============================================================================

/**
 * Workflow node - represents a node in the execution graph
 */
export interface WorkflowNode {
  /** Node ID */
  nodeId: string;
  /** Node type */
  nodeType: CanvasNodeType;
  /** Original canvas node */
  node: CanvasNode;
  /** Entity ID */
  entityId: string;
  /** Node title */
  title: string;
  /** Execution status */
  status: ActionStatus;
  /** Connections to other nodes */
  connectTo: CanvasNodeFilter[];
  /** Parent node IDs */
  parentNodeIds: string[];
  /** Child node IDs */
  childNodeIds: string[];
  /** Processed query (for agent nodes) */
  processedQuery?: string;
  /** Original query before variable substitution */
  originalQuery?: string;
  /** Result history for context */
  resultHistory?: ActionResult[];
}

/**
 * Action result from node execution
 */
export interface ActionResult {
  title: string;
  resultId: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Workflow Execution Types
// ============================================================================

/**
 * Workflow execution status
 */
export type WorkflowExecutionStatus = 
  | 'init'
  | 'executing'
  | 'finish'
  | 'failed'
  | 'aborted';

/**
 * Node execution record
 */
export interface WorkflowNodeExecution {
  /** Node execution ID */
  nodeExecutionId?: string;
  /** Node ID */
  nodeId: string;
  /** Node type */
  nodeType?: string;
  /** Node data (JSON) */
  nodeData?: string;
  /** Entity ID */
  entityId?: string;
  /** New entity ID (if created) */
  newEntityId?: string;
  /** Node title */
  title?: string;
  /** Execution status */
  status?: ActionStatus;
  /** Progress (0-100) */
  progress?: number;
  /** Error message */
  errorMessage?: string;
  /** Parent node IDs (JSON array) */
  parentNodeIds?: string | null;
  /** Child node IDs (JSON array) */
  childNodeIds?: string | null;
  /** Creation timestamp */
  createdAt?: string;
  /** Update timestamp */
  updatedAt?: string;
}

/**
 * Complete workflow execution record
 */
export interface WorkflowExecution {
  /** Execution ID */
  executionId: string;
  /** Canvas ID */
  canvasId?: string;
  /** Workflow title */
  title?: string;
  /** Execution status */
  status?: WorkflowExecutionStatus;
  /** Whether aborted by user */
  abortedByUser?: boolean;
  /** Node executions */
  nodeExecutions?: WorkflowNodeExecution[];
  /** Error message (if failed) */
  error?: string;
  /** Workflow app ID */
  appId?: string;
  /** Creation timestamp */
  createdAt?: string;
  /** Update timestamp */
  updatedAt?: string;
}

// ============================================================================
// Workflow Definition Types
// ============================================================================

/**
 * Workflow definition - stored configuration
 */
export interface WorkflowDefinition {
  /** Workflow ID */
  id: string;
  /** Workflow name */
  name: string;
  /** Description */
  description?: string;
  /** Canvas data */
  canvasData: CanvasData;
  /** Workflow variables */
  variables: WorkflowVariableDefinition[];
  /** Start node IDs */
  startNodeIds?: string[];
  /** Result node IDs (outputs) */
  resultNodeIds?: string[];
  /** Version */
  version: string;
  /** Is official template */
  isOfficial?: boolean;
  /** Parent version (for forks) */
  parentVersion?: string;
  /** Business scope ID */
  businessScopeId?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Update timestamp */
  updatedAt: Date;
  /** Created by user */
  createdBy: string;
}

// ============================================================================
// Workflow Preparation Types
// ============================================================================

/**
 * Parameters for preparing node executions
 */
export interface PrepareNodeExecutionsParams {
  /** Execution ID */
  executionId: string;
  /** Canvas data */
  canvasData: CanvasData;
  /** Workflow variables */
  variables: WorkflowVariableDefinition[];
  /** Start node IDs (optional) */
  startNodes?: string[];
  /** Node behavior: create new or update existing */
  nodeBehavior?: 'create' | 'update';
}

/**
 * Result of preparing node executions
 */
export interface PrepareNodeExecutionsResult {
  /** Prepared node executions */
  nodeExecutions: WorkflowNode[];
  /** Identified start nodes */
  startNodes: string[];
}

// ============================================================================
// Workflow Event Types
// ============================================================================

/**
 * Workflow event types for real-time updates
 */
export type WorkflowEventType =
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'workflow:aborted'
  | 'node:started'
  | 'node:progress'
  | 'node:completed'
  | 'node:failed';

/**
 * Workflow event payload
 */
export interface WorkflowEvent {
  type: WorkflowEventType;
  executionId: string;
  nodeId?: string;
  data?: {
    status?: ActionStatus;
    progress?: number;
    result?: unknown;
    error?: string;
    [key: string]: unknown;
  };
  timestamp: Date;
}

// ============================================================================
// Workflow Schedule Types
// ============================================================================

/**
 * Schedule configuration
 */
export interface WorkflowSchedule {
  /** Schedule ID */
  scheduleId?: string;
  /** Schedule name */
  name?: string;
  /** Is enabled */
  isEnabled?: boolean;
  /** Cron expression */
  cronExpression?: string;
  /** Schedule config JSON */
  scheduleConfig?: string;
  /** Timezone */
  timezone?: string;
  /** Next run time */
  nextRunAt?: string;
  /** Last run time */
  lastRunAt?: string;
}
