/**
 * Workflow Execution Repository
 *
 * Data access layer for workflow execution entities.
 * Handles persistence of execution sessions and node executions.
 *
 * Requirements: 1.4, 9.1 - Execution persistence
 */

import { prisma } from '../config/database.js';
import type {
  CanvasData,
  WorkflowVariableDefinition,
  WorkflowExecutionStatus,
  ActionStatus,
  PreparedNodeExecution,
} from '../types/workflow-execution.js';

/**
 * Workflow execution entity
 */
export interface WorkflowExecutionEntity {
  id: string;
  workflow_id: string;
  organization_id: string;
  user_id: string;
  status: string;
  canvas_data: unknown;
  variables: unknown;
  context: unknown;
  error_message: string | null;
  error_stack: string | null;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Node execution entity
 */
export interface NodeExecutionEntity {
  id: string;
  execution_id: string;
  node_id: string;
  node_type: string;
  node_data: unknown;
  status: string;
  progress: number;
  input_data: unknown | null;
  output_data: unknown | null;
  error_message: string | null;
  error_stack: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create execution input
 */
export interface CreateExecutionInput {
  workflowId: string;
  organizationId: string;
  userId: string;
  canvasData: CanvasData;
  variables?: WorkflowVariableDefinition[];
  title?: string;
}

/**
 * Workflow Execution Repository
 */
export class WorkflowExecutionRepository {
  /**
   * Find active execution for a workflow
   *
   * @param workflowId - Workflow ID
   * @param organizationId - Organization ID
   * @returns Active execution or null
   */
  async findActiveExecution(
    workflowId: string,
    organizationId: string
  ): Promise<WorkflowExecutionEntity | null> {
    return prisma.workflow_executions.findFirst({
      where: {
        workflow_id: workflowId,
        organization_id: organizationId,
        status: {
          in: ['init', 'executing'],
        },
      },
    });
  }

  /**
   * Find execution by ID
   *
   * @param executionId - Execution ID
   * @param organizationId - Organization ID (optional - if not provided, only filters by executionId)
   * @returns Execution or null
   */
  async findById(
    executionId: string,
    organizationId?: string
  ): Promise<WorkflowExecutionEntity | null> {
    const whereClause: { id: string; organization_id?: string } = {
      id: executionId,
    };
    
    // Only add organization_id filter if provided and not empty
    if (organizationId && organizationId.length > 0) {
      whereClause.organization_id = organizationId;
    }
    
    return prisma.workflow_executions.findFirst({
      where: whereClause,
    });
  }

  /**
   * Find execution with node executions
   *
   * @param executionId - Execution ID
   * @param organizationId - Organization ID (optional - if not provided, only filters by executionId)
   * @returns Execution with node executions or null
   */
  async findByIdWithNodes(
    executionId: string,
    organizationId?: string
  ): Promise<(WorkflowExecutionEntity & { node_executions: NodeExecutionEntity[] }) | null> {
    const whereClause: { id: string; organization_id?: string } = {
      id: executionId,
    };
    
    // Only add organization_id filter if provided and not empty
    if (organizationId && organizationId.length > 0) {
      whereClause.organization_id = organizationId;
    }
    
    return prisma.workflow_executions.findFirst({
      where: whereClause,
      include: {
        node_executions: true,
      },
    });
  }

  /**
   * Create execution with node executions in a transaction
   *
   * @param input - Execution input
   * @param nodeExecutions - Prepared node executions
   * @returns Created execution ID
   */
  async createWithNodes(
    input: CreateExecutionInput,
    nodeExecutions: PreparedNodeExecution[]
  ): Promise<string> {
    const result = await prisma.$transaction(async (tx) => {
      // Create the workflow execution
      const execution = await tx.workflow_executions.create({
        data: {
          workflow_id: input.workflowId,
          organization_id: input.organizationId,
          user_id: input.userId,
          status: 'init',
          canvas_data: JSON.parse(JSON.stringify(input.canvasData)),
          variables: JSON.parse(JSON.stringify(input.variables || [])),
          context: {},
          started_at: new Date(),
        },
      });

      // Create node executions
      if (nodeExecutions.length > 0) {
        await tx.node_executions.createMany({
          data: nodeExecutions.map((ne) => ({
            execution_id: execution.id,
            node_id: ne.node_id,
            node_type: ne.node_type,
            node_data: JSON.parse(JSON.stringify(ne.node_data)),
            status: ne.status,
            progress: ne.progress,
          })),
        });
      }

      return execution.id;
    });

    return result;
  }

  /**
   * Update execution status
   *
   * @param executionId - Execution ID
   * @param status - New status
   * @param error - Optional error details
   */
  async updateStatus(
    executionId: string,
    status: WorkflowExecutionStatus,
    error?: { message: string; stack?: string }
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date(),
    };

    if (status === 'finish' || status === 'failed' || status === 'aborted') {
      updateData.completed_at = new Date();
    }

    if (error) {
      updateData.error_message = error.message;
      updateData.error_stack = error.stack || null;
    }

    await prisma.workflow_executions.update({
      where: { id: executionId },
      data: updateData,
    });
  }

  /**
   * Update node execution status
   *
   * @param executionId - Execution ID
   * @param nodeId - Node ID
   * @param status - New status
   * @param data - Optional additional data
   */
  async updateNodeStatus(
    executionId: string,
    nodeId: string,
    status: ActionStatus,
    data?: {
      progress?: number;
      inputData?: unknown;
      outputData?: unknown;
      error?: { message: string; stack?: string };
    }
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date(),
    };

    if (status === 'executing') {
      updateData.started_at = new Date();
    }

    if (status === 'finish' || status === 'failed') {
      updateData.completed_at = new Date();
    }

    if (data?.progress !== undefined) {
      updateData.progress = data.progress;
    }

    if (data?.inputData !== undefined) {
      updateData.input_data = data.inputData;
    }

    if (data?.outputData !== undefined) {
      updateData.output_data = data.outputData;
    }

    if (data?.error) {
      updateData.error_message = data.error.message;
      updateData.error_stack = data.error.stack || null;
    }

    await prisma.node_executions.updateMany({
      where: {
        execution_id: executionId,
        node_id: nodeId,
      },
      data: updateData,
    });
  }

  /**
   * Get node execution
   *
   * @param executionId - Execution ID
   * @param nodeId - Node ID
   * @returns Node execution or null
   */
  async getNodeExecution(
    executionId: string,
    nodeId: string
  ): Promise<NodeExecutionEntity | null> {
    return prisma.node_executions.findFirst({
      where: {
        execution_id: executionId,
        node_id: nodeId,
      },
    });
  }

  /**
   * Get all node executions for an execution
   *
   * @param executionId - Execution ID
   * @returns Array of node executions
   */
  async getNodeExecutions(executionId: string): Promise<NodeExecutionEntity[]> {
    return prisma.node_executions.findMany({
      where: {
        execution_id: executionId,
      },
      orderBy: {
        created_at: 'asc',
      },
    });
  }

  /**
   * Find executions by workflow ID
   *
   * @param workflowId - Workflow ID
   * @param organizationId - Organization ID
   * @param options - Pagination options
   * @returns Array of executions
   */
  async findByWorkflowId(
    workflowId: string,
    organizationId: string,
    options?: { skip?: number; take?: number; userId?: string }
  ): Promise<WorkflowExecutionEntity[]> {
    const where: Record<string, unknown> = {
      workflow_id: workflowId,
      organization_id: organizationId,
    };
    if (options?.userId) where.user_id = options.userId;

    return prisma.workflow_executions.findMany({
      where,
      include: {
        node_executions: {
          select: {
            id: true,
            node_id: true,
            node_type: true,
            status: true,
            error_message: true,
          },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip: options?.skip,
      take: options?.take,
    }) as unknown as WorkflowExecutionEntity[];
  }

  /**
   * Count executions by workflow ID
   *
   * @param workflowId - Workflow ID
   * @param organizationId - Organization ID
   * @param userId - Optional user ID filter (omit for admin view)
   * @returns Count
   */
  async countByWorkflowId(
    workflowId: string,
    organizationId: string,
    userId?: string,
  ): Promise<number> {
    const where: Record<string, unknown> = {
      workflow_id: workflowId,
      organization_id: organizationId,
    };
    if (userId) where.user_id = userId;

    return prisma.workflow_executions.count({ where });
  }
}

// Singleton instance
export const workflowExecutionRepository = new WorkflowExecutionRepository();
