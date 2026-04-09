/**
 * Workflow Execution Service
 *
 * Orchestrates workflow execution using BullMQ job queues with Redis.
 * Implements the agentic pattern with distributed coordination via Redis locks
 * and polling-based orchestration.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5 - Backend execution API and validation
 */

import { EventEmitter } from 'events';
import { workflowExecutionRepository } from '../repositories/workflow-execution.repository.js';
import { workflowQueueService, type RunWorkflowJobData } from './workflow-queue.service.js';
import { redisService } from './redis.service.js';
import {
  validateWorkflow,
  prepareNodeExecutions,
  generateExecutionId,
  buildNodeGraph,
} from '../utils/workflow-graph.js';
import { EXECUTION_TIMEOUT_MS } from '../config/queue.js';
import type { PollWorkflowJobData } from './workflow-queue.service.js';
import { AppError } from '../middleware/errorHandler.js';
import type {
  InitializeExecutionParams,
  ExecutionUser,
  WorkflowEvent,
  WorkflowEventType,
  CanvasData,
  CanvasNode,
  CanvasNodeType,
  WorkflowVariableDefinition,
  VariableValue,
} from '../types/workflow-execution.js';
import {
  nodeExecutorRegistry,
  type NodeExecutionContext,
  type NodeExecutionResult,
} from './node-executors/index.js';

/**
 * Node execution result
 * @deprecated Use NodeExecutionResult from node-executors module
 */
export type { NodeExecutionResult } from './node-executors/index.js';

/**
 * Node execution context
 * @deprecated Use NodeExecutionContext from node-executors module
 */
export type { NodeExecutionContext } from './node-executors/index.js';

/**
 * Workflow Execution Service
 *
 * Main service for orchestrating workflow execution.
 */
export class WorkflowExecutionService extends EventEmitter {
  /**
   * Initialize workflow execution
   *
   * This is the entry point for starting a workflow execution.
   * It validates the workflow, creates execution records, enqueues start nodes,
   * and schedules the first poll job.
   *
   * Requirements:
   * - 1.1: Create execution session and return execution ID
   * - 1.2: Validate workflow structure before starting
   * - 1.3: Return descriptive error if validation fails
   * - 1.4: Persist execution state to database
   * - 2.1: Identify root nodes as starting points
   *
   * @param user - User context (id and organizationId)
   * @param workflowId - The workflow ID
   * @param params - Execution parameters
   * @returns The execution ID
   * @throws AppError if validation fails or active execution exists
   */
  async initializeWorkflowExecution(
    user: ExecutionUser,
    workflowId: string,
    params: InitializeExecutionParams
  ): Promise<string> {
    const { canvasData, variables, startNodeIds, title } = params;

    // 1. Validate workflow structure
    // Property 1: Workflow Validation Correctness
    const validationResult = validateWorkflow(canvasData);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors
        .map((e) => e.message)
        .join('; ');
      throw AppError.validation(`Invalid workflow structure: ${errorMessages}`);
    }

    // 2. Check for active executions (only one per workflow)
    const activeExecution = await workflowExecutionRepository.findActiveExecution(
      workflowId,
      user.organizationId
    );
    if (activeExecution) {
      throw AppError.conflict(
        `Workflow already has an active execution: ${activeExecution.id}`
      );
    }

    // 3. Prepare node executions with topological sort
    // Property 4: Root Node Identification
    const { nodeExecutions, startNodes } = prepareNodeExecutions(
      generateExecutionId(),
      canvasData,
      variables,
      startNodeIds
    );

    // Use provided start nodes or identified start nodes
    const effectiveStartNodes = startNodeIds?.length ? startNodeIds : startNodes;

    if (effectiveStartNodes.length === 0) {
      throw AppError.validation('No start nodes found in workflow');
    }

    // 4. Create execution records in transaction
    const executionId = await workflowExecutionRepository.createWithNodes(
      {
        workflowId,
        organizationId: user.organizationId,
        userId: user.id,
        canvasData,
        variables,
        title,
      },
      nodeExecutions
    );

    // 5. Update execution status to executing
    await workflowExecutionRepository.updateStatus(executionId, 'executing');

    // 6. Emit workflow started event
    this.emitWorkflowEvent('workflow:started', executionId);

    // 7. Enqueue start nodes to run-workflow queue
    for (const nodeId of effectiveStartNodes) {
      await workflowQueueService.addRunWorkflowJob({
        executionId,
        nodeId,
        userId: user.id,
      });
    }

    // 8. Schedule first poll job
    await workflowQueueService.addPollWorkflowJob({
      executionId,
      userId: user.id,
    });

    return executionId;
  }

  /**
   * Get execution by ID
   *
   * @param executionId - Execution ID
   * @param organizationId - Organization ID
   * @returns Execution with node executions
   */
  async getExecution(executionId: string, organizationId: string) {
    const execution = await workflowExecutionRepository.findByIdWithNodes(
      executionId,
      organizationId
    );

    if (!execution) {
      throw AppError.notFound(`Execution not found: ${executionId}`);
    }

    return execution;
  }

  /**
   * Get execution history for a workflow
   *
   * @param workflowId - Workflow ID
   * @param organizationId - Organization ID
   * @param options - Pagination options
   * @returns Paginated list of executions
   */
  async getExecutionHistory(
    workflowId: string,
    organizationId: string,
    options?: { page?: number; limit?: number; userId?: string }
  ) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      workflowExecutionRepository.findByWorkflowId(workflowId, organizationId, {
        skip,
        take: limit,
        userId: options?.userId,
      }),
      workflowExecutionRepository.countByWorkflowId(workflowId, organizationId, options?.userId),
    ]);

    return {
      data: executions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Abort a running workflow execution
   *
   * This method stops a running workflow execution by:
   * 1. Checking if the execution is in a non-terminal state
   * 2. Marking all pending/executing nodes as failed with abort reason
   * 3. Updating the execution status to 'aborted'
   * 4. Emitting workflow:aborted event
   *
   * Requirements:
   * - 7.1: Stop queuing new nodes for execution
   * - 7.2: Attempt to cancel any currently executing nodes
   * - 7.3: Update execution status to aborted
   * - 7.4: Emit workflow:aborted event when abortion completes
   *
   * @param executionId - Execution ID to abort
   * @param organizationId - Organization ID for authorization
   * @returns The aborted execution
   * @throws AppError if execution not found or already in terminal state
   */
  async abortExecution(executionId: string, organizationId: string) {
    // 1. Get execution and verify it exists
    const execution = await workflowExecutionRepository.findByIdWithNodes(
      executionId,
      organizationId
    );

    if (!execution) {
      throw AppError.notFound(`Execution not found: ${executionId}`);
    }

    // 2. Check if execution is in a terminal state
    if (this.isTerminalState(execution.status)) {
      throw AppError.conflict(
        `Cannot abort execution in terminal state: ${execution.status}`
      );
    }

    // 3. Mark all pending/executing nodes as failed with abort reason
    const activeNodes = execution.node_executions.filter(
      (ne) => ne.status === 'init' || ne.status === 'waiting' || ne.status === 'executing'
    );

    for (const nodeExec of activeNodes) {
      await workflowExecutionRepository.updateNodeStatus(
        executionId,
        nodeExec.node_id,
        'failed',
        {
          error: {
            message: 'Execution aborted by user',
          },
        }
      );

      // Emit node:failed event for each aborted node
      this.emitWorkflowEvent('node:failed', executionId, nodeExec.node_id, {
        status: 'failed',
        error: 'Execution aborted by user',
        errorCode: 'ABORTED',
      });
    }

    // 4. Update execution status to aborted
    await workflowExecutionRepository.updateStatus(executionId, 'aborted', {
      message: 'Execution aborted by user',
    });

    // 5. Emit workflow:aborted event
    this.emitWorkflowEvent('workflow:aborted', executionId, undefined, {
      abortedByUser: true,
      abortedNodesCount: activeNodes.length,
      abortedNodeIds: activeNodes.map((n) => n.node_id),
    });

    console.log(`🛑 Execution ${executionId} aborted. ${activeNodes.length} node(s) were cancelled.`);

    // 6. Return updated execution
    return workflowExecutionRepository.findByIdWithNodes(executionId, organizationId);
  }

  /**
   * Emit a node progress event
   *
   * This method allows node executors to emit progress updates during
   * long-running operations. Progress events help the frontend display
   * real-time progress indicators.
   *
   * Requirements:
   * - 5.3: When a node is executing, emit progress updates at regular intervals
   *
   * @param executionId - Execution ID
   * @param nodeId - Node ID
   * @param progress - Progress percentage (0-100)
   * @param message - Optional progress message
   */
  emitNodeProgress(
    executionId: string,
    nodeId: string,
    progress: number,
    message?: string
  ): void {
    // Clamp progress to 0-100
    const clampedProgress = Math.max(0, Math.min(100, progress));

    this.emitWorkflowEvent('node:progress', executionId, nodeId, {
      status: 'executing',
      progress: clampedProgress,
      message,
    });
  }

  /**
   * Run a single workflow node
   *
   * This method is called by the RunWorkflowProcessor when processing jobs
   * from the run-workflow queue. It handles the complete lifecycle of
   * executing a single node.
   *
   * Requirements:
   * - 2.2: Execute nodes in topological order, ensuring parent nodes complete before child nodes begin
   * - 2.3: When a node has multiple parent nodes, wait for all parents to complete before executing
   * - 2.4: When a node completes successfully, immediately queue its child nodes for execution
   * - 2.5: If a node fails, halt execution of all downstream nodes in that branch
   *
   * @param data - Job data containing executionId, nodeId, and userId
   */
  async runWorkflow(data: RunWorkflowJobData): Promise<void> {
    const { executionId, nodeId, userId } = data;

    // 1. Acquire distributed lock to prevent duplicate execution
    // This ensures only one worker processes this node at a time
    const releaseLock = await redisService.acquireNodeLock(executionId, nodeId);
    if (!releaseLock) {
      // Another worker is handling this node, skip
      console.log(`⏭️ Skipping node ${nodeId} - lock not acquired`);
      return;
    }

    try {
      // 2. Get node execution record
      const nodeExecution = await workflowExecutionRepository.getNodeExecution(
        executionId,
        nodeId
      );

      if (!nodeExecution) {
        console.error(`❌ Node execution not found: ${executionId}/${nodeId}`);
        return;
      }

      // 3. Check if node is already processed (idempotency check)
      if (nodeExecution.status !== 'init' && nodeExecution.status !== 'waiting') {
        console.log(`⏭️ Node ${nodeId} already processed with status: ${nodeExecution.status}`);
        return;
      }

      // 4. Validate all parents are complete
      // Property 5: Topological Execution Order
      const parentsComplete = await this.areParentsComplete(executionId, nodeId);
      if (!parentsComplete) {
        // Update status to waiting and return - poll job will re-queue when ready
        await workflowExecutionRepository.updateNodeStatus(
          executionId,
          nodeId,
          'waiting'
        );
        console.log(`⏳ Node ${nodeId} waiting for parent nodes to complete`);
        return;
      }

      // 5. Atomically transition to executing status
      await workflowExecutionRepository.updateNodeStatus(
        executionId,
        nodeId,
        'executing'
      );

      // 6. Emit node started event
      this.emitWorkflowEvent('node:started', executionId, nodeId, {
        status: 'executing',
      });

      // 7. Build execution context with parent outputs
      const context = await this.buildExecutionContext(executionId, nodeId);

      // 8. Execute node based on type
      const nodeData = nodeExecution.node_data as CanvasNode;
      const nodeType = nodeExecution.node_type as CanvasNodeType;
      
      let result: NodeExecutionResult;
      try {
        result = await this.executeNode(nodeType, nodeData, context);
      } catch (error) {
        // Capture execution error
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        result = {
          success: false,
          error: errorMessage,
          errorStack,
        };
      }

      // 9. Update status based on result
      if (result.success) {
        // Update node status to finish with output
        await workflowExecutionRepository.updateNodeStatus(
          executionId,
          nodeId,
          'finish',
          {
            outputData: result.output,
            progress: 100,
          }
        );

        // Emit node completed event
        this.emitWorkflowEvent('node:completed', executionId, nodeId, {
          status: 'finish',
          result: result.output,
        });

        // 10. Queue child nodes for execution (Requirement 2.4)
        await this.queueChildNodes(executionId, nodeId, userId);
      } else {
        // Update node status to failed with error
        await workflowExecutionRepository.updateNodeStatus(
          executionId,
          nodeId,
          'failed',
          {
            error: {
              message: result.error || 'Unknown error',
              stack: result.errorStack,
            },
          }
        );

        // Emit node failed event
        this.emitWorkflowEvent('node:failed', executionId, nodeId, {
          status: 'failed',
          error: result.error,
        });

        // 11. Mark downstream nodes as skipped (Requirement 2.5)
        await this.skipDownstreamNodes(executionId, nodeId);
      }
    } finally {
      // 12. Release lock
      await releaseLock();
    }
  }

  /**
   * Poll workflow execution state
   *
   * This method is called by the PollWorkflowProcessor to check execution state,
   * enqueue ready nodes, and determine if execution is complete.
   *
   * Requirements:
   * - 2.2: Execute nodes in topological order
   * - 2.3: Wait for all parents to complete before executing child node
   * - 6.5: When all executable paths have completed or failed, determine overall execution status
   *
   * @param data - Job data containing executionId and userId
   */
  async pollWorkflow(data: PollWorkflowJobData): Promise<void> {
    const { executionId, userId } = data;

    // 1. Acquire poll lock to prevent duplicate polling
    const releaseLock = await redisService.acquirePollLock(executionId);
    if (!releaseLock) {
      // Another worker is handling this poll, skip
      console.log(`⏭️ Skipping poll for execution ${executionId} - lock not acquired`);
      return;
    }

    try {
      // 2. Get execution with node executions
      const execution = await workflowExecutionRepository.findByIdWithNodes(
        executionId,
        '' // organizationId not needed for this query
      );

      if (!execution) {
        console.error(`❌ Execution not found: ${executionId}`);
        return;
      }

      // 3. Check if execution is in terminal state
      if (this.isTerminalState(execution.status)) {
        console.log(`⏭️ Execution ${executionId} is in terminal state: ${execution.status}`);
        return;
      }

      // 4. Check for execution timeout
      if (this.isTimedOut(execution.started_at)) {
        console.log(`⏰ Execution ${executionId} timed out`);
        await this.handleExecutionTimeout(executionId, execution);
        return;
      }

      // 5. Find ready nodes (all parents complete, status is init or waiting)
      const readyNodes = await this.findReadyNodes(execution);

      // 6. Enqueue ready nodes to run-workflow queue
      for (const nodeId of readyNodes) {
        await workflowQueueService.addRunWorkflowJob({
          executionId,
          nodeId,
          userId,
        });
        console.log(`📤 Poll enqueued node ${nodeId} for execution`);
      }

      // 7. Check if execution is complete
      const isComplete = this.isExecutionComplete(execution.node_executions);
      if (isComplete) {
        // Determine final status based on node statuses
        const finalStatus = this.determineExecutionStatus(execution.node_executions);
        
        if (finalStatus === 'finish') {
          await this.markExecutionComplete(executionId);
        } else {
          await this.markExecutionFailed(executionId, 'One or more nodes failed');
        }
        return;
      }

      // 8. Reschedule poll if not complete
      await workflowQueueService.addPollWorkflowJob({
        executionId,
        userId,
      });
      console.log(`🔄 Rescheduled poll for execution ${executionId}`);
    } finally {
      // 9. Release lock
      await releaseLock();
    }
  }

  /**
   * Check if execution status is terminal (no more processing needed)
   *
   * @param status - Execution status
   * @returns True if status is terminal
   */
  private isTerminalState(status: string): boolean {
    return status === 'finish' || status === 'failed' || status === 'aborted';
  }

  /**
   * Check if execution has timed out
   *
   * @param startedAt - Execution start time
   * @returns True if execution has exceeded timeout
   */
  private isTimedOut(startedAt: Date): boolean {
    const elapsed = Date.now() - startedAt.getTime();
    return elapsed > EXECUTION_TIMEOUT_MS;
  }

  /**
   * Handle execution timeout
   *
   * When an execution times out, this method:
   * 1. Marks all executing/waiting nodes as failed with timeout error
   * 2. Emits node:failed events for each timed-out node
   * 3. Marks the execution as failed with timeout error
   * 4. Emits workflow:failed event
   *
   * Requirements:
   * - 6.1: Capture error message and stack trace on failure
   * - 6.2: Update node status to failed and store error details
   *
   * @param executionId - Execution ID
   * @param execution - Execution with node executions
   */
  private async handleExecutionTimeout(
    executionId: string,
    execution: { 
      started_at: Date; 
      node_executions: Array<{ node_id: string; status: string }> 
    }
  ): Promise<void> {
    const timeoutError = new Error('Execution timeout exceeded');
    const elapsedMs = Date.now() - execution.started_at.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
    
    const timeoutMessage = `Execution timeout exceeded after ${elapsedMinutes}m ${elapsedSeconds}s (limit: ${EXECUTION_TIMEOUT_MS / 60000}m)`;
    
    // Find all nodes that are still executing or waiting
    const activeNodes = execution.node_executions.filter(
      (ne) => ne.status === 'executing' || ne.status === 'waiting' || ne.status === 'init'
    );

    // Mark each active node as failed with timeout error
    // Requirements 6.1, 6.2: Capture error details and update node status
    for (const nodeExec of activeNodes) {
      await workflowExecutionRepository.updateNodeStatus(
        executionId,
        nodeExec.node_id,
        'failed',
        {
          error: {
            message: timeoutMessage,
            stack: timeoutError.stack,
          },
        }
      );

      // Emit node:failed event for each timed-out node
      this.emitWorkflowEvent('node:failed', executionId, nodeExec.node_id, {
        status: 'failed',
        error: timeoutMessage,
        errorCode: 'TIMEOUT_ERROR',
      });

      console.log(`⏰ Node ${nodeExec.node_id} marked as failed due to timeout`);
    }

    // Mark execution as failed with timeout error
    await workflowExecutionRepository.updateStatus(executionId, 'failed', {
      message: timeoutMessage,
      stack: timeoutError.stack,
    });

    // Emit workflow:failed event
    this.emitWorkflowEvent('workflow:failed', executionId, undefined, {
      error: timeoutMessage,
      errorCode: 'TIMEOUT_ERROR',
      timedOutNodes: activeNodes.map((n) => n.node_id),
    });

    console.log(`⏰ Execution ${executionId} failed due to timeout. ${activeNodes.length} node(s) were still active.`);
  }

  /**
   * Find nodes that are ready to execute
   *
   * A node is ready when:
   * - Its status is 'init' or 'waiting'
   * - All parent nodes have status 'finish'
   *
   * Property 5: Topological Execution Order
   * For any node with multiple parents, all parents SHALL complete before the node begins.
   *
   * @param execution - Execution with node executions
   * @returns Array of ready node IDs
   */
  private async findReadyNodes(
    execution: { canvas_data: unknown; node_executions: Array<{ node_id: string; status: string }> }
  ): Promise<string[]> {
    const canvasData = execution.canvas_data as CanvasData;
    const nodeGraph = buildNodeGraph(canvasData);
    const readyNodes: string[] = [];

    // Create a map of node statuses for quick lookup
    const nodeStatusMap = new Map<string, string>();
    for (const nodeExec of execution.node_executions) {
      nodeStatusMap.set(nodeExec.node_id, nodeExec.status);
    }

    // Check each node to see if it's ready
    for (const nodeExec of execution.node_executions) {
      // Only consider nodes that are init or waiting
      if (nodeExec.status !== 'init' && nodeExec.status !== 'waiting') {
        continue;
      }

      const workflowNode = nodeGraph.get(nodeExec.node_id);
      if (!workflowNode) {
        continue;
      }

      // Check if all parents are complete
      let allParentsComplete = true;
      for (const parentId of workflowNode.parentNodeIds) {
        const parentStatus = nodeStatusMap.get(parentId);
        if (parentStatus !== 'finish') {
          allParentsComplete = false;
          break;
        }
      }

      if (allParentsComplete) {
        readyNodes.push(nodeExec.node_id);
      }
    }

    return readyNodes;
  }

  /**
   * Check if execution is complete
   *
   * Execution is complete when all nodes are in a terminal state
   * (finish, failed, or skipped due to upstream failure).
   *
   * Requirement 6.5: When all executable paths have completed or failed,
   * determine overall execution status.
   *
   * @param nodeExecutions - Array of node executions
   * @returns True if all nodes are in terminal state
   */
  private isExecutionComplete(
    nodeExecutions: Array<{ status: string }>
  ): boolean {
    for (const nodeExec of nodeExecutions) {
      // If any node is still init, waiting, or executing, not complete
      if (
        nodeExec.status === 'init' ||
        nodeExec.status === 'waiting' ||
        nodeExec.status === 'executing'
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Determine final execution status based on node statuses
   *
   * Requirement 6.5: When all executable paths have completed or failed,
   * determine overall execution status.
   *
   * @param nodeExecutions - Array of node executions
   * @returns 'finish' if all nodes succeeded, 'failed' if any failed
   */
  private determineExecutionStatus(
    nodeExecutions: Array<{ status: string }>
  ): 'finish' | 'failed' {
    for (const nodeExec of nodeExecutions) {
      if (nodeExec.status === 'failed') {
        return 'failed';
      }
    }
    return 'finish';
  }

  /**
   * Mark execution as complete
   *
   * @param executionId - Execution ID
   */
  private async markExecutionComplete(executionId: string): Promise<void> {
    await workflowExecutionRepository.updateStatus(executionId, 'finish');
    this.emitWorkflowEvent('workflow:completed', executionId);
    console.log(`✅ Execution ${executionId} completed successfully`);
  }

  /**
   * Mark execution as failed
   *
   * @param executionId - Execution ID
   * @param errorMessage - Error message
   */
  private async markExecutionFailed(
    executionId: string,
    errorMessage: string
  ): Promise<void> {
    await workflowExecutionRepository.updateStatus(executionId, 'failed', {
      message: errorMessage,
    });
    this.emitWorkflowEvent('workflow:failed', executionId, undefined, {
      error: errorMessage,
    });
    console.log(`❌ Execution ${executionId} failed: ${errorMessage}`);
  }

  /**
   * Check if all parent nodes of a given node are complete
   *
   * Property 5: Topological Execution Order
   * For any node with multiple parents, all parents SHALL complete before the node begins.
   *
   * @param executionId - Execution ID
   * @param nodeId - Node ID to check parents for
   * @returns True if all parents are complete
   */
  private async areParentsComplete(
    executionId: string,
    nodeId: string
  ): Promise<boolean> {
    // Get the execution with canvas data to build the graph
    const execution = await workflowExecutionRepository.findByIdWithNodes(
      executionId,
      '' // organizationId not needed for this query
    );

    if (!execution) {
      return false;
    }

    const canvasData = execution.canvas_data as CanvasData;
    const nodeGraph = buildNodeGraph(canvasData);
    const workflowNode = nodeGraph.get(nodeId);

    if (!workflowNode) {
      return false;
    }

    // If no parents, node is ready
    if (workflowNode.parentNodeIds.length === 0) {
      return true;
    }

    // Check each parent's status
    for (const parentId of workflowNode.parentNodeIds) {
      const parentExecution = execution.node_executions.find(
        (ne) => ne.node_id === parentId
      );

      if (!parentExecution) {
        return false;
      }

      // Parent must be in 'finish' status
      // Note: We don't consider 'failed' parents as complete - the child should not execute
      if (parentExecution.status !== 'finish') {
        return false;
      }
    }

    return true;
  }

  /**
   * Build execution context with parent node outputs
   *
   * @param executionId - Execution ID
   * @param nodeId - Current node ID
   * @returns Execution context with parent outputs
   */
  private async buildExecutionContext(
    executionId: string,
    nodeId: string
  ): Promise<NodeExecutionContext> {
    const execution = await workflowExecutionRepository.findByIdWithNodes(
      executionId,
      ''
    );

    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    // Build node outputs map from all completed nodes
    const nodeOutputs = new Map<string, unknown>();
    for (const nodeExec of execution.node_executions) {
      if (nodeExec.status === 'finish' && nodeExec.output_data) {
        nodeOutputs.set(nodeExec.node_id, nodeExec.output_data);
      }
    }

    // Build variables map
    // Requirement 1.5: Substitute variable values into node configurations before execution
    const variables = new Map<string, unknown>();
    const variablesDef = execution.variables as WorkflowVariableDefinition[];
    if (Array.isArray(variablesDef)) {
      for (const v of variablesDef) {
        // Extract the actual value from the VariableValue array
        const extractedValue = this.extractVariableValue(v);
        variables.set(v.name, extractedValue);
      }
    }

    // Extract workflow and scope IDs from execution record
    const workflowId = (execution as Record<string, unknown>).workflow_id as string | undefined;
    const organizationId = (execution as Record<string, unknown>).organization_id as string | undefined;
    const userId = (execution as Record<string, unknown>).user_id as string | undefined;

    // Get business_scope_id from the workflow if available
    let businessScopeId: string | undefined;
    if (workflowId && organizationId) {
      try {
        const { workflowRepository } = await import('../repositories/workflow.repository.js');
        const workflow = await workflowRepository.findById(workflowId, organizationId);
        businessScopeId = workflow?.business_scope_id ?? undefined;
      } catch { /* non-critical */ }
    }

    return {
      executionId,
      nodeId,
      nodeOutputs,
      variables,
      organizationId,
      userId,
      workflowId,
      businessScopeId,
    };
  }

  /**
   * Extract the actual value from a WorkflowVariableDefinition
   *
   * Handles both string and resource variable types:
   * - For string/text variables: extracts the text value
   * - For resource variables: extracts the resource metadata
   * - For single values: returns the value directly
   * - For multiple values: returns an array of values
   *
   * Requirement 1.5: Substitute variable values into node configurations before execution
   *
   * @param variable - The workflow variable definition
   * @returns The extracted value (string, resource object, or array)
   */
  private extractVariableValue(variable: WorkflowVariableDefinition): unknown {
    const values = variable.value;

    // Handle empty or undefined values
    if (!values || !Array.isArray(values) || values.length === 0) {
      return '';
    }

    // Extract values based on type
    const extractedValues = values.map((v: VariableValue) => {
      if (v.type === 'text') {
        // String variable - return the text value
        return v.text ?? '';
      } else if (v.type === 'resource' && v.resource) {
        // Resource variable - return the resource metadata
        return {
          name: v.resource.name,
          fileType: v.resource.fileType,
          fileId: v.resource.fileId,
          storageKey: v.resource.storageKey,
          entityId: v.resource.entityId,
        };
      }
      return '';
    });

    // If single value (isSingle flag or only one value), return directly
    if (variable.isSingle || extractedValues.length === 1) {
      return extractedValues[0];
    }

    // Return array for multiple values
    return extractedValues;
  }

  /**
   * Execute a node based on its type
   *
   * Property 7: Node Type Execution Dispatch
   * For any node type, the node executor SHALL dispatch to the correct type-specific handler.
   *
   * Uses the NodeExecutorRegistry to dispatch to the appropriate executor.
   *
   * @param _nodeType - Type of the node (unused, kept for API compatibility)
   * @param nodeData - Node data
   * @param context - Execution context
   * @returns Execution result
   */
  private async executeNode(
    _nodeType: CanvasNodeType,
    nodeData: CanvasNode,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    // Use the executor registry to dispatch to the correct executor
    return nodeExecutorRegistry.execute({
      node: nodeData,
      context,
    });
  }

  /**
   * Queue child nodes for execution after a node completes successfully
   *
   * Requirement 2.4: When a node completes successfully, immediately queue
   * its child nodes for execution.
   *
   * @param executionId - Execution ID
   * @param nodeId - Completed node ID
   * @param userId - User ID
   */
  private async queueChildNodes(
    executionId: string,
    nodeId: string,
    userId: string
  ): Promise<void> {
    const execution = await workflowExecutionRepository.findByIdWithNodes(
      executionId,
      ''
    );

    if (!execution) {
      return;
    }

    const canvasData = execution.canvas_data as CanvasData;
    const nodeGraph = buildNodeGraph(canvasData);
    const workflowNode = nodeGraph.get(nodeId);

    if (!workflowNode || workflowNode.childNodeIds.length === 0) {
      return;
    }

    // Queue each child node
    for (const childId of workflowNode.childNodeIds) {
      const childExecution = execution.node_executions.find(
        (ne) => ne.node_id === childId
      );

      // Only queue if child is in init or waiting status
      if (childExecution && (childExecution.status === 'init' || childExecution.status === 'waiting')) {
        await workflowQueueService.addRunWorkflowJob({
          executionId,
          nodeId: childId,
          userId,
        });
        console.log(`📤 Queued child node ${childId} for execution`);
      }
    }
  }

  /**
   * Skip all downstream nodes when a node fails
   *
   * Requirement 2.5: If a node fails, halt execution of all downstream nodes
   * in that branch.
   *
   * @param executionId - Execution ID
   * @param failedNodeId - Failed node ID
   */
  private async skipDownstreamNodes(
    executionId: string,
    failedNodeId: string
  ): Promise<void> {
    const execution = await workflowExecutionRepository.findByIdWithNodes(
      executionId,
      ''
    );

    if (!execution) {
      return;
    }

    const canvasData = execution.canvas_data as CanvasData;
    const nodeGraph = buildNodeGraph(canvasData);

    // BFS to find all downstream nodes
    const visited = new Set<string>();
    const queue = [failedNodeId];
    const downstreamNodes: string[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const node = nodeGraph.get(currentId);
      if (!node) continue;

      // Add children to queue and downstream list (except the failed node itself)
      for (const childId of node.childNodeIds) {
        if (!visited.has(childId)) {
          queue.push(childId);
          downstreamNodes.push(childId);
        }
      }
    }

    // Mark all downstream nodes as failed (skipped due to upstream failure)
    for (const nodeId of downstreamNodes) {
      const nodeExec = execution.node_executions.find(
        (ne) => ne.node_id === nodeId
      );

      // Only skip nodes that haven't started yet
      if (nodeExec && (nodeExec.status === 'init' || nodeExec.status === 'waiting')) {
        await workflowExecutionRepository.updateNodeStatus(
          executionId,
          nodeId,
          'failed',
          {
            error: {
              message: `Skipped due to upstream node failure: ${failedNodeId}`,
            },
          }
        );

        this.emitWorkflowEvent('node:failed', executionId, nodeId, {
          status: 'failed',
          error: `Skipped due to upstream node failure: ${failedNodeId}`,
        });

        console.log(`⏭️ Skipped downstream node ${nodeId} due to failure of ${failedNodeId}`);
      }
    }
  }

  /**
   * Emit a workflow event
   *
   * @param type - Event type
   * @param executionId - Execution ID
   * @param nodeId - Optional node ID
   * @param data - Optional event data
   */
  emitWorkflowEvent(
    type: WorkflowEventType,
    executionId: string,
    nodeId?: string,
    data?: Record<string, unknown>
  ): void {
    const event: WorkflowEvent = {
      type,
      executionId,
      nodeId,
      data,
      timestamp: new Date(),
    };

    this.emit(type, event);
    this.emit('workflow:event', event);
  }
}

// Singleton instance
export const workflowExecutionService = new WorkflowExecutionService();
