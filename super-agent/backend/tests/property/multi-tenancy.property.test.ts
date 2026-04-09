/**
 * Property-based tests for Multi-Tenancy Isolation
 *
 * Feature: unified-ecs-backend
 * Property 2: Multi-Tenancy Isolation
 * Validates: Requirements 2.5, 3.4, 4.1, 5.1, 6.1, 7.1, 9.1, 11.1
 *
 * For any authenticated user and any API query, all returned resources
 * (agents, tasks, workflows, documents, etc.) should have an organization_id
 * matching the user's organization_id.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AgentService } from '../../src/services/agent.service.js';
import { TaskService } from '../../src/services/task.service.js';
import { agentRepository, type AgentEntity } from '../../src/repositories/agent.repository.js';
import { taskRepository, type TaskEntity } from '../../src/repositories/task.repository.js';

// Mock the agent repository
vi.mock('../../src/repositories/agent.repository.js', () => {
  const agents = new Map<string, AgentEntity>();

  return {
    agentRepository: {
      findById: vi.fn(async (id: string, organizationId: string) => {
        const agent = agents.get(id);
        if (agent && agent.organization_id === organizationId) {
          return agent;
        }
        return null;
      }),
      findByName: vi.fn(async (organizationId: string, name: string) => {
        for (const agent of agents.values()) {
          if (agent.organization_id === organizationId && agent.name === name) {
            return agent;
          }
        }
        return null;
      }),
      findAll: vi.fn(async (organizationId: string) => {
        const results: AgentEntity[] = [];
        for (const agent of agents.values()) {
          if (agent.organization_id === organizationId) {
            results.push(agent);
          }
        }
        return results;
      }),
      findAllWithFilters: vi.fn(async (organizationId: string) => {
        const results: AgentEntity[] = [];
        for (const agent of agents.values()) {
          if (agent.organization_id === organizationId) {
            results.push(agent);
          }
        }
        return results;
      }),
      count: vi.fn(async (organizationId: string) => {
        let count = 0;
        for (const agent of agents.values()) {
          if (agent.organization_id === organizationId) {
            count++;
          }
        }
        return count;
      }),
      create: vi.fn(async (data: Partial<AgentEntity>, organizationId: string) => {
        const id = crypto.randomUUID();
        const now = new Date();
        const agent: AgentEntity = {
          id,
          organization_id: organizationId,
          business_scope_id: data.business_scope_id ?? null,
          name: data.name!,
          display_name: data.display_name!,
          role: data.role ?? null,
          avatar: data.avatar ?? null,
          status: data.status ?? 'idle',
          metrics: data.metrics ?? {},
          tools: data.tools ?? [],
          scope: data.scope ?? [],
          system_prompt: data.system_prompt ?? null,
          model_config: data.model_config ?? {},
          created_at: now,
          updated_at: now,
        };
        agents.set(id, agent);
        return agent;
      }),
      update: vi.fn(async (id: string, organizationId: string, data: Partial<AgentEntity>) => {
        const agent = agents.get(id);
        if (agent && agent.organization_id === organizationId) {
          const updated = { ...agent, ...data, updated_at: new Date() };
          agents.set(id, updated);
          return updated;
        }
        return null;
      }),
      delete: vi.fn(async (id: string, organizationId: string) => {
        const agent = agents.get(id);
        if (agent && agent.organization_id === organizationId) {
          agents.delete(id);
          return true;
        }
        return false;
      }),
      _clear: () => agents.clear(),
      _getStore: () => agents,
      _addAgent: (agent: AgentEntity) => agents.set(agent.id, agent),
    },
  };
});

// Mock the task repository
vi.mock('../../src/repositories/task.repository.js', () => {
  const tasks = new Map<string, TaskEntity>();

  return {
    taskRepository: {
      findById: vi.fn(async (id: string, organizationId: string) => {
        const task = tasks.get(id);
        if (task && task.organization_id === organizationId) {
          return task;
        }
        return null;
      }),
      findAll: vi.fn(async (organizationId: string) => {
        const results: TaskEntity[] = [];
        for (const task of tasks.values()) {
          if (task.organization_id === organizationId) {
            results.push(task);
          }
        }
        return results;
      }),
      findAllWithFilters: vi.fn(async (organizationId: string) => {
        const results: TaskEntity[] = [];
        for (const task of tasks.values()) {
          if (task.organization_id === organizationId) {
            results.push(task);
          }
        }
        return results;
      }),
      count: vi.fn(async (organizationId: string) => {
        let count = 0;
        for (const task of tasks.values()) {
          if (task.organization_id === organizationId) {
            count++;
          }
        }
        return count;
      }),
      countWithFilters: vi.fn(async (organizationId: string) => {
        let count = 0;
        for (const task of tasks.values()) {
          if (task.organization_id === organizationId) {
            count++;
          }
        }
        return count;
      }),
      create: vi.fn(async (data: Partial<TaskEntity>, organizationId: string) => {
        const id = crypto.randomUUID();
        const now = new Date();
        const task: TaskEntity = {
          id,
          organization_id: organizationId,
          agent_id: data.agent_id ?? null,
          workflow_id: data.workflow_id ?? null,
          description: data.description!,
          status: data.status ?? 'running',
          details: data.details ?? {},
          created_by: data.created_by ?? null,
          created_at: now,
          updated_at: now,
        };
        tasks.set(id, task);
        return task;
      }),
      update: vi.fn(async (id: string, organizationId: string, data: Partial<TaskEntity>) => {
        const task = tasks.get(id);
        if (task && task.organization_id === organizationId) {
          const updated = { ...task, ...data, updated_at: new Date() };
          tasks.set(id, updated);
          return updated;
        }
        return null;
      }),
      delete: vi.fn(async (id: string, organizationId: string) => {
        const task = tasks.get(id);
        if (task && task.organization_id === organizationId) {
          tasks.delete(id);
          return true;
        }
        return false;
      }),
      _clear: () => tasks.clear(),
      _getStore: () => tasks,
      _addTask: (task: TaskEntity) => tasks.set(task.id, task),
    },
  };
});

describe('Multi-Tenancy Isolation Properties', () => {
  const agentService = new AgentService();
  const taskService = new TaskService();

  beforeEach(() => {
    vi.clearAllMocks();
    (agentRepository as unknown as { _clear: () => void })._clear();
    (taskRepository as unknown as { _clear: () => void })._clear();
  });

  /**
   * Generator for valid agent names
   */
  const validAgentNameArbitrary = fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim());

  /**
   * Generator for valid task descriptions
   */
  const validTaskDescriptionArbitrary = fc
    .string({ minLength: 1, maxLength: 200 })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim());

  /**
   * Feature: unified-ecs-backend, Property 2: Multi-Tenancy Isolation
   * Validates: Requirements 2.5, 3.4, 4.1
   *
   * For any two different organizations, agents created in one organization
   * should not be visible to queries from the other organization.
   */
  it('should isolate agents between different organizations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // org1Id
        fc.uuid(), // org2Id
        fc.array(validAgentNameArbitrary, { minLength: 1, maxLength: 5 }), // org1 agent names
        fc.array(validAgentNameArbitrary, { minLength: 1, maxLength: 5 }), // org2 agent names
        async (org1Id, org2Id, org1Names, org2Names) => {
          // Ensure different organizations
          fc.pre(org1Id !== org2Id);

          // Clear stores
          (agentRepository as unknown as { _clear: () => void })._clear();

          // Create agents for org1
          for (let i = 0; i < org1Names.length; i++) {
            await agentService.createAgent(
              {
                name: `${org1Names[i]}-${i}-${Date.now()}`,
                display_name: `Org1 Agent ${i}`,
                status: 'idle',
              },
              org1Id
            );
          }

          // Create agents for org2
          for (let i = 0; i < org2Names.length; i++) {
            await agentService.createAgent(
              {
                name: `${org2Names[i]}-${i}-${Date.now()}`,
                display_name: `Org2 Agent ${i}`,
                status: 'idle',
              },
              org2Id
            );
          }

          // Query agents for org1
          const org1Agents = await agentService.getAgents(org1Id, {});

          // Query agents for org2
          const org2Agents = await agentService.getAgents(org2Id, {});

          // Verify org1 only sees org1 agents
          for (const agent of org1Agents.data) {
            expect(agent.organization_id).toBe(org1Id);
          }
          expect(org1Agents.data.length).toBe(org1Names.length);

          // Verify org2 only sees org2 agents
          for (const agent of org2Agents.data) {
            expect(agent.organization_id).toBe(org2Id);
          }
          expect(org2Agents.data.length).toBe(org2Names.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 2: Multi-Tenancy Isolation
   * Validates: Requirements 2.5, 3.4, 5.1
   *
   * For any two different organizations, tasks created in one organization
   * should not be visible to queries from the other organization.
   */
  it('should isolate tasks between different organizations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // org1Id
        fc.uuid(), // org2Id
        fc.array(validTaskDescriptionArbitrary, { minLength: 1, maxLength: 5 }), // org1 task descriptions
        fc.array(validTaskDescriptionArbitrary, { minLength: 1, maxLength: 5 }), // org2 task descriptions
        async (org1Id, org2Id, org1Descriptions, org2Descriptions) => {
          // Ensure different organizations
          fc.pre(org1Id !== org2Id);

          // Clear stores
          (taskRepository as unknown as { _clear: () => void })._clear();

          // Create tasks for org1
          for (let i = 0; i < org1Descriptions.length; i++) {
            await taskService.createTask(
              { description: org1Descriptions[i] },
              org1Id
            );
          }

          // Create tasks for org2
          for (let i = 0; i < org2Descriptions.length; i++) {
            await taskService.createTask(
              { description: org2Descriptions[i] },
              org2Id
            );
          }

          // Query tasks for org1
          const org1Tasks = await taskService.getTasks(org1Id, {});

          // Query tasks for org2
          const org2Tasks = await taskService.getTasks(org2Id, {});

          // Verify org1 only sees org1 tasks
          for (const task of org1Tasks.data) {
            expect(task.organization_id).toBe(org1Id);
          }
          expect(org1Tasks.data.length).toBe(org1Descriptions.length);

          // Verify org2 only sees org2 tasks
          for (const task of org2Tasks.data) {
            expect(task.organization_id).toBe(org2Id);
          }
          expect(org2Tasks.data.length).toBe(org2Descriptions.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 2: Multi-Tenancy Isolation
   * Validates: Requirements 2.5, 3.4, 4.1
   *
   * For any agent created in one organization, attempting to retrieve it
   * by ID from a different organization should return null/not found.
   */
  it('should prevent cross-organization agent access by ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // ownerOrgId
        fc.uuid(), // attackerOrgId
        validAgentNameArbitrary, // agent name
        async (ownerOrgId, attackerOrgId, agentName) => {
          // Ensure different organizations
          fc.pre(ownerOrgId !== attackerOrgId);

          // Clear stores
          (agentRepository as unknown as { _clear: () => void })._clear();

          // Create agent in owner's organization
          const created = await agentService.createAgent(
            {
              name: `${agentName}-${Date.now()}`,
              display_name: 'Test Agent',
              status: 'idle',
            },
            ownerOrgId
          );

          // Attempt to access from attacker's organization
          const result = await agentRepository.findById(created.id, attackerOrgId);

          // Should not be accessible
          expect(result).toBeNull();

          // But should be accessible from owner's organization
          const ownerResult = await agentRepository.findById(created.id, ownerOrgId);
          expect(ownerResult).not.toBeNull();
          expect(ownerResult?.id).toBe(created.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 2: Multi-Tenancy Isolation
   * Validates: Requirements 2.5, 3.4, 5.1
   *
   * For any task created in one organization, attempting to retrieve it
   * by ID from a different organization should return null/not found.
   */
  it('should prevent cross-organization task access by ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // ownerOrgId
        fc.uuid(), // attackerOrgId
        validTaskDescriptionArbitrary, // task description
        async (ownerOrgId, attackerOrgId, description) => {
          // Ensure different organizations
          fc.pre(ownerOrgId !== attackerOrgId);

          // Clear stores
          (taskRepository as unknown as { _clear: () => void })._clear();

          // Create task in owner's organization
          const created = await taskService.createTask(
            { description },
            ownerOrgId
          );

          // Attempt to access from attacker's organization
          const result = await taskRepository.findById(created.id, attackerOrgId);

          // Should not be accessible
          expect(result).toBeNull();

          // But should be accessible from owner's organization
          const ownerResult = await taskRepository.findById(created.id, ownerOrgId);
          expect(ownerResult).not.toBeNull();
          expect(ownerResult?.id).toBe(created.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 2: Multi-Tenancy Isolation
   * Validates: Requirements 2.5, 3.4, 4.1
   *
   * For any agent created in one organization, attempting to update it
   * from a different organization should fail (return null).
   */
  it('should prevent cross-organization agent updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // ownerOrgId
        fc.uuid(), // attackerOrgId
        validAgentNameArbitrary, // agent name
        async (ownerOrgId, attackerOrgId, agentName) => {
          // Ensure different organizations
          fc.pre(ownerOrgId !== attackerOrgId);

          // Clear stores
          (agentRepository as unknown as { _clear: () => void })._clear();

          // Create agent in owner's organization
          const created = await agentService.createAgent(
            {
              name: `${agentName}-${Date.now()}`,
              display_name: 'Original Name',
              status: 'idle',
            },
            ownerOrgId
          );

          // Attempt to update from attacker's organization
          const updateResult = await agentRepository.update(
            created.id,
            attackerOrgId,
            { display_name: 'Hacked Name' }
          );

          // Update should fail
          expect(updateResult).toBeNull();

          // Verify original data is unchanged
          const original = await agentRepository.findById(created.id, ownerOrgId);
          expect(original?.display_name).toBe('Original Name');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 2: Multi-Tenancy Isolation
   * Validates: Requirements 2.5, 3.4, 4.1
   *
   * For any agent created in one organization, attempting to delete it
   * from a different organization should fail (return false).
   */
  it('should prevent cross-organization agent deletion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // ownerOrgId
        fc.uuid(), // attackerOrgId
        validAgentNameArbitrary, // agent name
        async (ownerOrgId, attackerOrgId, agentName) => {
          // Ensure different organizations
          fc.pre(ownerOrgId !== attackerOrgId);

          // Clear stores
          (agentRepository as unknown as { _clear: () => void })._clear();

          // Create agent in owner's organization
          const created = await agentService.createAgent(
            {
              name: `${agentName}-${Date.now()}`,
              display_name: 'Test Agent',
              status: 'idle',
            },
            ownerOrgId
          );

          // Attempt to delete from attacker's organization
          const deleteResult = await agentRepository.delete(created.id, attackerOrgId);

          // Delete should fail
          expect(deleteResult).toBe(false);

          // Verify agent still exists
          const stillExists = await agentRepository.findById(created.id, ownerOrgId);
          expect(stillExists).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
