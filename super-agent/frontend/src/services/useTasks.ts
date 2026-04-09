import { useState, useCallback, useRef, useSyncExternalStore, useEffect } from 'react'
import { TaskService, TaskServiceError } from './taskService'
import type { Task, TaskFilters, AgentSummary, TaskStatus } from '@/types'

export interface UseTasksState {
  tasks: Task[]
  isLoading: boolean
  error: string | null
}

export interface UseTasksReturn extends UseTasksState {
  getTasks: () => Promise<void>
  getTasksFiltered: (filters: TaskFilters) => Promise<void>
  getTaskById: (id: string) => Promise<Task | null>
  exportToCSV: (tasksToExport: Task[]) => Promise<string | null>
  clearError: () => void
}

// Simple external store for tasks data
let tasksCache: UseTasksState = {
  tasks: [],
  isLoading: false,
  error: null,
}
const listeners: Set<() => void> = new Set()

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function getSnapshot() {
  return tasksCache
}

function setTasksState(newState: Partial<UseTasksState>) {
  tasksCache = { ...tasksCache, ...newState }
  listeners.forEach(listener => listener())
}

export function useTasks(): UseTasksReturn {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  
  // Track if component is mounted for async operations
  const isMountedRef = useRef(true)
  
  // Use local state for operations that need component-level tracking
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const getTasks = useCallback(async () => {
    setTasksState({ isLoading: true, error: null })
    try {
      const data = await TaskService.getTasks()
      setTasksState({ tasks: data, isLoading: false, error: null })
    } catch (err) {
      const message = err instanceof TaskServiceError ? err.message : 'Failed to load tasks'
      setTasksState({ isLoading: false, error: message })
    }
  }, [])

  const getTasksFiltered = useCallback(async (filters: TaskFilters) => {
    setTasksState({ isLoading: true, error: null })
    try {
      const data = await TaskService.getTasksFiltered(filters)
      setTasksState({ tasks: data, isLoading: false, error: null })
    } catch (err) {
      const message = err instanceof TaskServiceError ? err.message : 'Failed to load tasks'
      setTasksState({ isLoading: false, error: message })
    }
  }, [])

  const getTaskById = useCallback(async (id: string) => {
    try {
      return await TaskService.getTaskById(id)
    } catch (err) {
      const message = err instanceof TaskServiceError ? err.message : 'Failed to load task'
      if (isMountedRef.current) {
        setLocalError(message)
      }
      return null
    }
  }, [])

  const exportToCSV = useCallback(async (tasksToExport: Task[]) => {
    try {
      const csv = await TaskService.exportTasksToCSV(tasksToExport)
      return csv
    } catch (err) {
      const message = err instanceof TaskServiceError ? err.message : 'Failed to export tasks'
      if (isMountedRef.current) {
        setLocalError(message)
      }
      return null
    }
  }, [])

  const clearError = useCallback(() => {
    setLocalError(null)
    setTasksState({ error: null })
  }, [])

  return {
    tasks: state.tasks,
    isLoading: state.isLoading,
    error: state.error || localError,
    getTasks,
    getTasksFiltered,
    getTaskById,
    exportToCSV,
    clearError,
  }
}

// Export for testing purposes
export function resetTasksStore() {
  tasksCache = {
    tasks: [],
    isLoading: false,
    error: null,
  }
}
