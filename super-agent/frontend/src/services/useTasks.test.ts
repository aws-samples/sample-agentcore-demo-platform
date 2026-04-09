import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTasks } from './useTasks'
import { TaskService } from './taskService'

// Mock TaskService
vi.mock('./taskService', () => ({
  TaskService: {
    getTasks: vi.fn(),
    getTasksFiltered: vi.fn(),
    getTaskById: vi.fn(),
    exportTasksToCSV: vi.fn(),
  },
  TaskServiceError: Error,
}))

describe('useTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useTasks())
    
    expect(result.current.tasks).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should load tasks successfully', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        agent: { id: 'agent-1', name: 'Agent 1', role: 'Role 1', avatar: 'A' },
        description: 'Task 1',
        workflow: 'Workflow 1',
        status: 'complete' as const,
        timestamp: new Date(),
      },
    ]
    
    vi.mocked(TaskService.getTasks).mockResolvedValue(mockTasks)
    
    const { result } = renderHook(() => useTasks())
    
    await act(async () => {
      await result.current.getTasks()
    })
    
    await waitFor(() => {
      expect(result.current.tasks).toEqual(mockTasks)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  it('should handle getTasks error', async () => {
    const errorMessage = 'Failed to load tasks'
    vi.mocked(TaskService.getTasks).mockRejectedValue(new Error(errorMessage))
    
    const { result } = renderHook(() => useTasks())
    
    await act(async () => {
      await result.current.getTasks()
    })
    
    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage)
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('should load filtered tasks', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        agent: { id: 'agent-1', name: 'Agent 1', role: 'Role 1', avatar: 'A' },
        description: 'Task 1',
        workflow: 'Workflow 1',
        status: 'complete' as const,
        timestamp: new Date(),
      },
    ]
    
    vi.mocked(TaskService.getTasksFiltered).mockResolvedValue(mockTasks)
    
    const { result } = renderHook(() => useTasks())
    
    const filters = { agentId: 'agent-1' }
    
    await act(async () => {
      await result.current.getTasksFiltered(filters)
    })
    
    await waitFor(() => {
      expect(result.current.tasks).toEqual(mockTasks)
      expect(TaskService.getTasksFiltered).toHaveBeenCalledWith(filters)
    })
  })

  it('should get task by ID', async () => {
    const mockTask = {
      id: 'task-1',
      agent: { id: 'agent-1', name: 'Agent 1', role: 'Role 1', avatar: 'A' },
      description: 'Task 1',
      workflow: 'Workflow 1',
      status: 'complete' as const,
      timestamp: new Date(),
    }
    
    vi.mocked(TaskService.getTaskById).mockResolvedValue(mockTask)
    
    const { result } = renderHook(() => useTasks())
    
    let task
    await act(async () => {
      task = await result.current.getTaskById('task-1')
    })
    
    expect(task).toEqual(mockTask)
    expect(TaskService.getTaskById).toHaveBeenCalledWith('task-1')
  })

  it('should handle getTaskById error', async () => {
    const errorMessage = 'Task not found'
    vi.mocked(TaskService.getTaskById).mockRejectedValue(new Error(errorMessage))
    
    const { result } = renderHook(() => useTasks())
    
    let task
    await act(async () => {
      task = await result.current.getTaskById('non-existent')
    })
    
    expect(task).toBeNull()
    expect(result.current.error).toBe(errorMessage)
  })

  it('should export tasks to CSV', async () => {
    const mockCSV = 'Task ID,Agent Name\ntask-1,Agent 1'
    vi.mocked(TaskService.exportTasksToCSV).mockResolvedValue(mockCSV)
    
    const { result } = renderHook(() => useTasks())
    
    const mockTasks = [
      {
        id: 'task-1',
        agent: { id: 'agent-1', name: 'Agent 1', role: 'Role 1', avatar: 'A' },
        description: 'Task 1',
        workflow: 'Workflow 1',
        status: 'complete' as const,
        timestamp: new Date(),
      },
    ]
    
    let csv
    await act(async () => {
      csv = await result.current.exportToCSV(mockTasks)
    })
    
    expect(csv).toBe(mockCSV)
    expect(TaskService.exportTasksToCSV).toHaveBeenCalledWith(mockTasks)
  })

  it('should handle exportToCSV error', async () => {
    const errorMessage = 'Export failed'
    vi.mocked(TaskService.exportTasksToCSV).mockRejectedValue(new Error(errorMessage))
    
    const { result } = renderHook(() => useTasks())
    
    let csv
    await act(async () => {
      csv = await result.current.exportToCSV([])
    })
    
    expect(csv).toBeNull()
    expect(result.current.error).toBe(errorMessage)
  })

  it('should set loading state during operations', async () => {
    vi.mocked(TaskService.getTasks).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 100))
    )
    
    const { result } = renderHook(() => useTasks())
    
    act(() => {
      result.current.getTasks()
    })
    
    expect(result.current.isLoading).toBe(true)
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('should clear error on successful operation', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        agent: { id: 'agent-1', name: 'Agent 1', role: 'Role 1', avatar: 'A' },
        description: 'Task 1',
        workflow: 'Workflow 1',
        status: 'complete' as const,
        timestamp: new Date(),
      },
    ]
    
    // First call fails
    vi.mocked(TaskService.getTasks).mockRejectedValueOnce(new Error('Error'))
    
    const { result } = renderHook(() => useTasks())
    
    await act(async () => {
      await result.current.getTasks()
    })
    
    expect(result.current.error).not.toBeNull()
    
    // Second call succeeds
    vi.mocked(TaskService.getTasks).mockResolvedValueOnce(mockTasks)
    
    await act(async () => {
      await result.current.getTasks()
    })
    
    await waitFor(() => {
      expect(result.current.error).toBeNull()
      expect(result.current.tasks).toEqual(mockTasks)
    })
  })
})
