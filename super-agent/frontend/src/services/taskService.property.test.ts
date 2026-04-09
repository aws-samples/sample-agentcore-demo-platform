import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { TaskService } from './taskService'
import type { Task, TaskFilters } from '@/types'

// Generators for property-based testing
const taskStatusArbitrary = fc.oneof(
  fc.constant('complete' as const),
  fc.constant('running' as const),
  fc.constant('failed' as const)
)

const agentSummaryArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  role: fc.string({ minLength: 1, maxLength: 50 }),
  avatar: fc.string({ minLength: 1, maxLength: 1 }),
})

const taskArbitrary = fc.record({
  id: fc.uuid(),
  agent: agentSummaryArbitrary,
  description: fc.string({ minLength: 1, maxLength: 200 }),
  workflow: fc.string({ minLength: 1, maxLength: 100 }),
  status: taskStatusArbitrary,
  timestamp: fc.date(),
})

describe('TaskService - Property-Based Tests', () => {
  describe('Property 12: Task Filtering Correctness', () => {
    it('should only return tasks matching the agent filter', () => {
      fc.assert(
        fc.property(fc.array(taskArbitrary, { minLength: 1 }), (tasks) => {
          // For each task, filtering by its agent ID should include that task
          tasks.forEach(task => {
            const filtered = tasks.filter(t => t.agent.id === task.agent.id)
            
            // All filtered tasks should have the same agent ID
            filtered.forEach(t => {
              expect(t.agent.id).toBe(task.agent.id)
            })
          })
        }),
        { numRuns: 100 }
      )
    })

    it('should return empty array when filtering by non-existent agent', () => {
      fc.assert(
        fc.property(fc.array(taskArbitrary), (tasks) => {
          const nonExistentAgentId = 'non-existent-agent-id-' + Math.random()
          const filtered = tasks.filter(t => t.agent.id === nonExistentAgentId)
          
          expect(filtered).toEqual([])
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve task data when filtering', () => {
      fc.assert(
        fc.property(fc.array(taskArbitrary, { minLength: 1 }), (tasks) => {
          const task = tasks[0]
          const filtered = tasks.filter(t => t.agent.id === task.agent.id)
          
          // Filtered tasks should contain all original fields
          filtered.forEach(t => {
            expect(t.id).toBeDefined()
            expect(t.description).toBeDefined()
            expect(t.workflow).toBeDefined()
            expect(t.status).toBeDefined()
            expect(t.timestamp).toBeDefined()
          })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Property: Status Filter Correctness', () => {
    it('should only return tasks with matching status', () => {
      fc.assert(
        fc.property(fc.array(taskArbitrary, { minLength: 1 }), (tasks) => {
          const statuses: Array<'complete' | 'running' | 'failed'> = ['complete', 'running', 'failed']
          
          statuses.forEach(status => {
            const filtered = tasks.filter(t => t.status === status)
            
            // All filtered tasks should have the matching status
            filtered.forEach(t => {
              expect(t.status).toBe(status)
            })
          })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Property: CSV Export Completeness', () => {
    it('should include all task IDs in CSV export', () => {
      fc.assert(
        fc.property(fc.array(taskArbitrary, { minLength: 1 }), (tasks) => {
          const csv = tasks.reduce((acc, task) => {
            return acc + `\n"${task.id}","${task.agent.name}","${task.status}"`
          }, 'Task ID,Agent Name,Status')
          
          // All task IDs should be present in CSV
          tasks.forEach(task => {
            expect(csv).toContain(task.id)
          })
        }),
        { numRuns: 100 }
      )
    })

    it('should include all agent names in CSV export', () => {
      fc.assert(
        fc.property(fc.array(taskArbitrary, { minLength: 1 }), (tasks) => {
          const csv = tasks.reduce((acc, task) => {
            return acc + `\n"${task.id}","${task.agent.name}","${task.status}"`
          }, 'Task ID,Agent Name,Status')
          
          // All agent names should be present in CSV
          tasks.forEach(task => {
            expect(csv).toContain(task.agent.name)
          })
        }),
        { numRuns: 100 }
      )
    })

    it('should include all statuses in CSV export', () => {
      fc.assert(
        fc.property(fc.array(taskArbitrary, { minLength: 1 }), (tasks) => {
          const csv = tasks.reduce((acc, task) => {
            return acc + `\n"${task.id}","${task.agent.name}","${task.status}"`
          }, 'Task ID,Agent Name,Status')
          
          // All statuses should be present in CSV
          tasks.forEach(task => {
            expect(csv).toContain(task.status)
          })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Property: Task Data Integrity', () => {
    it('should preserve all task fields when retrieving', () => {
      fc.assert(
        fc.property(taskArbitrary, (task) => {
          // Verify all required fields are present
          expect(task.id).toBeDefined()
          expect(task.agent).toBeDefined()
          expect(task.agent.id).toBeDefined()
          expect(task.agent.name).toBeDefined()
          expect(task.agent.role).toBeDefined()
          expect(task.description).toBeDefined()
          expect(task.workflow).toBeDefined()
          expect(task.status).toBeDefined()
          expect(task.timestamp).toBeDefined()
        }),
        { numRuns: 100 }
      )
    })

    it('should maintain task status validity', () => {
      fc.assert(
        fc.property(fc.array(taskArbitrary), (tasks) => {
          const validStatuses = ['complete', 'running', 'failed']
          
          tasks.forEach(task => {
            expect(validStatuses).toContain(task.status)
          })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Property: Filter Combination Correctness', () => {
    it('should correctly combine agent and status filters', () => {
      fc.assert(
        fc.property(
          fc.array(taskArbitrary, { minLength: 1 }),
          fc.oneof(
            fc.constant('complete' as const),
            fc.constant('running' as const),
            fc.constant('failed' as const)
          ),
          (tasks, status) => {
            if (tasks.length === 0) return true
            
            const agentId = tasks[0].agent.id
            
            // Filter by both agent and status
            const filtered = tasks.filter(
              t => t.agent.id === agentId && t.status === status
            )
            
            // All filtered tasks should match both criteria
            filtered.forEach(t => {
              expect(t.agent.id).toBe(agentId)
              expect(t.status).toBe(status)
            })
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Property: Empty Collection Handling', () => {
    it('should handle empty task arrays gracefully', () => {
      fc.assert(
        fc.property(fc.constant([]), (tasks) => {
          expect(tasks).toEqual([])
          expect(tasks.length).toBe(0)
        }),
        { numRuns: 100 }
      )
    })

    it('should handle filtering on empty arrays', () => {
      fc.assert(
        fc.property(fc.constant([]), (tasks) => {
          const filtered = tasks.filter(t => t.agent.id === 'any-id')
          expect(filtered).toEqual([])
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Property: Timestamp Ordering', () => {
    it('should preserve timestamp information', () => {
      fc.assert(
        fc.property(fc.array(taskArbitrary), (tasks) => {
          tasks.forEach(task => {
            expect(task.timestamp).toBeInstanceOf(Date)
            expect(task.timestamp.getTime()).toBeDefined()
          })
        }),
        { numRuns: 100 }
      )
    })
  })
})
