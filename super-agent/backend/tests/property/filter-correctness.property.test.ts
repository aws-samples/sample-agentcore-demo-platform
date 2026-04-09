/**
 * Property-based tests for Filter Correctness
 *
 * Feature: unified-ecs-backend
 * Property 9: Filter Correctness
 * Validates: Requirements 4.7, 4.8
 *
 * For any filter parameters applied to a list query (e.g., agents by status,
 * agents by business_scope_id), all returned items should match all specified filter criteria.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AgentService } from '../../src/services/agent.service.js';
import { agentRepository, type AgentEntity } from '../../src/repositories/agent.repository.js';
import type { AgentFilter } from '../../src/schemas/agent.schema.js';

// Mock the repository to test the service layer filter logic
vi.mock('../../src/repositories/agent.repository.js', () => {
  // In-memory store for testing
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
      findAllWithFilters: vi.fn(
        async (
          organizationId: string,
          filters?: AgentFilter,
          options?: { skip?: number; take?: number }
        ) => {
          const results: AgentEntity[] = [];
          for (const agent of agents.values()) {
            if (agent.organization_id !== organizationId) continue;

            // Apply status filter
            if (filters?.status && agent.status !== filters.status) continue;

            // Apply business_scope_id filter
            if (filters?.business_scope_id && agent.business_scope_id !== filters.business_scope_id)
              continue;

            results.push(agent);
          }

          // Apply pagination
          const skip = options?.skip ?? 0;
          const take = options?.take ?? results.length;
          return results.slice(skip, skip + take);
        }
      ),
      findByBusinessScope: vi.fn(async (organizationId: string, businessScopeId: string) => {
        const results: AgentEntity[] = [];
        for (const agent of agents.values()) {
          if (
            agent.organization_id === organizationId &&
            agent.business_scope_id === businessScopeId
          ) {
            results.push(agent);
          }
        }
        return results;
      }),
      findByStatus: vi.fn(
        async (organizationId: string, status: AgentEntity['status']) => {
          const results: AgentEntity[] = [];
          for (const agent of agents.values()) {
            if (agent.organization_id === organizationId && agent.status === status) {
              results.push(agent);
            }
          }
          return results;
        }
      ),
      count: vi.fn(async (organizationId: string, where?: Partial<AgentEntity>) => {
        let count = 0;
        for (const agent of agents.values()) {
          if (agent.organization_id !== organizationId) continue;
          if (where?.status && agent.status !== where.status) continue;
          if (where?.business_scope_id && agent.business_scope_id !== where.business_scope_id)
            continue;
          count++;
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
      // Helper to clear the store between tests
      _clear: () => agents.clear(),
      _getStore: () => agents,
    },
  };
});

describe('Filter Correctness Properties', () => {
  const agentService = new AgentService();

  // Clear the mock store before each test
  beforeEach(() => {
    vi.clearAllMocks();
    (agentRepository as unknown as { _clear: () => void })._clear();
  });

  /**
   * Generator for valid agent status
   */
  const validStatusArbitrary = fc.constantFrom<AgentEntity['status']>(
    'active',
    'idle',
    'busy',
    'offline'
  );

  /**
   * Generator for valid agent names (unique)
   */
  const validAgentNameArbitrary = fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim());

  /**
   * Generator for valid display names
   */
  const validDisplayNameArbitrary = fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim());

  /**
   * Generator for agent data with specific status and business_scope_id
   */
  const agentDataArbitrary = (
    status: AgentEntity['status'],
    businessScopeId: string | null
  ): fc.Arbitrary<{
    name: string;
    display_name: string;
    status: AgentEntity['status'];
    business_scope_id: string | null;
  }> =>
    fc.record({
      name: validAgentNameArbitrary,
      display_name: validDisplayNameArbitrary,
      status: fc.constant(status),
      business_scope_id: fc.constant(businessScopeId),
    });

  /**
   * Feature: unified-ecs-backend, Property 9: Filter Correctness
   * Validates: Requirements 4.7
   *
   * For any status filter applied to getAgents, all returned agents
   * should have the specified status.
   */
  it('should return only agents matching the status filter', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        validStatusArbitrary, // filter status
        fc.array(validStatusArbitrary, { minLength: 3, maxLength: 10 }), // statuses for agents to create
        async (organizationId, filterStatus, agentStatuses) => {
          // Clear store for this test run
          (agentRepository as unknown as { _clear: () => void })._clear();

          // Create agents with various statuses
          const createdAgents: AgentEntity[] = [];
          for (let i = 0; i < agentStatuses.length; i++) {
            const agent = await agentRepository.create(
              {
                name: `agent-${i}-${Date.now()}-${Math.random()}`,
                display_name: `Agent ${i}`,
                status: agentStatuses[i],
                business_scope_id: null,
              },
              organizationId
            );
            createdAgents.push(agent);
          }

          // Query with status filter
          const result = await agentService.getAgents(organizationId, { status: filterStatus });

          // Verify all returned agents match the filter
          for (const agent of result.data) {
            expect(agent.status).toBe(filterStatus);
          }

          // Verify the count matches expected
          const expectedCount = createdAgents.filter((a) => a.status === filterStatus).length;
          expect(result.data.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 9: Filter Correctness
   * Validates: Requirements 4.8
   *
   * For any business_scope_id filter applied to getAgents, all returned agents
   * should have the specified business_scope_id.
   */
  it('should return only agents matching the business_scope_id filter', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // filterBusinessScopeId
        fc.array(fc.option(fc.uuid(), { nil: null }), { minLength: 3, maxLength: 10 }), // business_scope_ids for agents
        async (organizationId, filterBusinessScopeId, businessScopeIds) => {
          // Clear store for this test run
          (agentRepository as unknown as { _clear: () => void })._clear();

          // Create agents with various business_scope_ids
          const createdAgents: AgentEntity[] = [];
          for (let i = 0; i < businessScopeIds.length; i++) {
            const agent = await agentRepository.create(
              {
                name: `agent-${i}-${Date.now()}-${Math.random()}`,
                display_name: `Agent ${i}`,
                status: 'idle',
                business_scope_id: businessScopeIds[i],
              },
              organizationId
            );
            createdAgents.push(agent);
          }

          // Query with business_scope_id filter
          const result = await agentService.getAgents(organizationId, {
            business_scope_id: filterBusinessScopeId,
          });

          // Verify all returned agents match the filter
          for (const agent of result.data) {
            expect(agent.business_scope_id).toBe(filterBusinessScopeId);
          }

          // Verify the count matches expected
          const expectedCount = createdAgents.filter(
            (a) => a.business_scope_id === filterBusinessScopeId
          ).length;
          expect(result.data.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 9: Filter Correctness
   * Validates: Requirements 4.7, 4.8
   *
   * For any combination of status AND business_scope_id filters,
   * all returned agents should match ALL specified filter criteria.
   */
  it('should return only agents matching combined status and business_scope_id filters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        validStatusArbitrary, // filterStatus
        fc.uuid(), // filterBusinessScopeId
        fc.array(
          fc.record({
            status: validStatusArbitrary,
            businessScopeId: fc.option(fc.uuid(), { nil: null }),
          }),
          { minLength: 5, maxLength: 15 }
        ), // agent configs
        async (organizationId, filterStatus, filterBusinessScopeId, agentConfigs) => {
          // Clear store for this test run
          (agentRepository as unknown as { _clear: () => void })._clear();

          // Create agents with various status and business_scope_id combinations
          const createdAgents: AgentEntity[] = [];
          for (let i = 0; i < agentConfigs.length; i++) {
            const config = agentConfigs[i];
            const agent = await agentRepository.create(
              {
                name: `agent-${i}-${Date.now()}-${Math.random()}`,
                display_name: `Agent ${i}`,
                status: config.status,
                business_scope_id: config.businessScopeId,
              },
              organizationId
            );
            createdAgents.push(agent);
          }

          // Query with combined filters
          const result = await agentService.getAgents(organizationId, {
            status: filterStatus,
            business_scope_id: filterBusinessScopeId,
          });

          // Verify all returned agents match BOTH filters
          for (const agent of result.data) {
            expect(agent.status).toBe(filterStatus);
            expect(agent.business_scope_id).toBe(filterBusinessScopeId);
          }

          // Verify the count matches expected
          const expectedCount = createdAgents.filter(
            (a) => a.status === filterStatus && a.business_scope_id === filterBusinessScopeId
          ).length;
          expect(result.data.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 9: Filter Correctness
   * Validates: Requirements 4.7
   *
   * Using getAgentsByStatus should return only agents with the specified status.
   */
  it('should return only agents with specified status via getAgentsByStatus', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        validStatusArbitrary, // filterStatus
        fc.array(validStatusArbitrary, { minLength: 3, maxLength: 10 }), // statuses for agents
        async (organizationId, filterStatus, agentStatuses) => {
          // Clear store for this test run
          (agentRepository as unknown as { _clear: () => void })._clear();

          // Create agents with various statuses
          const createdAgents: AgentEntity[] = [];
          for (let i = 0; i < agentStatuses.length; i++) {
            const agent = await agentRepository.create(
              {
                name: `agent-${i}-${Date.now()}-${Math.random()}`,
                display_name: `Agent ${i}`,
                status: agentStatuses[i],
                business_scope_id: null,
              },
              organizationId
            );
            createdAgents.push(agent);
          }

          // Query using getAgentsByStatus
          const result = await agentService.getAgentsByStatus(organizationId, filterStatus);

          // Verify all returned agents match the filter
          for (const agent of result) {
            expect(agent.status).toBe(filterStatus);
          }

          // Verify the count matches expected
          const expectedCount = createdAgents.filter((a) => a.status === filterStatus).length;
          expect(result.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 9: Filter Correctness
   * Validates: Requirements 4.8
   *
   * Using getAgentsByBusinessScope should return only agents with the specified business_scope_id.
   */
  it('should return only agents with specified business_scope_id via getAgentsByBusinessScope', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // organizationId
        fc.uuid(), // filterBusinessScopeId
        fc.array(fc.option(fc.uuid(), { nil: null }), { minLength: 3, maxLength: 10 }), // business_scope_ids
        async (organizationId, filterBusinessScopeId, businessScopeIds) => {
          // Clear store for this test run
          (agentRepository as unknown as { _clear: () => void })._clear();

          // Create agents with various business_scope_ids
          const createdAgents: AgentEntity[] = [];
          for (let i = 0; i < businessScopeIds.length; i++) {
            const agent = await agentRepository.create(
              {
                name: `agent-${i}-${Date.now()}-${Math.random()}`,
                display_name: `Agent ${i}`,
                status: 'idle',
                business_scope_id: businessScopeIds[i],
              },
              organizationId
            );
            createdAgents.push(agent);
          }

          // Query using getAgentsByBusinessScope
          const result = await agentService.getAgentsByBusinessScope(
            organizationId,
            filterBusinessScopeId
          );

          // Verify all returned agents match the filter
          for (const agent of result) {
            expect(agent.business_scope_id).toBe(filterBusinessScopeId);
          }

          // Verify the count matches expected
          const expectedCount = createdAgents.filter(
            (a) => a.business_scope_id === filterBusinessScopeId
          ).length;
          expect(result.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
