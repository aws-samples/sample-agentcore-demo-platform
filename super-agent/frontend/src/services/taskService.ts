/**
 * Task Service
 * 
 * This module provides the unified task service that automatically switches
 * between mock and REST API implementations based on environment configuration.
 */

import type { Task, TaskFilters, TaskStatus } from '@/types'
import { getServiceConfig } from './api/createService'
import { RestTaskService } from './api/restTaskService'
import { shouldUseRestApi } from './api/index'

export type TaskServiceErrorCode = 'NOT_FOUND' | 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN'

export class TaskServiceError extends Error {
  code: TaskServiceErrorCode
  constructor(message: string, code: TaskServiceErrorCode) {
    super(message)
    this.name = 'TaskServiceError'
    this.code = code
  }
}

const SIMULATED_DELAY = 300

const mockTasks: Task[] = [
  {
    id: 'task-1',
    agent: { id: 'agent-1', name: 'HR Assistant', role: 'Recruitment Specialist', avatar: 'H' },
    description: 'Resume screening for senior developer position',
    workflow: 'Recruitment Process',
    status: 'complete',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'task-2',
    agent: { id: 'agent-3', name: 'IT Support Agent', role: 'Technical Support', avatar: 'I' },
    description: 'Password reset for user john.doe@company.com',
    workflow: 'IT Support',
    status: 'complete',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
  },
  {
    id: 'task-3',
    agent: { id: 'agent-5', name: 'Marketing Assistant', role: 'Content Creator', avatar: 'M' },
    description: 'Generate social media content for Q1 campaign',
    workflow: 'Marketing Campaign',
    status: 'running',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: 'task-4',
    agent: { id: 'agent-4', name: 'DevOps Bot', role: 'Deployment Automation', avatar: 'D' },
    description: 'Deploy application to production',
    workflow: 'CI/CD Pipeline',
    status: 'failed',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
]

let taskStore: Task[] = [...mockTasks]

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const MockTaskService = {
  async getTasks(): Promise<Task[]> {
    await delay(SIMULATED_DELAY)
    return [...taskStore]
  },

  async getTasksFiltered(filters: TaskFilters): Promise<Task[]> {
    await delay(SIMULATED_DELAY)
    let filtered = [...taskStore]
    if (filters.agentId) filtered = filtered.filter(t => t.agent.id === filters.agentId)
    if (filters.status) filtered = filtered.filter(t => t.status === filters.status)
    if (filters.dateRange) {
      filtered = filtered.filter(t => t.timestamp >= filters.dateRange!.start && t.timestamp <= filters.dateRange!.end)
    }
    return filtered
  },

  async getTaskById(id: string): Promise<Task> {
    await delay(SIMULATED_DELAY)
    const task = taskStore.find(t => t.id === id)
    if (!task) throw new TaskServiceError(`Task with id "${id}" not found`, 'NOT_FOUND')
    return { ...task }
  },

  async createTask(data: { description: string; agentId?: string; workflowId?: string; status?: TaskStatus }): Promise<Task> {
    await delay(SIMULATED_DELAY)
    if (!data.description?.trim()) throw new TaskServiceError('Task description is required', 'VALIDATION_ERROR')
    const newTask: Task = {
      id: `task-${Date.now()}`,
      agent: { id: data.agentId || 'unknown', name: 'Unknown Agent', role: '', avatar: 'U' },
      description: data.description,
      workflow: 'Unknown Workflow',
      status: data.status || 'running',
      timestamp: new Date(),
    }
    taskStore.push(newTask)
    return { ...newTask }
  },

  async updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
    await delay(SIMULATED_DELAY)
    const index = taskStore.findIndex(t => t.id === id)
    if (index === -1) throw new TaskServiceError(`Task with id "${id}" not found`, 'NOT_FOUND')
    taskStore[index] = { ...taskStore[index], status }
    return { ...taskStore[index] }
  },

  async exportTasksToCSV(tasks: Task[]): Promise<string> {
    await delay(SIMULATED_DELAY)
    const headers = ['Task ID', 'Agent Name', 'Agent Role', 'Description', 'Workflow', 'Status', 'Timestamp']
    const rows = tasks.map(task => [task.id, task.agent.name, task.agent.role, task.description, task.workflow, task.status, task.timestamp.toISOString()])
    return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
  },

  resetStore(): void { taskStore = [...mockTasks] },
  getMockTasks(): Task[] { return [...mockTasks] },
}

export interface ITaskService {
  getTasks(): Promise<Task[]>
  getTasksFiltered(filters: TaskFilters): Promise<Task[]>
  getTaskById(id: string): Promise<Task>
  createTask?(data: { description: string; agentId?: string; workflowId?: string; status?: TaskStatus }): Promise<Task>
  updateTaskStatus?(id: string, status: TaskStatus): Promise<Task>
  exportTasksToCSV(tasks: Task[]): Promise<string>
  resetStore?(): void
  getMockTasks?(): Task[]
}

function selectTaskService(): ITaskService {
  if (shouldUseRestApi()) {
    return RestTaskService;
  }
  const config = getServiceConfig();
  return config.useMock ? MockTaskService : RestTaskService;
}

export const TaskService = selectTaskService()
export default TaskService
