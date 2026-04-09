/**
 * Task Service
 * Business logic layer for Task management.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { taskRepository, type TaskEntity } from '../repositories/task.repository.js';
import { AppError } from '../middleware/errorHandler.js';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  TaskFilter,
  TaskStatus,
} from '../schemas/task.schema.js';

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * CSV export row structure
 */
export interface TaskCsvRow {
  id: string;
  description: string;
  status: string;
  agent_id: string;
  workflow_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Task Service class providing business logic for task operations.
 */
export class TaskService {
  /**
   * Get all tasks for an organization with optional filters.
   * Requirements: 5.1, 5.2
   *
   * @param organizationId - The organization ID
   * @param filters - Optional filters (status, agent_id, workflow_id, created_by)
   * @param pagination - Optional pagination options
   * @returns Paginated list of tasks
   */
  async getTasks(
    organizationId: string,
    filters?: TaskFilter,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<TaskEntity>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const tasks = await taskRepository.findAllWithFilters(organizationId, filters, {
      skip,
      take: limit,
    });

    // Get total count for pagination
    const total = await taskRepository.countWithFilters(organizationId, filters);

    return {
      data: tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single task by ID.
   * Requirements: 5.3
   *
   * @param id - The task ID
   * @param organizationId - The organization ID
   * @returns The task if found
   * @throws AppError.notFound if task doesn't exist
   */
  async getTaskById(id: string, organizationId: string): Promise<TaskEntity> {
    const task = await taskRepository.findById(id, organizationId);

    if (!task) {
      throw AppError.notFound(`Task with ID ${id} not found`);
    }

    return task;
  }

  /**
   * Create a new task.
   * Requirements: 5.4, 5.7
   *
   * @param data - The task data
   * @param organizationId - The organization ID
   * @param createdBy - The user ID creating the task
   * @returns The created task
   * @throws AppError.validation if description is empty
   */
  async createTask(
    data: CreateTaskInput,
    organizationId: string,
    createdBy?: string
  ): Promise<TaskEntity> {
    // Validate required fields
    if (!data.description || data.description.trim() === '') {
      throw AppError.validation('Task description is required');
    }

    // Create the task
    const task = await taskRepository.create(
      {
        description: data.description.trim(),
        agent_id: data.agent_id ?? null,
        workflow_id: data.workflow_id ?? null,
        status: data.status ?? 'running',
        details: data.details ?? {},
        created_by: createdBy ?? null,
      },
      organizationId
    );

    return task;
  }

  /**
   * Update an existing task.
   * Requirements: 5.4, 5.7
   *
   * @param id - The task ID
   * @param data - The update data
   * @param organizationId - The organization ID
   * @returns The updated task
   * @throws AppError.notFound if task doesn't exist
   * @throws AppError.validation if data is invalid
   */
  async updateTask(id: string, data: UpdateTaskInput, organizationId: string): Promise<TaskEntity> {
    // Verify task exists
    const existingTask = await taskRepository.findById(id, organizationId);
    if (!existingTask) {
      throw AppError.notFound(`Task with ID ${id} not found`);
    }

    // Validate description if provided
    if (data.description !== undefined) {
      if (!data.description || data.description.trim() === '') {
        throw AppError.validation('Task description cannot be empty');
      }
    }

    // Build update object with only provided fields
    const updateData: Partial<TaskEntity> = {};

    if (data.description !== undefined) updateData.description = data.description.trim();
    if (data.agent_id !== undefined) updateData.agent_id = data.agent_id;
    if (data.workflow_id !== undefined) updateData.workflow_id = data.workflow_id;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.details !== undefined) updateData.details = data.details;

    const updatedTask = await taskRepository.update(id, organizationId, updateData);

    if (!updatedTask) {
      throw AppError.notFound(`Task with ID ${id} not found`);
    }

    return updatedTask;
  }

  /**
   * Update task status only.
   * Requirements: 5.5
   *
   * @param id - The task ID
   * @param data - The status update data
   * @param organizationId - The organization ID
   * @returns The updated task
   * @throws AppError.notFound if task doesn't exist
   */
  async updateTaskStatus(
    id: string,
    data: UpdateTaskStatusInput,
    organizationId: string
  ): Promise<TaskEntity> {
    // Verify task exists
    const existingTask = await taskRepository.findById(id, organizationId);
    if (!existingTask) {
      throw AppError.notFound(`Task with ID ${id} not found`);
    }

    const updatedTask = await taskRepository.updateStatus(id, organizationId, data.status);

    if (!updatedTask) {
      throw AppError.notFound(`Task with ID ${id} not found`);
    }

    return updatedTask;
  }

  /**
   * Delete a task.
   *
   * @param id - The task ID
   * @param organizationId - The organization ID
   * @returns True if deleted successfully
   * @throws AppError.notFound if task doesn't exist
   */
  async deleteTask(id: string, organizationId: string): Promise<boolean> {
    const deleted = await taskRepository.delete(id, organizationId);

    if (!deleted) {
      throw AppError.notFound(`Task with ID ${id} not found`);
    }

    return true;
  }

  /**
   * Export tasks to CSV format.
   * Requirements: 5.6
   *
   * @param organizationId - The organization ID
   * @param filters - Optional filters
   * @returns CSV string with header and data rows
   */
  async exportTasksToCsv(organizationId: string, filters?: TaskFilter): Promise<string> {
    const tasks = await taskRepository.findAllForExport(organizationId, filters);

    // CSV header
    const headers = [
      'id',
      'description',
      'status',
      'agent_id',
      'workflow_id',
      'created_by',
      'created_at',
      'updated_at',
    ];

    // Build CSV rows
    const rows: string[] = [headers.join(',')];

    for (const task of tasks) {
      const row = [
        this.escapeCsvField(task.id),
        this.escapeCsvField(task.description),
        this.escapeCsvField(task.status),
        this.escapeCsvField(task.agent_id ?? ''),
        this.escapeCsvField(task.workflow_id ?? ''),
        this.escapeCsvField(task.created_by ?? ''),
        this.escapeCsvField(task.created_at.toISOString()),
        this.escapeCsvField(task.updated_at.toISOString()),
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Escape a field for CSV output.
   * Handles quotes, commas, and newlines.
   *
   * @param field - The field value to escape
   * @returns The escaped field value
   */
  private escapeCsvField(field: string): string {
    // Replace newlines and carriage returns with spaces to prevent line breaks in CSV
    const sanitized = field.replace(/[\r\n]+/g, ' ');
    
    // If field contains comma or quote, wrap in quotes and escape quotes
    if (sanitized.includes(',') || sanitized.includes('"')) {
      return `"${sanitized.replace(/"/g, '""')}"`;
    }
    return sanitized;
  }

  /**
   * Get tasks by status.
   * Requirements: 5.2
   *
   * @param organizationId - The organization ID
   * @param status - The task status
   * @returns List of tasks with the specified status
   */
  async getTasksByStatus(organizationId: string, status: TaskStatus): Promise<TaskEntity[]> {
    return taskRepository.findByStatus(organizationId, status);
  }

  /**
   * Get tasks by agent.
   * Requirements: 5.2
   *
   * @param organizationId - The organization ID
   * @param agentId - The agent ID
   * @returns List of tasks for the specified agent
   */
  async getTasksByAgent(organizationId: string, agentId: string): Promise<TaskEntity[]> {
    return taskRepository.findByAgent(organizationId, agentId);
  }

  /**
   * Get tasks by workflow.
   * Requirements: 5.2
   *
   * @param organizationId - The organization ID
   * @param workflowId - The workflow ID
   * @returns List of tasks for the specified workflow
   */
  async getTasksByWorkflow(organizationId: string, workflowId: string): Promise<TaskEntity[]> {
    return taskRepository.findByWorkflow(organizationId, workflowId);
  }
}

// Export singleton instance
export const taskService = new TaskService();
