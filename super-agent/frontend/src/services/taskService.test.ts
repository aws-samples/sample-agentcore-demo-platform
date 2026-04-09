import { describe, it, expect, beforeEach } from 'vitest'
import { TaskService } from './taskService'
import type { TaskFilters } from '@/types'

describe('TaskService', () => {
  beforeEach(() => {
    TaskService.resetStore()
  })

  describe('getTasks', () => {
    it('should return all tasks', async () => {
      const tasks = await TaskService.getTasks()
      expect(tasks).toBeDefined()
      expect(Array.isArray(tasks)).toBe(true)
      expect(tasks.length).toBeGreaterThan(0)
    })

    it('should return tasks with required fields', async () => {
      const tasks = await TaskService.getTasks()
      tasks.forEach(task => {
        expect(task.id).toBeDefined()
        expect(task.agent).toBeDefined()
        expect(task.description).toBeDefined()
        expect(task.workflow).toBeDefined()
        expect(task.status).toBeDefined()
        expect(task.timestamp).toBeDefined()
      })
    })

    it('should return independent copies of tasks', async () => {
      const tasks1 = await TaskService.getTasks()
      const tasks2 = await TaskService.getTasks()
      expect(tasks1).toEqual(tasks2)
      expect(tasks1).not.toBe(tasks2)
    })
  })

  describe('getTasksFiltered', () => {
    it('should filter tasks by agent ID', async () => {
      const allTasks = await TaskService.getTasks()
      const firstAgentId = allTasks[0].agent.id
      
      const filters: TaskFilters = { agentId: firstAgentId }
      const filtered = await TaskService.getTasksFiltered(filters)
      
      expect(filtered.length).toBeGreaterThan(0)
      filtered.forEach(task => {
        expect(task.agent.id).toBe(firstAgentId)
      })
    })

    it('should filter tasks by status', async () => {
      const filters: TaskFilters = { status: 'complete' }
      const filtered = await TaskService.getTasksFiltered(filters)
      
      expect(filtered.length).toBeGreaterThan(0)
      filtered.forEach(task => {
        expect(task.status).toBe('complete')
      })
    })

    it('should return empty array for non-existent agent', async () => {
      const filters: TaskFilters = { agentId: 'non-existent-agent' }
      const filtered = await TaskService.getTasksFiltered(filters)
      
      expect(filtered).toEqual([])
    })

    it('should combine multiple filters', async () => {
      const allTasks = await TaskService.getTasks()
      const firstAgentId = allTasks[0].agent.id
      
      const filters: TaskFilters = {
        agentId: firstAgentId,
        status: 'complete'
      }
      const filtered = await TaskService.getTasksFiltered(filters)
      
      filtered.forEach(task => {
        expect(task.agent.id).toBe(firstAgentId)
        expect(task.status).toBe('complete')
      })
    })
  })

  describe('getTaskById', () => {
    it('should return a task by ID', async () => {
      const allTasks = await TaskService.getTasks()
      const taskId = allTasks[0].id
      
      const task = await TaskService.getTaskById(taskId)
      expect(task.id).toBe(taskId)
    })

    it('should throw error for non-existent task', async () => {
      await expect(TaskService.getTaskById('non-existent')).rejects.toThrow()
    })

    it('should return independent copy of task', async () => {
      const allTasks = await TaskService.getTasks()
      const taskId = allTasks[0].id
      
      const task1 = await TaskService.getTaskById(taskId)
      const task2 = await TaskService.getTaskById(taskId)
      
      expect(task1).toEqual(task2)
      expect(task1).not.toBe(task2)
    })
  })

  describe('exportTasksToCSV', () => {
    it('should export tasks to CSV format', async () => {
      const tasks = await TaskService.getTasks()
      const csv = await TaskService.exportTasksToCSV(tasks)
      
      expect(typeof csv).toBe('string')
      expect(csv.length).toBeGreaterThan(0)
    })

    it('should include CSV headers', async () => {
      const tasks = await TaskService.getTasks()
      const csv = await TaskService.exportTasksToCSV(tasks)
      
      expect(csv).toContain('Task ID')
      expect(csv).toContain('Agent Name')
      expect(csv).toContain('Description')
      expect(csv).toContain('Workflow')
      expect(csv).toContain('Status')
    })

    it('should include all task data in CSV', async () => {
      const tasks = await TaskService.getTasks()
      const csv = await TaskService.exportTasksToCSV(tasks)
      
      tasks.forEach(task => {
        expect(csv).toContain(task.id)
        expect(csv).toContain(task.agent.name)
        expect(csv).toContain(task.status)
      })
    })

    it('should handle empty task list', async () => {
      const csv = await TaskService.exportTasksToCSV([])
      
      expect(typeof csv).toBe('string')
      expect(csv).toContain('Task ID')
    })

    it('should properly escape CSV values', async () => {
      const tasks = await TaskService.getTasks()
      const csv = await TaskService.exportTasksToCSV(tasks)
      
      // Check that values are quoted
      const lines = csv.split('\n')
      expect(lines.length).toBeGreaterThan(1)
      lines.slice(1).forEach(line => {
        if (line.trim()) {
          expect(line).toContain('"')
        }
      })
    })
  })

  describe('resetStore', () => {
    it('should reset store to initial mock data', async () => {
      const initialTasks = await TaskService.getTasks()
      const initialCount = initialTasks.length
      
      TaskService.resetStore()
      
      const resetTasks = await TaskService.getTasks()
      expect(resetTasks.length).toBe(initialCount)
    })
  })

  describe('getMockTasks', () => {
    it('should return mock tasks', () => {
      const mockTasks = TaskService.getMockTasks()
      
      expect(Array.isArray(mockTasks)).toBe(true)
      expect(mockTasks.length).toBeGreaterThan(0)
    })

    it('should return independent copy of mock tasks', () => {
      const mock1 = TaskService.getMockTasks()
      const mock2 = TaskService.getMockTasks()
      
      expect(mock1).toEqual(mock2)
      expect(mock1).not.toBe(mock2)
    })
  })
})
