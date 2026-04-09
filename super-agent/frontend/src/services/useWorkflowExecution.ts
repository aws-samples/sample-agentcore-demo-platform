/**
 * useWorkflowExecution Hook
 * 
 * React hook for workflow execution with real-time status updates.
 * 
 * This hook integrates with the WorkflowExecutionService which supports:
 * - REST API calls for execution control (start, abort, get status)
 * - WebSocket connection for real-time event updates
 * 
 * Requirements:
 * - 8.3: WHEN a Workflow_Event is received, THE frontend SHALL update the corresponding Canvas_Node's visual state
 * - 8.4: WHEN a node starts executing, THE frontend SHALL show a loading indicator on that node
 * - 8.5: WHEN a node completes or fails, THE frontend SHALL update the node's visual state to reflect the result
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ActionStatus } from '@/types/canvas';
import type { 
  WorkflowExecution, 
  WorkflowEvent,
} from '@/types/canvas/workflow';
import { 
  WorkflowExecutionService, 
  WorkflowExecutionError,
  type ExecuteWorkflowParams,
} from './workflowExecutionService';

// ============================================================================
// Types
// ============================================================================

export interface NodeExecutionState {
  nodeId: string;
  status: ActionStatus;
  progress: number;
  result?: unknown;
  error?: string;
  /** Timestamp when the node started executing */
  startedAt?: Date;
  /** Timestamp when the node completed or failed */
  completedAt?: Date;
}

export interface UseWorkflowExecutionState {
  /** Current execution */
  execution: WorkflowExecution | null;
  /** Is currently executing */
  isExecuting: boolean;
  /** Node execution states */
  nodeStates: Map<string, NodeExecutionState>;
  /** Error message */
  error: string | null;
  /** Execution history for current canvas */
  history: WorkflowExecution[];
}

export interface UseWorkflowExecutionReturn extends UseWorkflowExecutionState {
  /** Execute a workflow */
  execute: (params: ExecuteWorkflowParams) => Promise<WorkflowExecution | null>;
  /** Abort current execution */
  abort: () => Promise<boolean>;
  /** Get node state by ID */
  getNodeState: (nodeId: string) => NodeExecutionState | undefined;
  /** Load execution history */
  loadHistory: (canvasId: string) => Promise<void>;
  /** Clear error */
  clearError: () => void;
  /** Reset state */
  reset: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useWorkflowExecution(): UseWorkflowExecutionReturn {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [nodeStates, setNodeStates] = useState<Map<string, NodeExecutionState>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkflowExecution[]>([]);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount - ensures WebSocket subscription is properly cleaned up
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        console.log('[useWorkflowExecution] Cleaning up WebSocket subscription on unmount');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  /**
   * Handle workflow events from WebSocket
   * 
   * This callback processes real-time events from the backend and updates
   * the local state accordingly.
   * 
   * Requirements:
   * - 8.3: Update Canvas_Node's visual state when Workflow_Event is received
   * - 8.4: Show loading indicator when node starts executing
   * - 8.5: Update node's visual state when it completes or fails
   */
  const handleEvent = useCallback((event: WorkflowEvent) => {
    if (!isMountedRef.current) return;

    console.log('[useWorkflowExecution] Received event:', event.type, event.nodeId);

    switch (event.type) {
      case 'workflow:started':
        // Requirement 8.3: Update execution state when workflow starts
        setIsExecuting(true);
        break;

      case 'workflow:completed':
      case 'workflow:failed':
      case 'workflow:aborted':
        // Requirement 8.3: Update execution state when workflow ends
        setIsExecuting(false);
        // Refresh execution state from server to get final status
        if (event.executionId) {
          WorkflowExecutionService.getExecution(event.executionId)
            .then(exec => {
              if (isMountedRef.current) {
                setExecution(exec);
                // Update node states from the final execution data
                if (exec.nodeExecutions) {
                  setNodeStates(prev => {
                    const next = new Map(prev);
                    exec.nodeExecutions!.forEach(ne => {
                      const existing = next.get(ne.nodeId);
                      // Only update if we have new information
                      if (ne.status) {
                        next.set(ne.nodeId, {
                          nodeId: ne.nodeId,
                          status: ne.status,
                          progress: ne.progress || (ne.status === 'finish' || ne.status === 'failed' ? 100 : 0),
                          result: existing?.result,
                          error: ne.errorMessage || existing?.error,
                          startedAt: existing?.startedAt,
                          completedAt: ne.status === 'finish' || ne.status === 'failed' 
                            ? new Date() 
                            : existing?.completedAt,
                        });
                      }
                    });
                    return next;
                  });
                }
              }
            })
            .catch(err => {
              console.error('[useWorkflowExecution] Failed to refresh execution:', err);
            });
        }
        break;

      case 'node:started':
        // Requirement 8.4: Show loading indicator when node starts executing
        if (event.nodeId) {
          setNodeStates(prev => {
            const next = new Map(prev);
            next.set(event.nodeId!, {
              nodeId: event.nodeId!,
              status: 'executing',
              progress: 0,
              startedAt: new Date(),
            });
            return next;
          });
        }
        break;

      case 'node:progress':
        // Update progress percentage during execution
        if (event.nodeId && event.data?.progress !== undefined) {
          setNodeStates(prev => {
            const next = new Map(prev);
            const current = next.get(event.nodeId!) || {
              nodeId: event.nodeId!,
              status: 'executing' as ActionStatus,
              progress: 0,
            };
            next.set(event.nodeId!, {
              ...current,
              progress: event.data!.progress as number,
            });
            return next;
          });
        }
        break;

      case 'node:completed':
        // Requirement 8.5: Update node's visual state when it completes
        if (event.nodeId) {
          setNodeStates(prev => {
            const next = new Map(prev);
            const current = next.get(event.nodeId!);
            next.set(event.nodeId!, {
              nodeId: event.nodeId!,
              status: 'finish',
              progress: 100,
              result: event.data?.result,
              startedAt: current?.startedAt,
              completedAt: new Date(),
            });
            return next;
          });
        }
        break;

      case 'node:failed':
        // Requirement 8.5: Update node's visual state when it fails
        if (event.nodeId) {
          setNodeStates(prev => {
            const next = new Map(prev);
            const current = next.get(event.nodeId!);
            next.set(event.nodeId!, {
              nodeId: event.nodeId!,
              status: 'failed',
              progress: 100,
              error: event.data?.error as string,
              startedAt: current?.startedAt,
              completedAt: new Date(),
            });
            return next;
          });
        }
        break;

      default:
        console.warn('[useWorkflowExecution] Unknown event type:', event.type);
    }
  }, []);

  /**
   * Execute a workflow
   * 
   * This function:
   * 1. Cleans up any previous subscription
   * 2. Calls the REST API to start execution
   * 3. Subscribes to WebSocket events for real-time updates
   * 
   * Requirement 8.1: Call backend execution API with canvas data
   * Requirement 8.2: Establish WebSocket connection for real-time events
   */
  const execute = useCallback(async (params: ExecuteWorkflowParams): Promise<WorkflowExecution | null> => {
    // Cleanup previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    setError(null);
    setNodeStates(new Map());
    setIsExecuting(true);

    try {
      // Call REST API to start execution
      const exec = await WorkflowExecutionService.executeWorkflow(params);
      
      if (!isMountedRef.current) return null;

      setExecution(exec);

      // Initialize node states from execution response
      if (exec.nodeExecutions) {
        const states = new Map<string, NodeExecutionState>();
        exec.nodeExecutions.forEach(ne => {
          states.set(ne.nodeId, {
            nodeId: ne.nodeId,
            status: ne.status || 'init',
            progress: ne.progress || 0,
            error: ne.errorMessage,
          });
        });
        setNodeStates(states);
      }

      // Subscribe to WebSocket events for real-time updates
      // The WebSocket client handles:
      // - Automatic connection management
      // - Reconnection with exponential backoff
      // - Re-subscription after reconnection
      console.log('[useWorkflowExecution] Subscribing to execution:', exec.executionId);
      unsubscribeRef.current = WorkflowExecutionService.subscribe(
        exec.executionId,
        handleEvent
      );

      return exec;
    } catch (err) {
      if (!isMountedRef.current) return null;

      const message = err instanceof WorkflowExecutionError 
        ? err.message 
        : 'Failed to execute workflow';
      console.error('[useWorkflowExecution] Execution failed:', message, err);
      setError(message);
      setIsExecuting(false);
      return null;
    }
  }, [handleEvent]);

  /**
   * Abort current execution
   * 
   * Calls the REST API to abort the execution. The WebSocket will receive
   * a workflow:aborted event which will update the state.
   * 
   * Requirement 8.6: Call abort API when user clicks Stop
   */
  const abort = useCallback(async (): Promise<boolean> => {
    if (!execution) {
      console.warn('[useWorkflowExecution] No execution to abort');
      return false;
    }

    try {
      console.log('[useWorkflowExecution] Aborting execution:', execution.executionId);
      await WorkflowExecutionService.abortExecution(execution.executionId);
      
      if (isMountedRef.current) {
        setIsExecuting(false);
      }
      
      return true;
    } catch (err) {
      if (isMountedRef.current) {
        const message = err instanceof WorkflowExecutionError 
          ? err.message 
          : 'Failed to abort execution';
        console.error('[useWorkflowExecution] Abort failed:', message, err);
        setError(message);
      }
      return false;
    }
  }, [execution]);

  /**
   * Get node state by ID
   */
  const getNodeState = useCallback((nodeId: string): NodeExecutionState | undefined => {
    return nodeStates.get(nodeId);
  }, [nodeStates]);

  /**
   * Load execution history for a canvas
   */
  const loadHistory = useCallback(async (canvasId: string): Promise<void> => {
    try {
      const executions = await WorkflowExecutionService.getExecutionsByCanvas(canvasId);
      
      if (isMountedRef.current) {
        setHistory(executions);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const message = err instanceof WorkflowExecutionError 
          ? err.message 
          : 'Failed to load execution history';
        setError(message);
      }
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset state
   * 
   * Cleans up WebSocket subscription and resets all state to initial values.
   */
  const reset = useCallback(() => {
    if (unsubscribeRef.current) {
      console.log('[useWorkflowExecution] Cleaning up WebSocket subscription on reset');
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    setExecution(null);
    setIsExecuting(false);
    setNodeStates(new Map());
    setError(null);
    setHistory([]);
  }, []);

  return {
    execution,
    isExecuting,
    nodeStates,
    error,
    history,
    execute,
    abort,
    getNodeState,
    loadHistory,
    clearError,
    reset,
  };
}

export default useWorkflowExecution;
