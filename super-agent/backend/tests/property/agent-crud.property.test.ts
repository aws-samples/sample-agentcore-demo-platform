/**
 * Property-based tests for Agent CRUD Round-Trip Consistency
 *
 * Feature: unified-ecs-backend
 * Property 3: CRUD Round-Trip Consistency (Agents)
 * Validates: Requirements 4.3, 4.4
 *
 * For any valid agent data, creating the agent and then retrieving it by ID
 * should return data equivalent to the original input (plus generated fields like id, timestamps).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AgentService } from '../../src/services/agent.service.js';
import { agentRepository, type AgentEntity } from '../../src/repositories/agent.repository.js';
import type { CreateAgentInput, UpdateAgentInput } from '../../src/schemas/agent.schema.js';

// Mock the repository to test the service layer logic
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
      // Helper to clear the store between tests
      _clear: () => agents.clear(),
      _getStore: () => agents,
    },
  };
});

describe('Agent CRUD Round-Trip Properties', () => {
  const agentService = new AgentService();

  // Clear the mock store before each test
  beforeEach(() => {
    vi.clearAllMocks();
    (agentRepository as unknown as { _clear: () => void })._clear();
  });

  /**
   * Generator for valid agent names
   * - Non-empty, non-whitespace-only strings
   * - Max 255 characters
   */
  const validAgentNameArbitrary = fc
    .string({ minLength: 1, maxLength: 100 })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim());

  /**
   * Generator for valid display names
   */
  const validDisplayNameArbitrary = fc
    .string({ minLength: 1, maxLength: 100 })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim());

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
   * Generator for valid CreateAgentInput
   */
  const validCreateAgentInputArbitrary: fc.Arbitrary<CreateAgentInput> = fc.record({
    name: validAgentNameArbitrary,
    display_name: validDisplayNameArbitrary,
    status: validStatusArbitrary,
    role: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    system_prompt: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
    metrics: fc.constant({}),
    tools: fc.constant([]),
    scope: fc.constant([]),
    model_config: fc.constant({}),
  });

  /**
   * Feature: unified-ecs-backend, Property 3: CRUD Round-Trip Consistency (Agents)
   * Validates: Requirements 4.3, 4.4
   *
   * For any valid agent data, creating the agent and then retrieving it by ID
   * should return data equivalent to the original input (plus generated fields).
   */
  it('should preserve agent data through create/retrieve round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        validCreateAgentInputArbitrary,
        fc.uuid(), // organizationId
        async (input, organizationId) => {
          // Create the agent
          const created = await agentService.createAgent(input, organizationId);

          // Retrieve the agent by ID
          const retrieved = await agentService.getAgentById(created.id, organizationId);

          // Verify round-trip preserves all input fields
          expect(retrieved.name).toBe(input.name);
          expect(retrieved.display_name).toBe(input.display_name);
          expect(retrieved.status).toBe(input.status);
          expect(retrieved.role).toBe(input.role ?? null);
          expect(retrieved.system_prompt).toBe(input.system_prompt ?? null);
          expect(retrieved.metrics).toEqual(input.metrics ?? {});
          expect(retrieved.tools).toEqual(input.tools ?? []);
          expect(retrieved.scope).toEqual(input.scope ?? []);
          expect(retrieved.model_config).toEqual(input.model_config ?? {});

          // Verify generated fields exist
          expect(retrieved.id).toBeDefined();
          expect(retrieved.organization_id).toBe(organizationId);
          expect(retrieved.created_at).toBeInstanceOf(Date);
          expect(retrieved.updated_at).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 3: CRUD Round-Trip Consistency (Agents)
   * Validates: Requirements 4.4
   *
   * For any valid agent and valid update data, updating the agent and then
   * retrieving it should return data with the updated fields.
   */
  it('should preserve agent data through update/retrieve round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        validCreateAgentInputArbitrary,
        fc.record({
          display_name: fc.option(validDisplayNameArbitrary, { nil: undefined }),
          status: fc.option(validStatusArbitrary, { nil: undefined }),
          role: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          system_prompt: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
        }) as fc.Arbitrary<UpdateAgentInput>,
        fc.uuid(), // organizationId
        async (createInput, updateInput, organizationId) => {
          // Create the agent first
          const created = await agentService.createAgent(createInput, organizationId);

          // Filter out undefined values from updateInput
          const filteredUpdate: UpdateAgentInput = {};
          if (updateInput.display_name !== undefined) {
            filteredUpdate.display_name = updateInput.display_name;
          }
          if (updateInput.status !== undefined) {
            filteredUpdate.status = updateInput.status;
          }
          if (updateInput.role !== undefined) {
            filteredUpdate.role = updateInput.role;
          }
          if (updateInput.system_prompt !== undefined) {
            filteredUpdate.system_prompt = updateInput.system_prompt;
          }

          // Skip if no actual updates
          if (Object.keys(filteredUpdate).length === 0) {
            return;
          }

          // Update the agent
          const updated = await agentService.updateAgent(created.id, filteredUpdate, organizationId);

          // Retrieve the agent by ID
          const retrieved = await agentService.getAgentById(updated.id, organizationId);

          // Verify updated fields are preserved
          if (filteredUpdate.display_name !== undefined) {
            expect(retrieved.display_name).toBe(filteredUpdate.display_name);
          } else {
            expect(retrieved.display_name).toBe(createInput.display_name);
          }

          if (filteredUpdate.status !== undefined) {
            expect(retrieved.status).toBe(filteredUpdate.status);
          } else {
            expect(retrieved.status).toBe(createInput.status);
          }

          if (filteredUpdate.role !== undefined) {
            expect(retrieved.role).toBe(filteredUpdate.role);
          } else {
            expect(retrieved.role).toBe(createInput.role ?? null);
          }

          if (filteredUpdate.system_prompt !== undefined) {
            expect(retrieved.system_prompt).toBe(filteredUpdate.system_prompt);
          } else {
            expect(retrieved.system_prompt).toBe(createInput.system_prompt ?? null);
          }

          // Verify non-updated fields are preserved
          expect(retrieved.name).toBe(createInput.name);
          expect(retrieved.organization_id).toBe(organizationId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 3: CRUD Round-Trip Consistency (Agents)
   * Validates: Requirements 4.3, 4.4
   *
   * For any created agent, the ID should be unique and consistent.
   */
  it('should generate unique IDs for each created agent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validCreateAgentInputArbitrary, { minLength: 2, maxLength: 10 }),
        fc.uuid(), // organizationId
        async (inputs, organizationId) => {
          // Make names unique to avoid conflicts
          const uniqueInputs = inputs.map((input, index) => ({
            ...input,
            name: `${input.name}-${index}-${Date.now()}`,
          }));

          // Create multiple agents
          const createdAgents = await Promise.all(
            uniqueInputs.map((input) => agentService.createAgent(input, organizationId))
          );

          // Collect all IDs
          const ids = createdAgents.map((agent) => agent.id);

          // Verify all IDs are unique
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);

          // Verify each agent can be retrieved by its ID
          for (const agent of createdAgents) {
            const retrieved = await agentService.getAgentById(agent.id, organizationId);
            expect(retrieved.id).toBe(agent.id);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
