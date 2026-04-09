/**
 * Agent Scope Assignment Repository
 * Manages M:N relationships between agents and business scopes.
 */

import { prisma } from '../config/database.js';

export interface AgentScopeAssignmentEntity {
  id: string;
  agent_id: string;
  business_scope_id: string;
  is_primary: boolean;
  assigned_at: Date;
  assigned_by: string | null;
}

export class AgentScopeAssignmentRepository {
  async findByAgent(agentId: string): Promise<AgentScopeAssignmentEntity[]> {
    return prisma.agent_scope_assignments.findMany({
      where: { agent_id: agentId },
      orderBy: [{ is_primary: 'desc' }, { assigned_at: 'asc' }],
    }) as unknown as Promise<AgentScopeAssignmentEntity[]>;
  }

  async findByScope(businessScopeId: string): Promise<AgentScopeAssignmentEntity[]> {
    return prisma.agent_scope_assignments.findMany({
      where: { business_scope_id: businessScopeId },
      orderBy: { assigned_at: 'asc' },
    }) as unknown as Promise<AgentScopeAssignmentEntity[]>;
  }

  async assign(
    agentId: string,
    businessScopeId: string,
    isPrimary = false,
    assignedBy?: string,
  ): Promise<AgentScopeAssignmentEntity> {
    return prisma.agent_scope_assignments.upsert({
      where: { unique_agent_scope: { agent_id: agentId, business_scope_id: businessScopeId } },
      update: { is_primary: isPrimary },
      create: {
        agent_id: agentId,
        business_scope_id: businessScopeId,
        is_primary: isPrimary,
        assigned_by: assignedBy ?? null,
      },
    }) as unknown as Promise<AgentScopeAssignmentEntity>;
  }

  async unassign(agentId: string, businessScopeId: string): Promise<boolean> {
    const result = await prisma.agent_scope_assignments.deleteMany({
      where: { agent_id: agentId, business_scope_id: businessScopeId },
    });
    return result.count > 0;
  }

  async isAssigned(agentId: string, businessScopeId: string): Promise<boolean> {
    const count = await prisma.agent_scope_assignments.count({
      where: { agent_id: agentId, business_scope_id: businessScopeId },
    });
    return count > 0;
  }

  /**
   * Sync from legacy: create assignment from agents.business_scope_id
   */
  async syncFromLegacy(agentId: string, businessScopeId: string): Promise<void> {
    await this.assign(agentId, businessScopeId, true);
  }
}

export const agentScopeAssignmentRepository = new AgentScopeAssignmentRepository();
