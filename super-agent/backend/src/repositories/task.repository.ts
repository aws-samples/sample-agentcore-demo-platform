/**
 * Task Repository
 * Data access layer for Task entities with multi-tenancy support.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { BaseRepository, type FindAllOptions } from './base.repository.js';
import type { TaskFilter, TaskStatus } from '../schemas/task.schema.js';

/**
 * Task entity type matching the Prisma schema
 */
export interface TaskEntity {
  id: string;
  organization_id: string;
  agent_id: string | null;
  workflow_id: string | null;
  description: string;
  status: TaskStatus;
  details: Record<string, unknown>;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Task Repository class extending BaseRepository with task-specific methods.
 * Provides multi-tenancy filtering for all operations.
 */
export class TaskRepository extends BaseRepository<TaskEntity> {
  constructor() {
    super('tasks');
  }

  /**
   * Find all tasks with optional filters.
   * Supports filtering by status, agent_id, workflow_id, and created_by.
   *
   * @param organizationId - The organization ID to filter by
   * @param filters - Optional filters (status, agent_id, workflow_id, created_by)
   * @param options - Optional query options (pagination, ordering)
   * @returns Array of tasks matching the criteria
   */
  async findAllWithFilters(
    organizationId: string,
    filters?: TaskFilter,
    options?: Omit<FindAllOptions<TaskEntity>, 'where'>
  ): Promise<TaskEntity[]> {
    const where: Partial<TaskEntity> = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.agent_id) {
      where.agent_id = filters.agent_id;
    }

    if (filters?.workflow_id) {
      where.workflow_id = filters.workflow_id;
    }

    if (filters?.created_by) {
      where.created_by = filters.created_by;
    }

    return this.findAll(organizationId, {
      ...options,
      where,
    });
  }

  /**
   * Find tasks by status.
   *
   * @param organizationId - The organization ID to filter by
   * @param status - The status to filter by
   * @returns Array of tasks with the specified status
   */
  async findByStatus(organizationId: string, status: TaskStatus): Promise<TaskEntity[]> {
    return this.findAll(organizationId, {
      where: { status },
    });
  }

  /**
   * Find tasks by agent.
   *
   * @param organizationId - The organization ID to filter by
   * @param agentId - The agent ID to filter by
   * @returns Array of tasks for the specified agent
   */
  async findByAgent(organizationId: string, agentId: string): Promise<TaskEntity[]> {
    return this.findAll(organizationId, {
      where: { agent_id: agentId },
    });
  }

  /**
   * Find tasks by workflow.
   *
   * @param organizationId - The organization ID to filter by
   * @param workflowId - The workflow ID to filter by
   * @returns Array of tasks for the specified workflow
   */
  async findByWorkflow(organizationId: string, workflowId: string): Promise<TaskEntity[]> {
    return this.findAll(organizationId, {
      where: { workflow_id: workflowId },
    });
  }

  /**
   * Update task status.
   *
   * @param id - The task ID
   * @param organizationId - The organization ID to filter by
   * @param status - The new status
   * @returns The updated task, or null if not found
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: TaskStatus
  ): Promise<TaskEntity | null> {
    return this.update(id, organizationId, { status });
  }

  /**
   * Get task with related agent and workflow included.
   *
   * @param id - The task ID
   * @param organizationId - The organization ID to filter by
   * @returns The task with relations, or null if not found
   */
  async findByIdWithRelations(id: string, organizationId: string): Promise<TaskEntity | null> {
    return this.findById(id, organizationId, {
      include: { agent: true, workflow: true },
    });
  }

  /**
   * Count tasks with optional filters.
   *
   * @param organizationId - The organization ID to filter by
   * @param filters - Optional filters
   * @returns The count of matching tasks
   */
  async countWithFilters(organizationId: string, filters?: TaskFilter): Promise<number> {
    const where: Partial<TaskEntity> = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.agent_id) {
      where.agent_id = filters.agent_id;
    }

    if (filters?.workflow_id) {
      where.workflow_id = filters.workflow_id;
    }

    if (filters?.created_by) {
      where.created_by = filters.created_by;
    }

    return this.count(organizationId, where);
  }

  /**
   * Get all tasks for CSV export.
   * Returns all tasks without pagination for export purposes.
   *
   * @param organizationId - The organization ID to filter by
   * @param filters - Optional filters
   * @returns Array of all tasks matching the criteria
   */
  async findAllForExport(organizationId: string, filters?: TaskFilter): Promise<TaskEntity[]> {
    const where: Partial<TaskEntity> = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.agent_id) {
      where.agent_id = filters.agent_id;
    }

    if (filters?.workflow_id) {
      where.workflow_id = filters.workflow_id;
    }

    if (filters?.created_by) {
      where.created_by = filters.created_by;
    }

    return this.findAll(organizationId, {
      where,
      orderBy: { created_at: 'desc' },
    });
  }
}

// Export singleton instance
export const taskRepository = new TaskRepository();
