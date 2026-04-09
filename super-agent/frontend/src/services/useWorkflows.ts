import { useState, useCallback, useRef, useSyncExternalStore, useEffect } from 'react'
import type { Workflow, WorkflowCategory, WorkflowImportResult } from '@/types'
import { WorkflowService, WorkflowServiceError } from './workflowService'
import { shouldUseRestApi } from './api/index'
import { getLocalToken } from './auth'

export interface UseWorkflowsState {
  workflows: Workflow[]
  isLoading: boolean
  error: string | null
}

export interface UseWorkflowsReturn extends UseWorkflowsState {
  refetch: () => Promise<void>
  getWorkflowById: (id: string) => Promise<Workflow | null>
  createWorkflow: (data: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Workflow | null>
  updateWorkflow: (id: string, data: Partial<Omit<Workflow, 'id' | 'createdAt'>>) => Promise<Workflow | null>
  deleteWorkflow: (id: string) => Promise<boolean>
  getWorkflowsByCategory: (category: WorkflowCategory) => Promise<Workflow[]>
  getWorkflowVersions: (name: string, category: WorkflowCategory) => Promise<Workflow[]>
  importFromImage: (image: File) => Promise<WorkflowImportResult | null>
  applyNaturalLanguageChanges: (workflowId: string, instruction: string) => Promise<Workflow | null>
  clearError: () => void
}

// Simple external store for workflows data
let workflowsCache: UseWorkflowsState = {
  workflows: [],
  isLoading: true,
  error: null,
}
const listeners: Set<() => void> = new Set()
let initialFetchStarted = false

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function getSnapshot() {
  return workflowsCache
}

function setWorkflowsState(newState: Partial<UseWorkflowsState>) {
  workflowsCache = { ...workflowsCache, ...newState }
  listeners.forEach(listener => listener())
}

async function fetchWorkflowsFromService() {
  setWorkflowsState({ isLoading: true, error: null })
  try {
    console.log('🔄 Fetching workflows from service...')
    const workflows = await WorkflowService.getWorkflows()
    console.log('✅ Successfully fetched workflows:', workflows.length)
    setWorkflowsState({ workflows, isLoading: false, error: null })
  } catch (err) {
    console.error('❌ Failed to fetch workflows:', err)
    const message = err instanceof WorkflowServiceError ? err.message : 'Failed to fetch workflows'
    setWorkflowsState({ isLoading: false, error: message })
  }
}

// Start initial fetch immediately (outside of React lifecycle)
// Only if not using REST API or if auth token is already available
if (!initialFetchStarted) {
  initialFetchStarted = true
  // For REST API, only fetch if we have a token (user is logged in)
  // For mock, fetch immediately
  if (!shouldUseRestApi() || localStorage.getItem('local_auth_token') || localStorage.getItem('cognito_id_token')) {
    void fetchWorkflowsFromService()
  }
}

export function useWorkflows(): UseWorkflowsReturn {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  
  // Track if component is mounted for async operations
  const isMountedRef = useRef(true)
  
  // Use local state for operations that need component-level tracking
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    
    // For REST API, fetch data when component mounts (user should be logged in by now)
    const hasToken = getLocalToken() || localStorage.getItem('cognito_id_token');
    if (shouldUseRestApi() && hasToken && state.workflows.length === 0) {
      void fetchWorkflowsFromService()
    } else if (!hasToken || !shouldUseRestApi()) {
      // No token or not using REST — don't stay in loading state
      setWorkflowsState({ isLoading: false, error: null })
    }
    
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const refetch = useCallback(async () => {
    await fetchWorkflowsFromService()
  }, [])

  const getWorkflowById = useCallback(async (id: string): Promise<Workflow | null> => {
    try {
      return await WorkflowService.getWorkflowById(id)
    } catch (err) {
      const message = err instanceof WorkflowServiceError ? err.message : 'Failed to fetch workflow'
      if (isMountedRef.current) {
        setLocalError(message)
      }
      return null
    }
  }, [])

  const createWorkflow = useCallback(async (data: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workflow | null> => {
    try {
      const created = await WorkflowService.createWorkflow(data)
      // Update the external store with the new workflow
      setWorkflowsState({
        workflows: [...workflowsCache.workflows, created],
        error: null,
      })
      return created
    } catch (err) {
      const message = err instanceof WorkflowServiceError ? err.message : 'Failed to create workflow'
      if (isMountedRef.current) {
        setLocalError(message)
      }
      return null
    }
  }, [])

  const updateWorkflow = useCallback(async (id: string, data: Partial<Omit<Workflow, 'id' | 'createdAt'>>): Promise<Workflow | null> => {
    try {
      const updated = await WorkflowService.updateWorkflow(id, data)
      // Update the external store with the updated workflow
      setWorkflowsState({
        workflows: workflowsCache.workflows.map(w => (w.id === id ? updated : w)),
        error: null,
      })
      return updated
    } catch (err) {
      const message = err instanceof WorkflowServiceError ? err.message : 'Failed to update workflow'
      if (isMountedRef.current) {
        setLocalError(message)
      }
      return null
    }
  }, [])

  const deleteWorkflow = useCallback(async (id: string): Promise<boolean> => {
    try {
      await WorkflowService.deleteWorkflow(id)
      // Update the external store by removing the deleted workflow
      setWorkflowsState({
        workflows: workflowsCache.workflows.filter(w => w.id !== id),
        error: null,
      })
      return true
    } catch (err) {
      const message = err instanceof WorkflowServiceError ? err.message : 'Failed to delete workflow'
      if (isMountedRef.current) {
        setLocalError(message)
      }
      return false
    }
  }, [])

  const getWorkflowsByCategory = useCallback(async (category: WorkflowCategory): Promise<Workflow[]> => {
    try {
      return await WorkflowService.getWorkflowsByCategory(category)
    } catch (err) {
      const message = err instanceof WorkflowServiceError ? err.message : 'Failed to fetch workflows by category'
      if (isMountedRef.current) {
        setLocalError(message)
      }
      return []
    }
  }, [])

  const getWorkflowVersions = useCallback(async (name: string, category: WorkflowCategory): Promise<Workflow[]> => {
    try {
      if (!WorkflowService.getWorkflowVersions) {
        throw new Error('getWorkflowVersions is not supported by the current service')
      }
      return await WorkflowService.getWorkflowVersions(name, category)
    } catch (err) {
      const message = err instanceof WorkflowServiceError ? err.message : 'Failed to fetch workflow versions'
      if (isMountedRef.current) {
        setLocalError(message)
      }
      return []
    }
  }, [])

  const importFromImage = useCallback(async (image: File): Promise<WorkflowImportResult | null> => {
    try {
      if (!WorkflowService.importFromImage) {
        throw new Error('importFromImage is not supported by the current service')
      }
      return await WorkflowService.importFromImage(image)
    } catch (err) {
      const message = err instanceof WorkflowServiceError ? err.message : 'Failed to import workflow from image'
      if (isMountedRef.current) {
        setLocalError(message)
      }
      return null
    }
  }, [])

  const applyNaturalLanguageChanges = useCallback(async (workflowId: string, instruction: string): Promise<Workflow | null> => {
    try {
      if (!WorkflowService.applyNaturalLanguageChanges) {
        throw new Error('applyNaturalLanguageChanges is not supported by the current service')
      }
      const updated = await WorkflowService.applyNaturalLanguageChanges(workflowId, instruction)
      // Update the external store with the updated workflow
      setWorkflowsState({
        workflows: workflowsCache.workflows.map(w => (w.id === workflowId ? updated : w)),
        error: null,
      })
      return updated
    } catch (err) {
      const message = err instanceof WorkflowServiceError ? err.message : 'Failed to apply changes'
      if (isMountedRef.current) {
        setLocalError(message)
      }
      return null
    }
  }, [])

  const clearError = useCallback(() => {
    setLocalError(null)
    setWorkflowsState({ error: null })
  }, [])

  return {
    workflows: state.workflows,
    isLoading: state.isLoading,
    error: state.error || localError,
    refetch,
    getWorkflowById,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    getWorkflowsByCategory,
    getWorkflowVersions,
    importFromImage,
    applyNaturalLanguageChanges,
    clearError,
  }
}

// Export for testing purposes
export function resetWorkflowsStore() {
  workflowsCache = {
    workflows: [],
    isLoading: true,
    error: null,
  }
  initialFetchStarted = false
}

// Export for testing - triggers a refetch after reset
export function initializeWorkflowsStore() {
  if (!initialFetchStarted) {
    initialFetchStarted = true
    void fetchWorkflowsFromService()
  }
}
