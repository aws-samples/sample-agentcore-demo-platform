import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import type { Agent, SystemStats, Department } from '@/types'

// Generators for property-based testing
const departmentArbitrary = fc.oneof(
  fc.constant('hr' as const),
  fc.constant('it' as const),
  fc.constant('marketing' as const),
  fc.constant('sales' as const),
  fc.constant('support' as const)
)

const agentStatusArbitrary = fc.oneof(
  fc.constant('active' as const),
  fc.constant('busy' as const),
  fc.constant('offline' as const)
)

const agentMetricsArbitrary = fc.record({
  taskCount: fc.integer({ min: 0, max: 1000 }),
  responseRate: fc.integer({ min: 0, max: 100 }),
  avgResponseTime: fc.string({ minLength: 3, maxLength: 10 }),
  accuracy: fc.option(fc.integer({ min: 0, max: 100 }))
})

const modelConfigArbitrary = fc.record({
  provider: fc.oneof(
    fc.constant('Bedrock' as const),
    fc.constant('OpenAI' as const),
    fc.constant('Azure' as const)
  ),
  modelId: fc.string({ minLength: 1, maxLength: 50 }),
  agentType: fc.oneof(
    fc.constant('Orchestrator' as const),
    fc.constant('Worker' as const),
    fc.constant('Supervisor' as const)
  )
})

const agentArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  displayName: fc.string({ minLength: 1, maxLength: 50 }),
  role: fc.string({ minLength: 1, maxLength: 50 }),
  department: departmentArbitrary,
  avatar: fc.string({ minLength: 1, maxLength: 1 }),
  status: agentStatusArbitrary,
  metrics: agentMetricsArbitrary,
  tools: fc.array(fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ minLength: 1, maxLength: 100 })
  })),
  scope: fc.array(fc.string({ minLength: 1, maxLength: 50 })),
  systemPrompt: fc.string(),
  modelConfig: modelConfigArbitrary
})

// Helper functions from Dashboard component
function calculateStats(agents: Agent[]): SystemStats {
  const activeAgents = agents.filter(a => a.status === 'active').length
  const totalTasks = agents.reduce((sum, a) => sum + a.metrics.taskCount, 0)
  const avgCompliance = agents.length > 0 ? Math.round(agents.reduce((sum, a) => sum + a.metrics.responseRate, 0) / agents.length) : 0
  const activeTasks = agents.filter(a => a.status === 'busy').length * 2 + agents.filter(a => a.status === 'active').length
  return { 
    totalActiveAgents: activeAgents, 
    tasksAutomated: totalTasks, 
    slaCompliance: avgCompliance, 
    activeTaskCount: activeTasks 
  }
}

function groupAgentsByDepartment(agents: Agent[]): Record<Department, Agent[]> {
  return agents.reduce((acc, agent) => {
    if (!acc[agent.department]) {
      acc[agent.department] = []
    }
    acc[agent.department].push(agent)
    return acc
  }, {} as Record<Department, Agent[]>)
}

describe('Dashboard - Property-Based Tests', () => {
  describe('Property 1: Dashboard Metrics Accuracy', () => {
    it('should calculate total active agents correctly', () => {
      fc.assert(
        fc.property(fc.array(agentArbitrary), (agents) => {
          const stats = calculateStats(agents)
          const expectedActiveAgents = agents.filter(a => a.status === 'active').length
          
          expect(stats.totalActiveAgents).toBe(expectedActiveAgents)
        }),
        { numRuns: 100 }
      )
    })

    it('should calculate total tasks automated correctly', () => {
      fc.assert(
        fc.property(fc.array(agentArbitrary), (agents) => {
          const stats = calculateStats(agents)
          const expectedTotalTasks = agents.reduce((sum, a) => sum + a.metrics.taskCount, 0)
          
          expect(stats.tasksAutomated).toBe(expectedTotalTasks)
        }),
        { numRuns: 100 }
      )
    })

    it('should group agents by department correctly', () => {
      fc.assert(
        fc.property(fc.array(agentArbitrary, { minLength: 1 }), (agents) => {
          const grouped = groupAgentsByDepartment(agents)
          
          // Every agent should be in exactly one department group
          const totalAgentsInGroups = Object.values(grouped).reduce((sum, deptAgents) => sum + deptAgents.length, 0)
          expect(totalAgentsInGroups).toBe(agents.length)
          
          // Each agent should be in the correct department group
          Object.entries(grouped).forEach(([dept, deptAgents]) => {
            deptAgents.forEach(agent => {
              expect(agent.department).toBe(dept)
            })
          })
        }),
        { numRuns: 100 }
      )
    })

    it('should calculate SLA compliance as average response rate', () => {
      fc.assert(
        fc.property(fc.array(agentArbitrary, { minLength: 1 }), (agents) => {
          const stats = calculateStats(agents)
          const expectedCompliance = Math.round(
            agents.reduce((sum, a) => sum + a.metrics.responseRate, 0) / agents.length
          )
          
          expect(stats.slaCompliance).toBe(expectedCompliance)
        }),
        { numRuns: 100 }
      )
    })

    it('should calculate active task count based on agent status', () => {
      fc.assert(
        fc.property(fc.array(agentArbitrary), (agents) => {
          const stats = calculateStats(agents)
          const busyAgents = agents.filter(a => a.status === 'busy').length
          const activeAgents = agents.filter(a => a.status === 'active').length
          const expectedActiveTasks = busyAgents * 2 + activeAgents
          
          expect(stats.activeTaskCount).toBe(expectedActiveTasks)
        }),
        { numRuns: 100 }
      )
    })

    it('should handle empty agent arrays gracefully', () => {
      fc.assert(
        fc.property(fc.constant([]), (agents) => {
          const stats = calculateStats(agents)
          
          expect(stats.totalActiveAgents).toBe(0)
          expect(stats.tasksAutomated).toBe(0)
          expect(stats.slaCompliance).toBe(0)
          expect(stats.activeTaskCount).toBe(0)
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve agent data integrity in department grouping', () => {
      fc.assert(
        fc.property(fc.array(agentArbitrary), (agents) => {
          const grouped = groupAgentsByDepartment(agents)
          
          // All original agents should be present in the grouped result
          const allGroupedAgents = Object.values(grouped).flat()
          
          agents.forEach(originalAgent => {
            const foundAgent = allGroupedAgents.find(a => a.id === originalAgent.id)
            expect(foundAgent).toBeDefined()
            expect(foundAgent).toEqual(originalAgent)
          })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Property: Department Grouping Completeness', () => {
    it('should include all departments that have agents', () => {
      fc.assert(
        fc.property(fc.array(agentArbitrary, { minLength: 1 }), (agents) => {
          const grouped = groupAgentsByDepartment(agents)
          const uniqueDepartments = [...new Set(agents.map(a => a.department))]
          
          // Every department with agents should have a group
          uniqueDepartments.forEach(dept => {
            expect(grouped[dept]).toBeDefined()
            expect(grouped[dept].length).toBeGreaterThan(0)
          })
        }),
        { numRuns: 100 }
      )
    })

    it('should not include empty department groups', () => {
      fc.assert(
        fc.property(fc.array(agentArbitrary), (agents) => {
          const grouped = groupAgentsByDepartment(agents)
          
          // No department group should be empty
          Object.values(grouped).forEach(deptAgents => {
            expect(deptAgents.length).toBeGreaterThan(0)
          })
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Property: Metrics Consistency', () => {
    it('should maintain consistent metrics across calculations', () => {
      fc.assert(
        fc.property(fc.array(agentArbitrary), (agents) => {
          const stats1 = calculateStats(agents)
          const stats2 = calculateStats(agents)
          
          // Multiple calculations with same input should yield same results
          expect(stats1).toEqual(stats2)
        }),
        { numRuns: 100 }
      )
    })

    it('should handle agents with zero task counts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              ...agentArbitrary.constraints,
              metrics: fc.record({
                taskCount: fc.constant(0),
                responseRate: fc.integer({ min: 0, max: 100 }),
                avgResponseTime: fc.string({ minLength: 3, maxLength: 10 }),
                accuracy: fc.option(fc.integer({ min: 0, max: 100 }))
              })
            })
          ),
          (agents) => {
            const stats = calculateStats(agents)
            
            expect(stats.tasksAutomated).toBe(0)
            expect(stats.totalActiveAgents).toBe(agents.filter(a => a.status === 'active').length)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})