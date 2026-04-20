/**
 * Workflow Execution Service
 * 
 * Handles workflow execution, real-time status updates, and integration
 * with the canvas system.
 * 
 * Supports two modes:
 * - REST: Calls backend API (backend)
 * - Mock: Uses in-memory simulation for development/testing
 * 
 * Requirements:
 * - 8.1: WHEN the user clicks the Run button, THE frontend SHALL call the backend execution API
 * - 8.2: WHEN the execution starts, THE frontend SHALL establish a WebSocket connection to receive real-time events
 * - 8.6: WHEN the user clicks the Stop button, THE frontend SHALL call the abort API
 */

import type { 
  CanvasData, 
  ActionStatus 
} from '@/types/canvas';
import type { 
  WorkflowExecution, 
  WorkflowNode,
  WorkflowEvent,
  PrepareNodeExecutionsParams,
} from '@/types/canvas/workflow';
import type { WorkflowVariableDefinition } from '@/types/canvas/metadata';
import { prepareNodeExecutions, validateWorkflow } from '@/lib/canvas/workflow';
import { generateId } from '@/lib/canvas/utils';
import { workflowWebSocketClient } from './workflowWebSocketClient';

// ============================================================================
// Types
// ============================================================================

export type WorkflowExecutionErrorCode = 
  | 'NOT_FOUND' 
  | 'VALIDATION_ERROR' 
  | 'EXECUTION_ERROR' 
  | 'ABORTED'
  | 'NETWORK_ERROR'
  | 'CONFLICT';

export class WorkflowExecutionError extends Error {
  code: WorkflowExecutionErrorCode;
  details?: unknown;
  
  constructor(message: string, code: WorkflowExecutionErrorCode, details?: unknown) {
    super(message);
    this.name = 'WorkflowExecutionError';
    this.code = code;
    this.details = details;
  }
}

export interface ExecuteWorkflowParams {
  /** Canvas data to execute */
  canvasData: CanvasData;
  /** Workflow variables */
  variables?: WorkflowVariableDefinition[];
  /** Optional start node IDs (defaults to root nodes) */
  startNodeIds?: string[];
  /** Workflow title for display */
  title?: string;
  /** Canvas/workflow ID */
  canvasId?: string;
}

export interface ExecutionProgress {
  /** Current execution */
  execution: WorkflowExecution;
  /** Node status map */
  nodeStatuses: Map<string, ActionStatus>;
  /** Node progress map (0-100) */
  nodeProgress: Map<string, number>;
  /** Node results */
  nodeResults: Map<string, unknown>;
  /** Node errors */
  nodeErrors: Map<string, string>;
}

type EventCallback = (event: WorkflowEvent) => void;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get API configuration from environment variables
 */
function getApiConfig(): { mode: 'rest' | 'mock'; baseUrl: string } {
  const mode = import.meta.env.VITE_API_MODE === 'rest' ? 'rest' : 'mock';
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  return { mode, baseUrl };
}

// ============================================================================
// REST API Client
// ============================================================================

/**
 * REST Workflow Execution Service
 * Calls the backend API for workflow execution operations.
 * 
 * Requirements:
 * - 8.1: Call backend execution API with canvas data
 * - 8.6: Call abort API when user clicks Stop
 */
export const RestWorkflowExecutionService = {
  /**
   * Get the base URL for API calls
   */
  getBaseUrl(): string {
    return getApiConfig().baseUrl;
  },

  /**
   * Make an authenticated API request
   */
  async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api${endpoint}`;

    // Get auth token from localStorage
    const token = localStorage.getItem('local_auth_token') || localStorage.getItem('cognito_id_token');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Map HTTP status codes to error codes
        let code: WorkflowExecutionErrorCode = 'EXECUTION_ERROR';
        if (response.status === 404) code = 'NOT_FOUND';
        else if (response.status === 400) code = 'VALIDATION_ERROR';
        else if (response.status === 409) code = 'CONFLICT';
        
        throw new WorkflowExecutionError(
          errorData.error || `API request failed: ${response.statusText}`,
          code,
          errorData.details
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof WorkflowExecutionError) {
        throw error;
      }
      
      // Network or other errors
      throw new WorkflowExecutionError(
        error instanceof Error ? error.message : 'Network request failed',
        'NETWORK_ERROR'
      );
    }
  },

  /**
   * Execute a workflow via REST API
   * 
   * Requirement 8.1: Call backend execution API with canvas data
   */
  async executeWorkflow(params: ExecuteWorkflowParams): Promise<WorkflowExecution> {
    const { canvasData, variables = [], startNodeIds, title, canvasId } = params;

    // Use canvasId as workflowId, or generate one if not provided
    const workflowId = canvasId || generateId();

    const response = await this.apiRequest<{
      executionId: string;
      status: string;
      createdAt: string;
    }>(`/workflows/${workflowId}/execute`, {
      method: 'POST',
      body: JSON.stringify({
        canvasData,
        variables,
        startNodeIds,
        title,
      }),
    });

    // Return a WorkflowExecution object
    return {
      executionId: response.executionId,
      canvasId: workflowId,
      title: title || 'Workflow Execution',
      status: response.status as WorkflowExecution['status'],
      nodeExecutions: [],
      createdAt: response.createdAt,
      updatedAt: response.createdAt,
    };
  },

  /**
   * Get execution by ID via REST API
   */
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    const response = await this.apiRequest<{
      id: string;
      workflow_id: string;
      status: string;
      title?: string;
      canvas_data: CanvasData;
      variables: WorkflowVariableDefinition[];
      error_message?: string;
      error_stack?: string;
      started_at: string;
      completed_at?: string;
      created_at: string;
      updated_at: string;
      node_executions: Array<{
        id: string;
        node_id: string;
        node_type: string;
        status: string;
        progress: number;
        input_data?: unknown;
        output_data?: unknown;
        error_message?: string;
        started_at?: string;
        completed_at?: string;
      }>;
    }>(`/executions/${executionId}`);

    // Transform backend response to WorkflowExecution format
    return {
      executionId: response.id,
      canvasId: response.workflow_id,
      title: response.title,
      status: response.status as WorkflowExecution['status'],
      nodeExecutions: response.node_executions?.map(ne => ({
        nodeExecutionId: ne.id,
        nodeId: ne.node_id,
        nodeType: ne.node_type,
        status: ne.status as ActionStatus,
        progress: ne.progress,
        errorMessage: ne.error_message,
        createdAt: ne.started_at,
        updatedAt: ne.completed_at,
      })),
      createdAt: response.created_at,
      updatedAt: response.updated_at,
    };
  },

  /**
   * Get all executions for a canvas/workflow via REST API
   */
  async getExecutionsByCanvas(canvasId: string): Promise<WorkflowExecution[]> {
    const response = await this.apiRequest<{
      data: Array<{
        id: string;
        workflow_id: string;
        status: string;
        title?: string;
        error_message?: string;
        started_at: string;
        completed_at?: string;
        created_at: string;
        node_executions: Array<{
          id: string;
          node_id: string;
          node_type: string;
          status: string;
        }>;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/workflows/${canvasId}/executions`);

    return response.data.map(exec => ({
      executionId: exec.id,
      canvasId: exec.workflow_id,
      title: exec.title,
      status: exec.status as WorkflowExecution['status'],
      nodeExecutions: exec.node_executions?.map(ne => ({
        nodeExecutionId: ne.id,
        nodeId: ne.node_id,
        nodeType: ne.node_type,
        status: ne.status as ActionStatus,
        errorMessage: (ne as Record<string, unknown>).error_message as string | undefined,
      })),
      error: exec.error_message,
      createdAt: exec.created_at,
      updatedAt: exec.completed_at || exec.created_at,
    }));
  },

  /**
   * Abort an execution via REST API
   * 
   * Requirement 8.6: Call abort API when user clicks Stop
   */
  async abortExecution(executionId: string): Promise<WorkflowExecution> {
    const response = await this.apiRequest<{
      id: string;
      status: string;
      abortedAt: string;
    }>(`/executions/${executionId}/abort`, {
      method: 'POST',
    });

    return {
      executionId: response.id,
      status: 'aborted',
      abortedByUser: true,
      updatedAt: response.abortedAt,
    };
  },

  /**
   * Subscribe to execution events via WebSocket
   * 
   * Requirement 8.2: Establish WebSocket connection to receive real-time events
   * 
   * Uses the workflowWebSocketClient singleton to manage WebSocket connections.
   * The client handles:
   * - Automatic connection management
   * - Reconnection with exponential backoff
   * - Heartbeat to keep connection alive
   * - Multiple subscriptions per connection
   */
  subscribe(executionId: string, callback: EventCallback): () => void {
    // Use the WebSocket client for real-time events
    const unsubscribe = workflowWebSocketClient.subscribe(executionId, callback);
    
    return unsubscribe;
  },
};

// ============================================================================
// Mock Service (for development/testing)
// ============================================================================

const SIMULATED_DELAY = 500;
const NODE_EXECUTION_TIME = { min: 1000, max: 3000 };

// In-memory store for executions
const executionStore = new Map<string, WorkflowExecution>();
const eventListeners = new Map<string, Set<EventCallback>>();

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(): number {
  return Math.floor(
    Math.random() * (NODE_EXECUTION_TIME.max - NODE_EXECUTION_TIME.min) + 
    NODE_EXECUTION_TIME.min
  );
}

/**
 * Emit a workflow event to all listeners
 */
function emitEvent(executionId: string, event: WorkflowEvent): void {
  const listeners = eventListeners.get(executionId);
  if (listeners) {
    listeners.forEach(callback => {
      try {
        callback(event);
      } catch (err) {
        console.error('Event listener error:', err);
      }
    });
  }
}

/**
 * Simulate node execution
 */
async function simulateNodeExecution(
  executionId: string,
  node: WorkflowNode,
  abortSignal?: AbortSignal
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  // Emit node started
  emitEvent(executionId, {
    type: 'node:started',
    executionId,
    nodeId: node.nodeId,
    data: { status: 'executing' },
    timestamp: new Date(),
  });

  const executionTime = randomDelay();
  const progressInterval = 100;
  let progress = 0;

  // Simulate progress updates
  while (progress < 100) {
    if (abortSignal?.aborted) {
      return { success: false, error: 'Execution aborted' };
    }

    await delay(progressInterval);
    progress = Math.min(100, progress + (progressInterval / executionTime) * 100);

    emitEvent(executionId, {
      type: 'node:progress',
      executionId,
      nodeId: node.nodeId,
      data: { progress: Math.round(progress) },
      timestamp: new Date(),
    });
  }

  // Simulate occasional failures (10% chance for non-start/end nodes)
  const shouldFail = 
    node.nodeType !== 'start' && 
    node.nodeType !== 'end' && 
    Math.random() < 0.1;

  if (shouldFail) {
    const error = `Simulated failure in ${node.title}`;
    emitEvent(executionId, {
      type: 'node:failed',
      executionId,
      nodeId: node.nodeId,
      data: { status: 'failed', error },
      timestamp: new Date(),
    });
    return { success: false, error };
  }

  // Generate mock result based on node type
  const result = generateMockResult(node);

  emitEvent(executionId, {
    type: 'node:completed',
    executionId,
    nodeId: node.nodeId,
    data: { status: 'finish', result },
    timestamp: new Date(),
  });

  return { success: true, result };
}

/**
 * Generate mock result based on node type
 */
function generateMockResult(node: WorkflowNode): unknown {
  switch (node.nodeType) {
    case 'agent':
      return {
        response: `Agent "${node.title}" completed successfully`,
        tokens: Math.floor(Math.random() * 1000) + 100,
        model: 'gpt-4',
      };
    case 'document':
      return {
        documentId: generateId(),
        title: `Generated Document - ${node.title}`,
        content: 'Lorem ipsum dolor sit amet...',
      };
    case 'codeArtifact':
      return {
        language: 'typescript',
        code: '// Generated code\nconsole.log("Hello, World!");',
      };
    case 'humanApproval':
      return {
        approved: true,
        approvedBy: 'system',
        approvedAt: new Date().toISOString(),
      };
    case 'action':
      return {
        actionType: 'completed',
        output: { success: true },
      };
    default:
      return { completed: true };
  }
}

/**
 * Mock Workflow Execution Service
 * Uses in-memory simulation for development and testing.
 */
export const MockWorkflowExecutionService = {
  /**
   * Execute a workflow
   */
  async executeWorkflow(params: ExecuteWorkflowParams): Promise<WorkflowExecution> {
    const { canvasData, variables = [], startNodeIds, title, canvasId } = params;

    // Validate workflow
    const validation = validateWorkflow(canvasData);
    if (!validation.valid) {
      throw new WorkflowExecutionError(
        `Workflow validation failed: ${validation.errors.join(', ')}`,
        'VALIDATION_ERROR'
      );
    }

    // Create execution record
    const executionId = generateId();
    const execution: WorkflowExecution = {
      executionId,
      canvasId,
      title: title || 'Workflow Execution',
      status: 'init',
      nodeExecutions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    executionStore.set(executionId, execution);

    // Prepare node executions
    const prepareParams: PrepareNodeExecutionsParams = {
      executionId,
      canvasData,
      variables,
      startNodes: startNodeIds,
    };

    const { nodeExecutions, startNodes } = prepareNodeExecutions(prepareParams);

    // Convert to execution records
    execution.nodeExecutions = nodeExecutions.map(node => ({
      nodeExecutionId: generateId(),
      nodeId: node.nodeId,
      nodeType: node.nodeType,
      nodeData: JSON.stringify(node.node),
      entityId: node.entityId,
      title: node.title,
      status: node.status,
      progress: 0,
      parentNodeIds: JSON.stringify(node.parentNodeIds),
      childNodeIds: JSON.stringify(node.childNodeIds),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    // Start execution asynchronously
    this._runExecution(executionId, nodeExecutions, startNodes);

    return execution;
  },

  /**
   * Internal: Run the execution (async, non-blocking)
   */
  async _runExecution(
    executionId: string,
    nodeExecutions: WorkflowNode[],
    startNodes: string[]
  ): Promise<void> {
    const execution = executionStore.get(executionId);
    if (!execution) return;

    // Update status to executing
    execution.status = 'executing';
    execution.updatedAt = new Date().toISOString();

    emitEvent(executionId, {
      type: 'workflow:started',
      executionId,
      data: { status: 'executing' },
      timestamp: new Date(),
    });

    // Build execution order (topological sort already done in prepareNodeExecutions)
    const nodeMap = new Map(nodeExecutions.map(n => [n.nodeId, n]));
    const completedNodes = new Set<string>();
    const failedNodes = new Set<string>();

    // Execute nodes in order
    const queue = [...startNodes];
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId);
      
      if (!node || completedNodes.has(nodeId) || failedNodes.has(nodeId)) {
        continue;
      }

      // Check if all parents are completed
      const allParentsCompleted = node.parentNodeIds.every(
        pid => completedNodes.has(pid) || !nodeMap.has(pid)
      );

      if (!allParentsCompleted) {
        // Re-queue for later
        queue.push(nodeId);
        continue;
      }

      // Execute node
      const result = await simulateNodeExecution(executionId, node);

      // Update node execution record
      const nodeExec = execution.nodeExecutions?.find(ne => ne.nodeId === nodeId);
      if (nodeExec) {
        nodeExec.status = result.success ? 'finish' : 'failed';
        nodeExec.progress = 100;
        nodeExec.errorMessage = result.error;
        nodeExec.updatedAt = new Date().toISOString();
      }

      if (result.success) {
        completedNodes.add(nodeId);
        // Add children to queue
        queue.push(...node.childNodeIds);
      } else {
        failedNodes.add(nodeId);
        // Mark workflow as failed
        execution.status = 'failed';
        execution.updatedAt = new Date().toISOString();

        emitEvent(executionId, {
          type: 'workflow:failed',
          executionId,
          data: { error: result.error },
          timestamp: new Date(),
        });
        return;
      }
    }

    // All nodes completed successfully
    execution.status = 'finish';
    execution.updatedAt = new Date().toISOString();

    emitEvent(executionId, {
      type: 'workflow:completed',
      executionId,
      data: { status: 'finish' },
      timestamp: new Date(),
    });
  },

  /**
   * Get execution by ID
   */
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    await delay(SIMULATED_DELAY);
    
    const execution = executionStore.get(executionId);
    if (!execution) {
      throw new WorkflowExecutionError(
        `Execution "${executionId}" not found`,
        'NOT_FOUND'
      );
    }

    return { ...execution };
  },

  /**
   * Get all executions for a canvas/workflow
   */
  async getExecutionsByCanvas(canvasId: string): Promise<WorkflowExecution[]> {
    await delay(SIMULATED_DELAY);
    
    const executions: WorkflowExecution[] = [];
    executionStore.forEach(exec => {
      if (exec.canvasId === canvasId) {
        executions.push({ ...exec });
      }
    });

    return executions.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  },

  /**
   * Abort an execution
   */
  async abortExecution(executionId: string): Promise<WorkflowExecution> {
    await delay(SIMULATED_DELAY);
    
    const execution = executionStore.get(executionId);
    if (!execution) {
      throw new WorkflowExecutionError(
        `Execution "${executionId}" not found`,
        'NOT_FOUND'
      );
    }

    if (execution.status !== 'executing') {
      throw new WorkflowExecutionError(
        `Cannot abort execution in "${execution.status}" status`,
        'VALIDATION_ERROR'
      );
    }

    execution.status = 'aborted';
    execution.abortedByUser = true;
    execution.updatedAt = new Date().toISOString();

    emitEvent(executionId, {
      type: 'workflow:aborted',
      executionId,
      data: { abortedByUser: true },
      timestamp: new Date(),
    });

    return { ...execution };
  },

  /**
   * Subscribe to execution events
   */
  subscribe(executionId: string, callback: EventCallback): () => void {
    if (!eventListeners.has(executionId)) {
      eventListeners.set(executionId, new Set());
    }
    
    eventListeners.get(executionId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = eventListeners.get(executionId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          eventListeners.delete(executionId);
        }
      }
    };
  },

  /**
   * Reset store (for testing)
   */
  resetStore(): void {
    executionStore.clear();
    eventListeners.clear();
  },
};

// ============================================================================
// Service Interface & Export
// ============================================================================

export interface IWorkflowExecutionService {
  executeWorkflow(params: ExecuteWorkflowParams): Promise<WorkflowExecution>;
  getExecution(executionId: string): Promise<WorkflowExecution>;
  getExecutionsByCanvas(canvasId: string): Promise<WorkflowExecution[]>;
  abortExecution(executionId: string): Promise<WorkflowExecution>;
  subscribe(executionId: string, callback: EventCallback): () => void;
  resetStore?(): void;
}

/**
 * Get the appropriate workflow execution service based on configuration.
 * 
 * - REST mode: Uses RestWorkflowExecutionService to call backend API
 * - Mock mode: Uses MockWorkflowExecutionService for development/testing
 */
function getWorkflowExecutionService(): IWorkflowExecutionService {
  const { mode } = getApiConfig();
  
  if (mode === 'rest') {
    console.log('[WorkflowExecutionService] Using REST API mode');
    return RestWorkflowExecutionService;
  }
  
  console.log('[WorkflowExecutionService] Using Mock mode');
  return MockWorkflowExecutionService;
}

// Export the service based on configuration
export const WorkflowExecutionService: IWorkflowExecutionService = getWorkflowExecutionService();

// Also export individual services for direct access if needed
export { RestWorkflowExecutionService as RestService };
export { MockWorkflowExecutionService as MockService };

export default WorkflowExecutionService;
