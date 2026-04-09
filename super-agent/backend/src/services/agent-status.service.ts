/**
 * Agent Status Service
 *
 * Lightweight helper for transitioning agent status between active/busy
 * during chat and workflow execution. Failures are logged but never
 * propagated — status tracking should never break the main execution flow.
 */

import { agentRepository } from '../repositories/agent.repository.js';
import { prisma } from '../config/database.js';

export type AgentStatus = 'active' | 'busy' | 'offline';

/** Maximum time an agent can stay "busy" before being auto-recovered (10 minutes). */
const BUSY_STALENESS_MS = 10 * 60 * 1000;

class AgentStatusService {
  async setBusy(agentId: string, organizationId: string): Promise<void> {
    try {
      await agentRepository.update(agentId, organizationId, { status: 'busy' });
    } catch (err) {
      console.warn(`[agent-status] Failed to set agent ${agentId} to busy:`, err instanceof Error ? err.message : err);
    }
  }

  async setActive(agentId: string, organizationId: string): Promise<void> {
    try {
      await agentRepository.update(agentId, organizationId, { status: 'active' });
    } catch (err) {
      console.warn(`[agent-status] Failed to set agent ${agentId} to active:`, err instanceof Error ? err.message : err);
    }
  }

  /**
   * Recover agents stuck in "busy" status due to interrupted sessions.
   * Any agent that has been "busy" for longer than BUSY_STALENESS_MS
   * is reset to "active". Fire-and-forget — errors are logged only.
   */
  async recoverStaleAgents(organizationId: string): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - BUSY_STALENESS_MS);
      await prisma.agents.updateMany({
        where: {
          organization_id: organizationId,
          status: 'busy',
          updated_at: { lt: cutoff },
        },
        data: { status: 'active' },
      });
    } catch (err) {
      console.warn('[agent-status] Failed to recover stale agents:', err instanceof Error ? err.message : err);
    }
  }

  /**
   * Wraps an async operation with busy/active transitions.
   * Sets the agent to busy before running, active after (even on error).
   */
  async withBusyStatus<T>(
    agentId: string,
    organizationId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    await this.setBusy(agentId, organizationId);
    try {
      return await fn();
    } finally {
      await this.setActive(agentId, organizationId);
    }
  }
}

export const agentStatusService = new AgentStatusService();
