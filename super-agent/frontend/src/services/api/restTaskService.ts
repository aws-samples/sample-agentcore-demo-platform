/**
 * REST Task Service
 * 
 * Implements the task service interface using the REST API backend.
 * Replaces Supabase direct access with HTTP calls to super-agent-backend.
 */

import { restClient } from './restClient';
import type { Task, TaskFilters, TaskStatus, AgentSummary } from '@/types';
import { ServiceError } from '@/utils/errorHandling';

/**
 * API response type for tasks (snake_case from backend)
 */
interface ApiTask {
  id: string;
  organization_id: string;
  agent_id: string | null;
  workflow_id: string | null;
  description: string;
  status: string;
  details: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  agent?: {
    id: string;
    name: string;
    role: string | null;
    avatar: string | null;
  } | null;
  workflow?: {
    name: string;
  } | null;
}

/**
 * Pagination result type
 */
export interface PaginatedTasks {
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Extended filters with pagination
 */
export interface TaskFiltersWithPagination extends TaskFilters {
  page?: number;
  pageSize?: number;
}

/**
 * Maps API task response to application Task type
 */
function mapApiTaskToTask(apiTask: ApiTask): Task {
  return {
    id: apiTask.id,
    agent: extractAgentSummary(apiTask),
    description: apiTask.description,
    workflow: extractWorkflowName(apiTask),
    status: apiTask.status as TaskStatus,
    timestamp: new Date(apiTask.created_at),
  };
}

function extractAgentSummary(apiTask: ApiTask): AgentSummary {
  if (apiTask.agent) {
    return {
      id: apiTask.agent.id,
      name: apiTask.agent.name,
      role: apiTask.agent.role || '',
      avatar: apiTask.agent.avatar || apiTask.agent.name.charAt(0).toUpperCase(),
    };
  }
  
  const details = apiTask.details;
  if (details && typeof details === 'object') {
    const agent = details.agent as Record<string, unknown> | undefined;
    if (agent) {
      return {
        id: typeof agent.id === 'string' ? agent.id : apiTask.agent_id || 'unknown',
        name: typeof agent.name === 'string' ? agent.name : 'Unknown Agent',
        role: typeof agent.role === 'string' ? agent.role : '',
        avatar: typeof agent.avatar === 'string' ? agent.avatar : 'U',
      };
    }
  }
  
  return {
    id: apiTask.agent_id || 'unknown',
    name: 'Unknown Agent',
    role: '',
    avatar: 'U',
  };
}

function extractWorkflowName(apiTask: ApiTask): string {
  if (apiTask.workflow?.name) {
    return apiTask.workflow.name;
  }
  
  const details = apiTask.details;
  if (details && typeof details === 'object') {
    if (typeof details.workflow === 'string') {
      return details.workflow;
    }
    if (typeof details.workflowName === 'string') {
      return details.workflowName;
    }
  }
  
  return 'Unknown Workflow';
}

/**
 * Builds query string from filters
 */
function buildFilterQuery(filters: TaskFiltersWithPagination): string {
  const params = new URLSearchParams();
  
  if (filters.agentId) params.append('agent_id', filters.agentId);
  if (filters.status) params.append('status', filters.status);
  if (filters.page !== undefined) params.append('page', String(filters.page));
  if (filters.pageSize !== undefined) params.append('pageSize', String(filters.pageSize));
  
  if (filters.dateRange) {
    params.append('startDate', filters.dateRange.start.toISOString());
    params.append('endDate', filters.dateRange.end.toISOString());
  }
  
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * REST implementation of the Task Service
 */
export const RestTaskService = {
  /**
   * Retrieves all tasks from the API
   */
  async getTasks(): Promise<Task[]> {
    try {
      const response = await restClient.get<{
        data: ApiTask[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>('/api/tasks');
      return response.data.map(mapApiTaskToTask);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to fetch tasks', 'UNKNOWN');
    }
  },

  /**
   * Simple getTasksFiltered that returns Task[] for interface compatibility
   */
  async getTasksFiltered(filters: TaskFilters): Promise<Task[]> {
    const result = await this.getTasksFilteredPaginated(filters);
    return result.tasks;
  },

  /**
   * Retrieves tasks filtered by the provided filters with pagination support
   */
  async getTasksFilteredPaginated(filters: TaskFiltersWithPagination): Promise<PaginatedTasks> {
    try {
      const query = buildFilterQuery(filters);
      const response = await restClient.get<{
        data: ApiTask[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/tasks${query}`);
      
      const tasks = response.data.map(mapApiTaskToTask);
      const page = response.pagination.page;
      const pageSize = response.pagination.limit;
      
      return {
        tasks,
        total: response.pagination.total,
        page,
        pageSize,
        hasMore: page < response.pagination.totalPages,
      };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to fetch filtered tasks', 'UNKNOWN');
    }
  },

  /**
   * Retrieves a single task by ID
   */
  async getTaskById(id: string): Promise<Task> {
    try {
      const response = await restClient.get<ApiTask>(`/api/tasks/${id}`);
      return mapApiTaskToTask(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch task with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Creates a new task
   */
  async createTask(data: {
    description: string;
    agentId?: string;
    workflowId?: string;
    status?: TaskStatus;
    details?: Record<string, unknown>;
  }): Promise<Task> {
    try {
      if (!data.description || data.description.trim() === '') {
        throw new ServiceError('Task description is required', 'VALIDATION_ERROR');
      }

      const requestData = {
        description: data.description,
        agent_id: data.agentId || null,
        workflow_id: data.workflowId || null,
        status: data.status || 'running',
        details: data.details || {},
      };

      const response = await restClient.post<ApiTask>('/api/tasks', requestData);
      return mapApiTaskToTask(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to create task', 'UNKNOWN');
    }
  },

  /**
   * Updates a task's status
   */
  async updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
    try {
      const response = await restClient.patch<ApiTask>(`/api/tasks/${id}/status`, { status });
      return mapApiTaskToTask(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to update task status for id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Retrieves tasks filtered by agent ID
   */
  async getTasksByAgent(agentId: string): Promise<Task[]> {
    try {
      const response = await restClient.get<{
        data: ApiTask[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/tasks?agent_id=${encodeURIComponent(agentId)}`);
      return response.data.map(mapApiTaskToTask);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch tasks for agent "${agentId}"`, 'UNKNOWN');
    }
  },

  /**
   * Retrieves tasks filtered by status
   */
  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    try {
      const response = await restClient.get<{
        data: ApiTask[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/tasks?status=${encodeURIComponent(status)}`);
      return response.data.map(mapApiTaskToTask);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch tasks with status "${status}"`, 'UNKNOWN');
    }
  },

  /**
   * Exports tasks to CSV format
   */
  async exportTasksToCSV(tasks: Task[]): Promise<string> {
    const headers = ['Task ID', 'Agent Name', 'Agent Role', 'Description', 'Workflow', 'Status', 'Timestamp'];
    const rows = tasks.map(task => [
      task.id,
      task.agent.name,
      task.agent.role,
      task.description,
      task.workflow,
      task.status,
      task.timestamp.toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  },

  /**
   * Downloads CSV export from the API
   */
  async downloadTasksCSV(filters?: TaskFilters): Promise<string> {
    try {
      const query = filters ? buildFilterQuery(filters) : '';
      const response = await restClient.get<string>(`/api/tasks/export${query}`);
      return response;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to export tasks to CSV', 'UNKNOWN');
    }
  },

  /**
   * Subscribes to real-time task changes (no-op for REST)
   */
  subscribeToChanges(callback: (payload: { eventType: string; new?: Task; old?: Task }) => void) {
    console.warn('REST API does not support real-time subscriptions. Consider using polling.');
    return () => {};
  },
};

export default RestTaskService;
