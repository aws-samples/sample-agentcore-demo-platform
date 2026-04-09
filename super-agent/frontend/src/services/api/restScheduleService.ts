/**
 * REST Schedule Service
 * 
 * Client for schedule management endpoints.
 */

import { restClient } from './restClient';

// ============================================================================
// Types
// ============================================================================

export interface Schedule {
  id: string;
  workflowId: string;
  name: string;
  cronExpression: string;
  timezone: string;
  isEnabled: boolean;
  variables: unknown[];
  nextRunAt: string | null;
  lastRunAt: string | null;
  runCount: number;
  failureCount: number;
  maxRetries: number;
  createdAt: string;
}

export interface ScheduleExecutionLog {
  type: 'step_start' | 'step_complete' | 'step_failed' | 'log' | 'error' | 'done';
  content?: string;
  taskId?: string;
  taskTitle?: string;
  timestamp: string;
}

export interface ScheduleRecord {
  id: string;
  executionId: string | null;
  scheduledAt: string;
  triggeredAt: string | null;
  completedAt: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  triggerType: 'cron' | 'manual';
  errorMessage: string | null;
  retryCount: number;
  logs: ScheduleExecutionLog[];
}

export interface CreateScheduleRequest {
  name: string;
  cronExpression: string;
  timezone?: string;
  variables?: unknown[];
  isEnabled?: boolean;
  maxRetries?: number;
}

export interface UpdateScheduleRequest {
  name?: string;
  cronExpression?: string;
  timezone?: string;
  variables?: unknown[];
  isEnabled?: boolean;
  maxRetries?: number;
}

export interface ListSchedulesResponse {
  data: Schedule[];
}

export interface ScheduleRecordsResponse {
  data: ScheduleRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TriggerScheduleResponse {
  data: {
    executionId: string;
    triggeredAt: string;
  };
}

// ============================================================================
// Service
// ============================================================================

export const RestScheduleService = {
  /**
   * List schedules for a workflow
   */
  async listSchedules(workflowId: string): Promise<Schedule[]> {
    const response = await restClient.get<ListSchedulesResponse>(
      `/api/workflows/${workflowId}/schedules`
    );
    return response.data;
  },

  /**
   * Get a schedule by ID
   */
  async getSchedule(scheduleId: string): Promise<Schedule> {
    const response = await restClient.get<{ data: Schedule }>(
      `/api/schedules/${scheduleId}`
    );
    return response.data;
  },

  /**
   * Create a schedule for a workflow
   */
  async createSchedule(
    workflowId: string,
    data: CreateScheduleRequest
  ): Promise<Schedule> {
    const response = await restClient.post<{ data: Schedule }>(
      `/api/workflows/${workflowId}/schedules`,
      data
    );
    return response.data;
  },

  /**
   * Update a schedule
   */
  async updateSchedule(scheduleId: string, data: UpdateScheduleRequest): Promise<Schedule> {
    const response = await restClient.patch<{ data: Schedule }>(
      `/api/schedules/${scheduleId}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    await restClient.delete(`/api/schedules/${scheduleId}`);
  },

  /**
   * Manually trigger a schedule
   */
  async triggerSchedule(scheduleId: string): Promise<TriggerScheduleResponse['data']> {
    const response = await restClient.post<TriggerScheduleResponse>(
      `/api/schedules/${scheduleId}/trigger`
    );
    return response.data;
  },

  /**
   * Get execution records for a schedule
   */
  async getExecutionRecords(
    scheduleId: string,
    page = 1,
    limit = 20
  ): Promise<ScheduleRecordsResponse> {
    return restClient.get<ScheduleRecordsResponse>(
      `/api/schedules/${scheduleId}/records?page=${page}&limit=${limit}`
    );
  },
};

export default RestScheduleService;
