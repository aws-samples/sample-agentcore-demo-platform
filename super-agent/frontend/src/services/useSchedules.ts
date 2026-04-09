/**
 * useSchedules Hook
 * 
 * React hook for managing workflow schedules.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { RestScheduleService } from './api/restScheduleService';
import type { 
  Schedule, 
  ScheduleRecord, 
  CreateScheduleRequest, 
  UpdateScheduleRequest 
} from './api/restScheduleService';

export interface UseSchedulesState {
  schedules: Schedule[];
  isLoading: boolean;
  error: string | null;
}

export interface UseSchedulesReturn extends UseSchedulesState {
  loadSchedules: (workflowId: string) => Promise<void>;
  createSchedule: (workflowId: string, data: CreateScheduleRequest) => Promise<Schedule | null>;
  updateSchedule: (scheduleId: string, data: UpdateScheduleRequest) => Promise<Schedule | null>;
  deleteSchedule: (scheduleId: string) => Promise<boolean>;
  triggerSchedule: (scheduleId: string) => Promise<{ executionId: string; triggeredAt: string } | null>;
  getExecutionRecords: (scheduleId: string, page?: number, limit?: number) => Promise<{
    records: ScheduleRecord[];
    total: number;
    totalPages: number;
  } | null>;
  clearError: () => void;
}

export function useSchedules(initialWorkflowId?: string): UseSchedulesReturn {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load schedules on mount if workflowId provided
  useEffect(() => {
    if (initialWorkflowId) {
      void loadSchedules(initialWorkflowId);
    }
  }, [initialWorkflowId]);

  const loadSchedules = useCallback(async (workflowId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await RestScheduleService.listSchedules(workflowId);
      if (isMountedRef.current) {
        setSchedules(data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load schedules');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const createSchedule = useCallback(async (
    workflowId: string,
    data: CreateScheduleRequest
  ): Promise<Schedule | null> => {
    try {
      const schedule = await RestScheduleService.createSchedule(workflowId, data);
      if (isMountedRef.current) {
        setSchedules(prev => [...prev, schedule]);
      }
      return schedule;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to create schedule');
      }
      return null;
    }
  }, []);

  const updateSchedule = useCallback(async (
    scheduleId: string,
    data: UpdateScheduleRequest
  ): Promise<Schedule | null> => {
    try {
      const schedule = await RestScheduleService.updateSchedule(scheduleId, data);
      if (isMountedRef.current) {
        setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, ...schedule } : s));
      }
      return schedule;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to update schedule');
      }
      return null;
    }
  }, []);

  const deleteSchedule = useCallback(async (scheduleId: string): Promise<boolean> => {
    try {
      await RestScheduleService.deleteSchedule(scheduleId);
      if (isMountedRef.current) {
        setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      }
      return true;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to delete schedule');
      }
      return false;
    }
  }, []);

  const triggerSchedule = useCallback(async (scheduleId: string) => {
    try {
      return await RestScheduleService.triggerSchedule(scheduleId);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to trigger schedule');
      }
      return null;
    }
  }, []);

  const getExecutionRecords = useCallback(async (
    scheduleId: string,
    page = 1,
    limit = 20
  ) => {
    try {
      const response = await RestScheduleService.getExecutionRecords(scheduleId, page, limit);
      return {
        records: response.data,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
      };
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load execution records');
      }
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    schedules,
    isLoading,
    error,
    loadSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    triggerSchedule,
    getExecutionRecords,
    clearError,
  };
}

export type { Schedule, ScheduleRecord, CreateScheduleRequest, UpdateScheduleRequest };
