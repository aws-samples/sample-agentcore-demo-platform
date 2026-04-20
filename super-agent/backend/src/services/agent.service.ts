/**
 * Agent Service
 * Business logic layer for Agent management.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { agentRepository, type AgentEntity } from '../repositories/agent.repository.js';
import { skillRepository } from '../repositories/skill.repository.js';
import { AppError } from '../middleware/errorHandler.js';
import { businessScopeService } from './businessScope.service.js';
import { agentStatusService } from './agent-status.service.js';
import { prisma } from '../config/database.js';
import type { CreateAgentInput, UpdateAgentInput, AgentFilter } from '../schemas/agent.schema.js';

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Agent Service class providing business logic for agent operations.
 */
export class AgentService {
  /**
   * Get all agents for an organization with optional filters.
   * Requirements: 4.1, 4.7, 4.8
   *
   * @param organizationId - The organization ID
   * @param filters - Optional filters (status, business_scope_id)
   * @param pagination - Optional pagination options
   * @returns Paginated list of agents
   */
  async getAgents(
    organizationId: string,
    filters?: AgentFilter,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<AgentEntity>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const agents = await agentRepository.findAllWithFilters(organizationId, filters, {
      skip,
      take: limit,
    });

    // Get total count for pagination
    const total = await agentRepository.count(organizationId, filters as Partial<AgentEntity>);

    // Enrich agents with real metrics from the daily rollup table
    await this.enrichAgentsWithMetrics(organizationId, agents);

    // Recover any agents stuck in "busy" from interrupted sessions
    agentStatusService.recoverStaleAgents(organizationId).catch(() => {});

    return {
      data: agents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single agent by ID.
   * Requirements: 4.2
   *
   * @param id - The agent ID
   * @param organizationId - The organization ID
   * @returns The agent if found
   * @throws AppError.notFound if agent doesn't exist
   */
  async getAgentById(id: string, organizationId: string): Promise<AgentEntity> {
    const agent = await agentRepository.findById(id, organizationId);

    if (!agent) {
      throw AppError.notFound(`Agent with ID ${id} not found`);
    }

    // Load assigned skills and populate the tools array with SKILL.md content
    const skills = await skillRepository.findByAgentId(organizationId, id);

    // Enrich with real metrics
    await this.enrichAgentsWithMetrics(organizationId, [agent]);
    if (skills.length > 0) {
      const toolsWithContent = await Promise.all(skills.map(async (s) => {
        let skillMd = s.description || '';
        
        // Try to read SKILL.md from local path
        const metadata = s.metadata as Record<string, unknown> | null;
        const localPath = metadata?.localPath as string | undefined;
        if (localPath) {
          try {
            skillMd = await readFile(join(localPath, 'SKILL.md'), 'utf-8');
          } catch {
            // Fall back to metadata.body or description if file not found
          }
        }

        // Fall back to metadata.body (used by scope-generator created skills)
        if (skillMd === (s.description || '') && metadata?.body && typeof metadata.body === 'string') {
          skillMd = `---\nname: ${s.name}\ndescription: ${s.description || ''}\n---\n\n${metadata.body}`;
        }
        
        return {
          id: s.id,
          name: s.name,
          skillMd,
        };
      }));
      agent.tools = toolsWithContent;
    }

    return agent;
  }

  /**
   * Create a new agent.
   * Requirements: 4.3, 4.6
   *
   * @param data - The agent data
   * @param organizationId - The organization ID
   * @returns The created agent
   * @throws AppError.validation if name is empty or invalid
   */
  async createAgent(data: CreateAgentInput, organizationId: string): Promise<AgentEntity> {
    // Validate required fields
    if (!data.name || data.name.trim() === '') {
      throw AppError.validation('Agent name is required');
    }

    if (!data.display_name || data.display_name.trim() === '') {
      throw AppError.validation('Display name is required');
    }

    // Check for duplicate name within the same business scope
    const scopeId = data.business_scope_id ?? null;
    const existingAgent = await agentRepository.findByName(organizationId, data.name, scopeId);
    if (existingAgent) {
      throw AppError.conflict(`Agent with name "${data.name}" already exists in this scope`);
    }

    // Create the agent
    const agent = await agentRepository.create(
      {
        name: data.name.trim(),
        display_name: data.display_name.trim(),
        business_scope_id: data.business_scope_id ?? null,
        role: data.role ?? null,
        avatar: data.avatar ?? null,
        status: data.status ?? 'active',
        metrics: data.metrics ?? {},
        tools: data.tools ?? [],
        scope: data.scope ?? [],
        system_prompt: data.system_prompt ?? null,
        model_config: data.model_config ?? {},
        origin: data.origin ?? 'scope_generation',
        is_shared: data.is_shared ?? false,
      },
      organizationId
    );

    // Create scope assignment if agent belongs to a scope
    if (agent.business_scope_id) {
      const { agentScopeAssignmentRepository } = await import('../repositories/agent-scope-assignment.repository.js');
      await agentScopeAssignmentRepository.assign(agent.id, agent.business_scope_id, true).catch((err) => {
        console.error(`Failed to create scope assignment for agent ${agent.id}:`, err);
      });
    }

    // Bump scope config version if agent belongs to a scope
    if (agent.business_scope_id) {
      await businessScopeService.bumpConfigVersion(agent.business_scope_id, organizationId).catch((err) => {
        console.error(`Failed to bump config_version for scope ${agent.business_scope_id}:`, err);
      });
    }

    return agent;
  }

  /**
   * Update an existing agent.
   * Requirements: 4.4, 4.6
   *
   * @param id - The agent ID
   * @param data - The update data
   * @param organizationId - The organization ID
   * @returns The updated agent
   * @throws AppError.notFound if agent doesn't exist
   * @throws AppError.validation if data is invalid
   */
  async updateAgent(
    id: string,
    data: UpdateAgentInput,
    organizationId: string
  ): Promise<AgentEntity> {
    // Verify agent exists
    const existingAgent = await agentRepository.findById(id, organizationId);
    if (!existingAgent) {
      throw AppError.notFound(`Agent with ID ${id} not found`);
    }

    // Validate name if provided
    if (data.name !== undefined) {
      if (!data.name || data.name.trim() === '') {
        throw AppError.validation('Agent name cannot be empty');
      }

      // Check for duplicate name within the same scope (excluding current agent)
      const scopeId = data.business_scope_id !== undefined ? data.business_scope_id : existingAgent.business_scope_id;
      const agentWithName = await agentRepository.findByName(organizationId, data.name, scopeId);
      if (agentWithName && agentWithName.id !== id) {
        throw AppError.conflict(`Agent with name "${data.name}" already exists in this scope`);
      }
    }

    // Validate display_name if provided
    if (
      data.display_name !== undefined &&
      (!data.display_name || data.display_name.trim() === '')
    ) {
      throw AppError.validation('Display name cannot be empty');
    }

    // Build update object with only provided fields
    const updateData: Partial<AgentEntity> = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.display_name !== undefined) updateData.display_name = data.display_name.trim();
    if (data.business_scope_id !== undefined) updateData.business_scope_id = data.business_scope_id;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.metrics !== undefined) updateData.metrics = data.metrics;
    if (data.tools !== undefined) updateData.tools = data.tools;
    if (data.scope !== undefined) updateData.scope = data.scope;
    if (data.system_prompt !== undefined) updateData.system_prompt = data.system_prompt;
    if (data.model_config !== undefined) updateData.model_config = data.model_config;

    const updatedAgent = await agentRepository.update(id, organizationId, updateData);

    if (!updatedAgent) {
      throw AppError.notFound(`Agent with ID ${id} not found`);
    }

    // Bump scope config version if agent belongs to a scope
    const scopeId = updatedAgent.business_scope_id ?? existingAgent.business_scope_id;
    if (scopeId) {
      await businessScopeService.bumpConfigVersion(scopeId, organizationId).catch((err) => {
        console.error(`Failed to bump config_version for scope ${scopeId}:`, err);
      });
    }

    return updatedAgent;
  }

  /**
   * Delete an agent (soft-delete).
   * Requirements: 4.5
   *
   * @param id - The agent ID
   * @param organizationId - The organization ID
   * @returns True if deleted successfully
   * @throws AppError.notFound if agent doesn't exist
   */
  async deleteAgent(id: string, organizationId: string): Promise<boolean> {
    // Get agent before deleting to check scope
    const agent = await agentRepository.findById(id, organizationId);
    if (!agent) {
      throw AppError.notFound(`Agent with ID ${id} not found`);
    }

    const deleted = await agentRepository.delete(id, organizationId);

    if (!deleted) {
      throw AppError.notFound(`Agent with ID ${id} not found`);
    }

    // Bump scope config version if agent belonged to a scope
    if (agent.business_scope_id) {
      await businessScopeService.bumpConfigVersion(agent.business_scope_id, organizationId).catch((err) => {
        console.error(`Failed to bump config_version for scope ${agent.business_scope_id}:`, err);
      });
    }

    return true;
  }

  /**
   * Get agents by business scope.
   * Requirements: 4.8
   *
   * @param organizationId - The organization ID
   * @param businessScopeId - The business scope ID
   * @returns List of agents in the business scope
   */
  async getAgentsByBusinessScope(
    organizationId: string,
    businessScopeId: string
  ): Promise<AgentEntity[]> {
    return agentRepository.findByBusinessScope(organizationId, businessScopeId);
  }

  /**
   * Get agents by status.
   * Requirements: 4.7
   *
   * @param organizationId - The organization ID
   * @param status - The agent status
   * @returns List of agents with the specified status
   */
  async getAgentsByStatus(
    organizationId: string,
    status: AgentEntity['status']
  ): Promise<AgentEntity[]> {
    return agentRepository.findByStatus(organizationId, status);
  }

  /**
   * Enrich agent entities with real metrics derived from agent_events.
   *
   * Metrics are computed from two perspectives:
   *
   * 1. As source (agent_id = this agent):
   *    - turn_complete / error → taskCount, responseRate
   *    - subagent_invocation   → subagentInvocations (delegations made)
   *    - tool_call             → toolCalls
   *    - turn_complete metadata.durationMs → avgResponseTime
   *
   * 2. As target (target_agent_id = this agent):
   *    - subagent_invocation   → taskCount (delegations received)
   *
   * For sub-agents that are only ever invoked via delegation, perspective 2
   * is the primary source of taskCount. The two perspectives are merged so
   * that every agent shows meaningful numbers regardless of its role.
   */
  private async enrichAgentsWithMetrics(
    organizationId: string,
    agents: AgentEntity[],
  ): Promise<void> {
    if (agents.length === 0) return;

    const agentIds = agents.map(a => a.id);

    try {
      // 1. Source-side metrics from the daily rollup
      const rows = await prisma.agent_metrics_daily.groupBy({
        by: ['agent_id', 'event_type'],
        where: {
          organization_id: organizationId,
          agent_id: { in: agentIds },
        },
        _sum: { count: true },
      });

      // 2. Target-side: count delegations received (subagent_invocation where target_agent_id = agent)
      const targetRows = await prisma.$queryRaw<
        Array<{ target_agent_id: string; cnt: bigint }>
      >`
        SELECT target_agent_id, COUNT(*)::bigint AS cnt
        FROM agent_events
        WHERE organization_id = ${organizationId}::uuid
          AND target_agent_id = ANY(${agentIds}::uuid[])
          AND event_type = 'subagent_invocation'
        GROUP BY target_agent_id
      `;
      const delegationsReceivedMap = new Map(
        targetRows.map(r => [r.target_agent_id, Number(r.cnt)]),
      );

      // 3. Average response time from turn_complete metadata (source-side, for orchestrators)
      const durationRows = await prisma.$queryRaw<
        Array<{ agent_id: string; avg_ms: number }>
      >`
        SELECT agent_id, AVG((metadata->>'durationMs')::numeric) AS avg_ms
        FROM agent_events
        WHERE organization_id = ${organizationId}::uuid
          AND agent_id = ANY(${agentIds}::uuid[])
          AND event_type = 'turn_complete'
          AND metadata->>'durationMs' IS NOT NULL
        GROUP BY agent_id
      `;
      const durationMap = new Map(durationRows.map(r => [r.agent_id, Number(r.avg_ms)]));

      // 4. Average working time for sub-agents from subagent_complete events (target-side)
      const targetDurationRows = await prisma.$queryRaw<
        Array<{ target_agent_id: string; avg_ms: number }>
      >`
        SELECT target_agent_id, AVG((metadata->>'durationMs')::numeric) AS avg_ms
        FROM agent_events
        WHERE organization_id = ${organizationId}::uuid
          AND target_agent_id = ANY(${agentIds}::uuid[])
          AND event_type = 'subagent_complete'
          AND metadata->>'durationMs' IS NOT NULL
        GROUP BY target_agent_id
      `;
      const targetDurationMap = new Map(
        targetDurationRows.map(r => [r.target_agent_id, Number(r.avg_ms)]),
      );

      // Build per-agent source metric maps
      const metricsMap = new Map<string, Record<string, number>>();
      for (const row of rows) {
        if (!metricsMap.has(row.agent_id)) metricsMap.set(row.agent_id, {});
        metricsMap.get(row.agent_id)![row.event_type] = row._sum.count ?? 0;
      }

      // Merge into each agent's metrics JSON
      for (const agent of agents) {
        const existing = (agent.metrics ?? {}) as Record<string, unknown>;
        const counts = metricsMap.get(agent.id) ?? {};

        // Source-side counts
        const turnComplete = counts['turn_complete'] ?? 0;
        const errors = counts['error'] ?? 0;
        const sourceTasks = turnComplete + errors;
        const subagentInvocations = counts['subagent_invocation'] ?? 0;
        const toolCalls = counts['tool_call'] ?? 0;

        // Target-side: delegations received by this agent
        const delegationsReceived = delegationsReceivedMap.get(agent.id) ?? 0;

        // taskCount = max(source tasks, delegations received)
        // For orchestrators sourceTasks dominates; for sub-agents delegationsReceived dominates.
        const taskCount = Math.max(sourceTasks, delegationsReceived);

        // responseRate is based on source-side turn_complete vs errors
        const responseRate = sourceTasks > 0
          ? Math.round((turnComplete / sourceTasks) * 100)
          : (delegationsReceived > 0 ? 100 : (existing.responseRate as number ?? 0));

        const avgMs = durationMap.get(agent.id) ?? targetDurationMap.get(agent.id);
        const avgResponseTime = avgMs != null
          ? formatDuration(avgMs)
          : (existing.avgResponseTime as string ?? '0s');

        agent.metrics = {
          ...existing,
          taskCount,
          responseRate,
          avgResponseTime,
          subagentInvocations,
          toolCalls,
        };
      }
    } catch (err) {
      // Non-critical — log and return agents with their existing metrics
      console.error('[agent-service] Failed to enrich metrics:', err);
    }
  }
}

/** Format milliseconds into a human-readable duration string. */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = Math.round(seconds % 60);
  return `${minutes}m ${remainSec}s`;
}

// Export singleton instance
export const agentService = new AgentService();
