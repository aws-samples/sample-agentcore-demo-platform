/**
 * Execution Checkpoint Service
 *
 * Manages async checkpoint lifecycle: create, resolve, expire.
 * Checkpoints pause workflow execution and wait for external signals
 * (human approval, webhook callback, scheduled delay, etc.)
 */

import { prisma } from '../config/database.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CheckpointType = 'human_approval' | 'webhook_callback' | 'scheduled_delay' | 'external_job' | 'form_input';
export type CheckpointStatus = 'waiting' | 'resolved' | 'expired' | 'cancelled';

export interface CheckpointConfig {
  // human_approval
  instructions?: string;
  displayFields?: string[];
  approverRoles?: string[];
  requiredApprovals?: number;
  // webhook_callback
  callbackPath?: string;
  expectedSchema?: Record<string, unknown>;
  secretHeader?: string;
  secretHash?: string;
  // scheduled_delay
  delaySeconds?: number;
  resumeAt?: string;
  // form_input
  fields?: Array<{ name: string; type: string; required?: boolean; label?: string }>;
  prefillFrom?: Record<string, string>;
  // generic
  [key: string]: unknown;
}

export interface InputContext {
  upstream_outputs: Record<string, { title: string; output: unknown }>;
  variables: Record<string, unknown>;
}

export interface CreateCheckpointInput {
  executionId: string;
  nodeId: string;
  nodeTitle?: string;
  checkpointType: CheckpointType;
  config: CheckpointConfig;
  inputContext: InputContext;
  organizationId: string;
  expiresInSeconds?: number;
}

export interface ResolveCheckpointInput {
  status: 'resolved' | 'cancelled';
  result?: Record<string, unknown>;
  reason?: string;
  resolvedBy?: string;
  resolvedBySource?: 'user' | 'webhook' | 'scheduler' | 'system';
}

export interface CheckpointRecord {
  id: string;
  executionId: string;
  nodeId: string;
  nodeTitle: string | null;
  checkpointType: string;
  status: string;
  config: CheckpointConfig;
  inputContext: InputContext;
  result: Record<string, unknown> | null;
  createdAt: Date;
  resolvedAt: Date | null;
  expiresAt: Date | null;
  resolvedBy: string | null;
  resolvedBySource: string | null;
  organizationId: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CheckpointService {
  /**
   * Create a checkpoint record and pause the execution.
   */
  async create(input: CreateCheckpointInput): Promise<CheckpointRecord> {
    const expiresAt = input.expiresInSeconds
      ? new Date(Date.now() + input.expiresInSeconds * 1000)
      : null;

    const checkpoint = await prisma.execution_checkpoints.create({
      data: {
        execution_id: input.executionId,
        node_id: input.nodeId,
        node_title: input.nodeTitle,
        checkpoint_type: input.checkpointType,
        status: 'waiting',
        config: JSON.parse(JSON.stringify(input.config)),
        input_context: JSON.parse(JSON.stringify(input.inputContext)),
        organization_id: input.organizationId,
        expires_at: expiresAt,
      },
    });

    // Update the execution to paused state
    await prisma.workflow_executions.update({
      where: { id: input.executionId },
      data: {
        status: 'paused',
        paused_at_node: input.nodeId,
      },
    });

    // Update the node execution to paused
    try {
      await prisma.node_executions.update({
        where: { execution_id_node_id: { execution_id: input.executionId, node_id: input.nodeId } },
        data: { status: 'paused', started_at: new Date() },
      });
    } catch { /* node execution may not exist yet */ }

    return this.toRecord(checkpoint);
  }

  /**
   * Resolve a checkpoint (approve, submit form, receive callback, etc.)
   * Returns the checkpoint and the execution ID for triggering resume.
   */
  async resolve(
    checkpointId: string,
    input: ResolveCheckpointInput,
  ): Promise<{ checkpoint: CheckpointRecord; executionId: string; organizationId: string }> {
    const checkpoint = await prisma.execution_checkpoints.findUnique({
      where: { id: checkpointId },
    });

    if (!checkpoint) throw new Error('Checkpoint not found');
    if (checkpoint.status !== 'waiting') throw new Error(`Checkpoint is already ${checkpoint.status}`);

    // Check expiry
    if (checkpoint.expires_at && new Date() > checkpoint.expires_at) {
      await prisma.execution_checkpoints.update({
        where: { id: checkpointId },
        data: { status: 'expired' },
      });
      throw new Error('Checkpoint has expired');
    }

    const updated = await prisma.execution_checkpoints.update({
      where: { id: checkpointId },
      data: {
        status: input.status,
        result: input.result ? JSON.parse(JSON.stringify(input.result)) : undefined,
        resolved_at: new Date(),
        resolved_by: input.resolvedBy,
        resolved_by_source: input.resolvedBySource,
      },
    });

    // Update the node execution with the result
    try {
      await prisma.node_executions.update({
        where: {
          execution_id_node_id: {
            execution_id: checkpoint.execution_id,
            node_id: checkpoint.node_id,
          },
        },
        data: {
          status: input.status === 'resolved' ? 'finish' : 'failed',
          output_data: input.result ? JSON.parse(JSON.stringify(input.result)) : undefined,
          completed_at: new Date(),
          ...(input.status === 'cancelled' ? { error_message: input.reason || 'Cancelled' } : {}),
        },
      });
    } catch { /* non-critical */ }

    return {
      checkpoint: this.toRecord(updated),
      executionId: checkpoint.execution_id,
      organizationId: checkpoint.organization_id,
    };
  }

  /**
   * Get a checkpoint by ID.
   */
  async getById(checkpointId: string): Promise<CheckpointRecord | null> {
    const checkpoint = await prisma.execution_checkpoints.findUnique({
      where: { id: checkpointId },
    });
    return checkpoint ? this.toRecord(checkpoint) : null;
  }

  /**
   * Get the active (waiting) checkpoint for an execution.
   */
  async getActiveForExecution(executionId: string): Promise<CheckpointRecord | null> {
    const checkpoint = await prisma.execution_checkpoints.findFirst({
      where: { execution_id: executionId, status: 'waiting' },
      orderBy: { created_at: 'desc' },
    });
    return checkpoint ? this.toRecord(checkpoint) : null;
  }

  /**
   * List pending checkpoints for an organization (for dashboard/notifications).
   */
  async listPending(organizationId: string): Promise<CheckpointRecord[]> {
    const checkpoints = await prisma.execution_checkpoints.findMany({
      where: { organization_id: organizationId, status: 'waiting' },
      orderBy: { created_at: 'desc' },
    });
    return checkpoints.map((c: Record<string, unknown>) => this.toRecord(c));
  }

  /**
   * Expire all overdue checkpoints. Called by a scheduled job.
   */
  async expireOverdue(): Promise<number> {
    const now = new Date();
    const overdue = await prisma.execution_checkpoints.findMany({
      where: { status: 'waiting', expires_at: { lt: now } },
    });

    for (const checkpoint of overdue) {
      await prisma.execution_checkpoints.update({
        where: { id: checkpoint.id },
        data: { status: 'expired', resolved_at: now },
      });

      // Fail the parent execution
      await prisma.workflow_executions.update({
        where: { id: checkpoint.execution_id },
        data: {
          status: 'failed',
          error_message: `Checkpoint "${checkpoint.node_title || checkpoint.node_id}" expired`,
          completed_at: now,
        },
      });
    }

    return overdue.length;
  }

  /**
   * Build input_context from completed node executions and workflow variables.
   */
  async buildInputContext(executionId: string): Promise<InputContext> {
    const execution = await prisma.workflow_executions.findUnique({
      where: { id: executionId },
    });

    const completedNodes = await prisma.node_executions.findMany({
      where: { execution_id: executionId, status: 'finish' },
      orderBy: { completed_at: 'asc' },
    });

    const upstreamOutputs: Record<string, { title: string; output: unknown }> = {};
    for (const node of completedNodes) {
      upstreamOutputs[node.node_id] = {
        title: (node.node_data as Record<string, unknown>)?.title as string || node.node_id,
        output: node.output_data,
      };
    }

    // Parse variables from execution record
    const variables: Record<string, unknown> = {};
    if (execution?.variables) {
      const vars = execution.variables as Array<{ name?: string; value?: unknown }>;
      if (Array.isArray(vars)) {
        for (const v of vars) {
          if (v.name) variables[v.name] = v.value;
        }
      }
    }

    return { upstream_outputs: upstreamOutputs, variables };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toRecord(row: any): CheckpointRecord {
    return {
      id: row.id,
      executionId: row.execution_id,
      nodeId: row.node_id,
      nodeTitle: row.node_title,
      checkpointType: row.checkpoint_type,
      status: row.status,
      config: (row.config || {}) as CheckpointConfig,
      inputContext: (row.input_context || {}) as InputContext,
      result: row.result as Record<string, unknown> | null,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      expiresAt: row.expires_at,
      resolvedBy: row.resolved_by,
      resolvedBySource: row.resolved_by_source,
      organizationId: row.organization_id,
    };
  }
}

export const checkpointService = new CheckpointService();
