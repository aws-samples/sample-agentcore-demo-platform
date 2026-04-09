/**
 * Webhook Service
 * Manages webhooks for external workflow triggers.
 */

import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { redisService } from './redis.service.js';
import { workflowRepository } from '../repositories/workflow.repository.js';
import { workflowExecutorV2, type WorkflowV2Plan } from './workflow-executor-v2.js';

const WEBHOOK_ID_PREFIX = 'wh_';
const WEBHOOK_ID_LENGTH = 24;
const WEBHOOK_CONFIG_CACHE_TTL = 300; // 5 minutes

export interface WebhookConfig {
  id: string;
  webhookId: string;
  organizationId: string;
  workflowId: string;
  name: string | null;
  isEnabled: boolean;
  timeoutSeconds: number;
  secretHash: string | null;
  allowedIps: string[];
}

export interface WebhookCallRecord {
  id: string;
  webhookId: string;
  executionId: string | null;
  status: string;
  responseTimeMs: number | null;
  errorMessage: string | null;
  createdAt: Date;
}

class WebhookService {
  /**
   * Generate a unique webhook ID
   */
  private generateWebhookId(): string {
    const randomBytes = crypto.randomBytes(WEBHOOK_ID_LENGTH / 2);
    return `${WEBHOOK_ID_PREFIX}${randomBytes.toString('hex')}`;
  }

  /**
   * Generate a webhook secret
   */
  private generateSecret(): { secret: string; hash: string } {
    const secret = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    return { secret, hash };
  }

  /**
   * Create a webhook for a workflow
   */
  async createWebhook(
    organizationId: string,
    workflowId: string,
    options: {
      name?: string;
      timeoutSeconds?: number;
      generateSecret?: boolean;
      allowedIps?: string[];
      createdBy?: string;
    } = {}
  ): Promise<{ webhook: WebhookConfig; secret?: string; webhookUrl: string }> {
    // Verify workflow exists
    const workflow = await workflowRepository.findById(workflowId, organizationId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const webhookId = this.generateWebhookId();
    let secretHash: string | null = null;
    let secret: string | undefined;

    if (options.generateSecret) {
      const generated = this.generateSecret();
      secret = generated.secret;
      secretHash = generated.hash;
    }

    const webhook = await prisma.webhooks.create({
      data: {
        organization_id: organizationId,
        workflow_id: workflowId,
        webhook_id: webhookId,
        name: options.name,
        timeout_seconds: options.timeoutSeconds || 30,
        secret_hash: secretHash,
        allowed_ips: options.allowedIps || [],
        created_by: options.createdBy,
      },
    });

    const config = this.mapToWebhookConfig(webhook);
    const webhookUrl = this.generateWebhookUrl(webhookId);

    return { webhook: config, secret, webhookUrl };
  }

  /**
   * Get webhook configuration by webhook ID
   */
  async getWebhookConfig(webhookId: string): Promise<WebhookConfig | null> {
    // Check cache first
    const cacheKey = `webhook:${webhookId}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const webhook = await prisma.webhooks.findFirst({
      where: { webhook_id: webhookId, deleted_at: null },
    });

    if (!webhook) {
      return null;
    }

    const config = this.mapToWebhookConfig(webhook);

    // Cache for 5 minutes (TTL in ms)
    await redisService.set(cacheKey, JSON.stringify(config), WEBHOOK_CONFIG_CACHE_TTL * 1000);

    return config;
  }

  /**
   * Trigger a webhook (fire-and-forget execution)
   */
  async triggerWebhook(
    webhookId: string,
    payload: {
      variables?: Record<string, unknown>;
      headers?: Record<string, string>;
      ipAddress?: string;
    }
  ): Promise<{ received: boolean; callRecordId: string }> {
    const startTime = Date.now();
    const config = await this.getWebhookConfig(webhookId);

    if (!config) {
      throw new Error('Webhook not found');
    }

    if (!config.isEnabled) {
      throw new Error('Webhook is disabled');
    }

    // Check IP allowlist if configured
    if (config.allowedIps.length > 0 && payload.ipAddress) {
      if (!config.allowedIps.includes(payload.ipAddress)) {
        throw new Error('IP address not allowed');
      }
    }

    // Create call record
    const callRecord = await prisma.webhook_call_records.create({
      data: {
        webhook_id: webhookId,
        organization_id: config.organizationId,
        request_method: 'POST',
        request_headers: payload.headers || {},
        request_body: payload.variables || {},
        status: 'pending',
        ip_address: payload.ipAddress,
      },
    });

    // Fire-and-forget execution
    this.executeWebhookAsync(config, payload.variables || {}, callRecord.id, startTime)
      .catch(error => {
        console.error(`[WEBHOOK_ERROR] webhookId=${webhookId} error=${error.message}`);
      });

    return { received: true, callRecordId: callRecord.id };
  }

  /**
   * Execute webhook asynchronously
   */
  private async executeWebhookAsync(
    config: WebhookConfig,
    variables: Record<string, unknown>,
    callRecordId: string,
    startTime: number
  ): Promise<void> {
    try {
      const workflow = await workflowRepository.findById(config.workflowId, config.organizationId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const scopeId = (workflow as any).business_scope_id;
      if (!scopeId) {
        throw new Error('Workflow has no business scope assigned');
      }

      // Build V2 plan from stored workflow (same as schedule/manual Run)
      const webhookVariables = Object.entries(variables).map(([name, value]) => ({
        variableId: `var-${name}`,
        name,
        value: String(value),
        description: '',
      }));

      const nodes = (workflow.nodes || []) as Array<{
        id: string; title?: string; label?: string; type: string; prompt?: string;
        dependentTasks?: string[]; agentId?: string;
        metadata?: Record<string, unknown>;
      }>;

      const plan: WorkflowV2Plan = {
        title: workflow.name,
        nodes: nodes.map(n => ({
          id: n.id,
          title: n.title || n.label || n.id,
          type: (n.type as 'agent' | 'action' | 'condition' | 'document' | 'codeArtifact') || 'agent',
          prompt: n.prompt || (n.metadata?.prompt as string) || n.title || n.label || n.id,
          dependentTasks: n.dependentTasks || (n.metadata?.dependentTasks as string[]),
          agentId: n.agentId || (n.metadata?.agentId as string),
        })),
        edges: ((workflow.connections || []) as Array<{ source?: string; target?: string; from?: string; to?: string }>).map(c => ({
          source: c.source || c.from || '',
          target: c.target || c.to || '',
        })),
        variables: webhookVariables,
      };

      // Mark as running before execution starts
      await prisma.webhook_call_records.update({
        where: { id: callRecordId },
        data: { status: 'running' },
      });

      // Execute using V2 executor (agentic, same as manual Run and cron)
      const generator = workflowExecutorV2.execute(
        plan,
        config.organizationId,
        scopeId,
        'system',
      );

      // Drain the generator, collecting logs (same pattern as schedule runV2Execution)
      const logs: Array<{ type: string; content?: string; taskId?: string; taskTitle?: string; timestamp: string }> = [];
      let lastError: string | null = null;
      let logFlushCount = 0;

      for await (const event of generator) {
        const timestamp = new Date().toISOString();

        if (event.type === 'error') {
          lastError = event.message || 'Unknown error';
          logs.push({ type: 'error', content: lastError, timestamp });
        } else if (event.type === 'step_start') {
          logs.push({ type: 'step_start', taskId: event.taskId, taskTitle: event.taskTitle, timestamp });
        } else if (event.type === 'step_complete') {
          logs.push({ type: 'step_complete', taskId: event.taskId, taskTitle: event.taskTitle, timestamp });
        } else if (event.type === 'step_failed') {
          logs.push({ type: 'step_failed', taskId: event.taskId, taskTitle: event.taskTitle, content: event.message, timestamp });
        } else if (event.type === 'done') {
          logs.push({ type: 'done', timestamp });
        } else if (event.type === 'log') {
          const content = typeof event.content === 'string' ? event.content : JSON.stringify(event.content);
          logs.push({ type: 'log', content: content?.slice(0, 2000), timestamp });
        }

        // Persist logs periodically (every 5 events)
        if (++logFlushCount % 5 === 0) {
          prisma.webhook_call_records.update({
            where: { id: callRecordId },
            data: { logs: logs as any },
          }).catch(() => {});
        }
      }

      const responseTime = Date.now() - startTime;

      await prisma.webhook_call_records.update({
        where: { id: callRecordId },
        data: {
          status: lastError ? 'failed' : 'success',
          response_status: lastError ? 500 : 200,
          response_time_ms: responseTime,
          error_message: lastError,
          logs: logs as any,
        },
      });
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      await prisma.webhook_call_records.update({
        where: { id: callRecordId },
        data: {
          status: 'failed',
          response_status: 500,
          response_time_ms: responseTime,
          error_message: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * List webhooks for a workflow
   */
  async listWebhooks(workflowId: string, organizationId: string): Promise<WebhookConfig[]> {
    const webhooks = await prisma.webhooks.findMany({
      where: {
        workflow_id: workflowId,
        organization_id: organizationId,
        deleted_at: null,
      },
      orderBy: { created_at: 'desc' },
    });

    return webhooks.map(this.mapToWebhookConfig);
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(
    webhookId: string,
    organizationId: string,
    updates: {
      name?: string;
      isEnabled?: boolean;
      timeoutSeconds?: number;
      allowedIps?: string[];
    }
  ): Promise<WebhookConfig> {
    const webhook = await prisma.webhooks.findFirst({
      where: { webhook_id: webhookId, organization_id: organizationId, deleted_at: null },
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const updated = await prisma.webhooks.update({
      where: { id: webhook.id },
      data: {
        name: updates.name,
        is_enabled: updates.isEnabled,
        timeout_seconds: updates.timeoutSeconds,
        allowed_ips: updates.allowedIps,
      },
    });

    // Clear cache
    await redisService.delete(`webhook:${webhookId}`);

    return this.mapToWebhookConfig(updated);
  }

  /**
   * Delete a webhook (soft delete)
   */
  async deleteWebhook(webhookId: string, organizationId: string): Promise<void> {
    const webhook = await prisma.webhooks.findFirst({
      where: { webhook_id: webhookId, organization_id: organizationId, deleted_at: null },
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    await prisma.webhooks.update({
      where: { id: webhook.id },
      data: {
        deleted_at: new Date(),
        is_enabled: false,
      },
    });

    // Clear cache
    await redisService.delete(`webhook:${webhookId}`);
  }

  /**
   * Get webhook call history
   */
  async getCallHistory(
    webhookId: string,
    organizationId: string,
    pagination: { page: number; limit: number }
  ): Promise<{ records: WebhookCallRecord[]; total: number }> {
    const webhook = await prisma.webhooks.findFirst({
      where: { webhook_id: webhookId, organization_id: organizationId, deleted_at: null },
    });

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const [records, total] = await Promise.all([
      prisma.webhook_call_records.findMany({
        where: { webhook_id: webhookId },
        orderBy: { created_at: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.webhook_call_records.count({
        where: { webhook_id: webhookId },
      }),
    ]);

    return {
      records: records.map(r => ({
        id: r.id,
        webhookId: r.webhook_id,
        executionId: r.execution_id,
        status: r.status,
        responseTimeMs: r.response_time_ms,
        errorMessage: r.error_message,
        logs: (r as any).logs || [],
        createdAt: r.created_at,
      })),
      total,
    };
  }

  /**
   * Get webhook call status by callRecordId (public, no org check)
   */
  async getCallStatus(callRecordId: string): Promise<{
    callRecordId: string;
    status: string;
    errorMessage: string | null;
    createdAt: Date;
    execution: {
      status: string;
      startedAt: Date;
      completedAt: Date | null;
      nodes: {
        nodeId: string;
        nodeType: string;
        status: string;
        progress: number;
        startedAt: Date | null;
        completedAt: Date | null;
      }[];
    } | null;
  }> {
    const record = await prisma.webhook_call_records.findUnique({
      where: { id: callRecordId },
    });

    if (!record) {
      throw new Error('Call record not found');
    }

    let execution = null;
    if (record.execution_id) {
      const exec = await prisma.workflow_executions.findUnique({
        where: { id: record.execution_id },
        include: {
          node_executions: {
            orderBy: { created_at: 'asc' },
            select: {
              node_id: true,
              node_type: true,
              status: true,
              progress: true,
              started_at: true,
              completed_at: true,
            },
          },
        },
      });

      if (exec) {
        execution = {
          status: exec.status,
          startedAt: exec.started_at,
          completedAt: exec.completed_at,
          nodes: exec.node_executions.map(n => ({
            nodeId: n.node_id,
            nodeType: n.node_type,
            status: n.status,
            progress: n.progress,
            startedAt: n.started_at,
            completedAt: n.completed_at,
          })),
        };
      }
    }

    return {
      callRecordId: record.id,
      status: record.status,
      errorMessage: record.error_message,
      createdAt: record.created_at,
      execution,
    };
  }

  /**
   * Generate webhook URL
   */
  private generateWebhookUrl(webhookId: string): string {
    // PUBLIC_API_URL is the externally-reachable base URL (e.g. https://api.example.com).
    // Falls back to API_BASE_URL (backend internal), then localhost for dev.
    const baseUrl = process.env.PUBLIC_API_URL || process.env.API_BASE_URL || 'http://localhost:3001';
    return `${baseUrl}/api/v1/webhook/${webhookId}/trigger`;
  }

  private mapToWebhookConfig(webhook: any): WebhookConfig {
    return {
      id: webhook.id,
      webhookId: webhook.webhook_id,
      organizationId: webhook.organization_id,
      workflowId: webhook.workflow_id,
      name: webhook.name,
      isEnabled: webhook.is_enabled,
      timeoutSeconds: webhook.timeout_seconds,
      secretHash: webhook.secret_hash,
      allowedIps: webhook.allowed_ips as string[],
    };
  }
}

export const webhookService = new WebhookService();
