/**
 * Unit tests for Webhook Service
 *
 * Tests webhook creation, triggering, status query, and security checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ============================================================================
// Mocks
// ============================================================================

const mockPrisma = {
  webhooks: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  webhook_call_records: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  workflow_executions: {
    findUnique: vi.fn(),
  },
};

const mockRedisService = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockWorkflowExecutionService = {
  initializeWorkflowExecution: vi.fn(),
};

const mockWorkflowRepository = {
  findById: vi.fn(),
};

vi.mock('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../src/services/redis.service.js', () => ({
  redisService: mockRedisService,
}));

vi.mock('../../src/services/workflow-execution.service.js', () => ({
  workflowExecutionService: mockWorkflowExecutionService,
}));

vi.mock('../../src/repositories/workflow.repository.js', () => ({
  workflowRepository: mockWorkflowRepository,
}));

// Import after mocks
const { webhookService } = await import('../../src/services/webhook.service.js');

// ============================================================================
// Helpers
// ============================================================================

function makeWebhookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'uuid-1',
    organization_id: 'org-1',
    workflow_id: 'wf-1',
    webhook_id: 'wh_abc123def456abc1',
    name: 'Test Webhook',
    is_enabled: true,
    timeout_seconds: 30,
    secret_hash: null,
    allowed_ips: [],
    created_by: null,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  };
}

function makeCallRecordRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cr-uuid-1',
    webhook_id: 'wh_abc123def456abc1',
    organization_id: 'org-1',
    execution_id: null,
    request_method: 'POST',
    request_headers: {},
    request_body: {},
    response_status: null,
    response_time_ms: null,
    status: 'pending',
    error_message: null,
    ip_address: '127.0.0.1',
    created_at: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('WebhookService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisService.get.mockResolvedValue(null); // cache miss by default
  });

  // --------------------------------------------------------------------------
  // createWebhook
  // --------------------------------------------------------------------------
  describe('createWebhook', () => {
    it('should create a webhook and return config + URL', async () => {
      mockWorkflowRepository.findById.mockResolvedValue({ id: 'wf-1' });
      mockPrisma.webhooks.create.mockResolvedValue(makeWebhookRow());

      const result = await webhookService.createWebhook('org-1', 'wf-1', {
        name: 'Test Webhook',
      });

      expect(result.webhook.organizationId).toBe('org-1');
      expect(result.webhook.workflowId).toBe('wf-1');
      expect(result.webhookUrl).toContain('/v1/webhook/');
      expect(result.webhookUrl).toContain('/trigger');
      expect(result.secret).toBeUndefined();
    });

    it('should generate a secret when requested', async () => {
      mockWorkflowRepository.findById.mockResolvedValue({ id: 'wf-1' });
      mockPrisma.webhooks.create.mockResolvedValue(
        makeWebhookRow({ secret_hash: 'somehash' })
      );

      const result = await webhookService.createWebhook('org-1', 'wf-1', {
        generateSecret: true,
      });

      expect(result.secret).toBeDefined();
      expect(result.secret!.length).toBe(64); // 32 bytes hex
      // Verify the hash was passed to prisma
      const createCall = mockPrisma.webhooks.create.mock.calls[0][0];
      expect(createCall.data.secret_hash).toBeTruthy();
    });

    it('should throw when workflow not found', async () => {
      mockWorkflowRepository.findById.mockResolvedValue(null);

      await expect(
        webhookService.createWebhook('org-1', 'wf-nonexistent')
      ).rejects.toThrow('Workflow not found');
    });
  });

  // --------------------------------------------------------------------------
  // generateWebhookId (tested indirectly)
  // --------------------------------------------------------------------------
  describe('webhook ID format', () => {
    it('should generate IDs with wh_ prefix and correct length', async () => {
      mockWorkflowRepository.findById.mockResolvedValue({ id: 'wf-1' });
      mockPrisma.webhooks.create.mockImplementation(({ data }: any) => {
        return Promise.resolve(makeWebhookRow({ webhook_id: data.webhook_id }));
      });

      const result = await webhookService.createWebhook('org-1', 'wf-1');
      const webhookId = result.webhook.webhookId;

      expect(webhookId).toMatch(/^wh_[0-9a-f]{24}$/);
    });
  });

  // --------------------------------------------------------------------------
  // triggerWebhook
  // --------------------------------------------------------------------------
  describe('triggerWebhook', () => {
    it('should accept trigger and return callRecordId', async () => {
      const row = makeWebhookRow();
      mockPrisma.webhooks.findFirst.mockResolvedValue(row);
      mockPrisma.webhook_call_records.create.mockResolvedValue(
        makeCallRecordRow({ id: 'cr-new' })
      );
      // Mock async execution (fire-and-forget)
      mockWorkflowRepository.findById.mockResolvedValue({
        id: 'wf-1',
        nodes: [],
        connections: [],
      });
      mockWorkflowExecutionService.initializeWorkflowExecution.mockResolvedValue('exec-1');
      mockPrisma.webhook_call_records.update.mockResolvedValue({});

      const result = await webhookService.triggerWebhook('wh_abc123def456abc1', {
        variables: { key: 'value' },
        ipAddress: '10.0.0.1',
      });

      expect(result.received).toBe(true);
      expect(result.callRecordId).toBe('cr-new');
    });

    it('should throw when webhook not found', async () => {
      mockPrisma.webhooks.findFirst.mockResolvedValue(null);

      await expect(
        webhookService.triggerWebhook('wh_nonexistent', {})
      ).rejects.toThrow('Webhook not found');
    });

    it('should throw when webhook is disabled', async () => {
      mockPrisma.webhooks.findFirst.mockResolvedValue(
        makeWebhookRow({ is_enabled: false })
      );

      await expect(
        webhookService.triggerWebhook('wh_abc123def456abc1', {})
      ).rejects.toThrow('Webhook is disabled');
    });

    it('should reject disallowed IP addresses', async () => {
      mockPrisma.webhooks.findFirst.mockResolvedValue(
        makeWebhookRow({ allowed_ips: ['10.0.0.1', '10.0.0.2'] })
      );

      await expect(
        webhookService.triggerWebhook('wh_abc123def456abc1', {
          ipAddress: '192.168.1.1',
        })
      ).rejects.toThrow('IP address not allowed');
    });

    it('should allow requests from whitelisted IPs', async () => {
      mockPrisma.webhooks.findFirst.mockResolvedValue(
        makeWebhookRow({ allowed_ips: ['10.0.0.1'] })
      );
      mockPrisma.webhook_call_records.create.mockResolvedValue(
        makeCallRecordRow({ id: 'cr-ip-ok' })
      );
      mockWorkflowRepository.findById.mockResolvedValue({
        id: 'wf-1',
        nodes: [],
        connections: [],
      });
      mockWorkflowExecutionService.initializeWorkflowExecution.mockResolvedValue('exec-1');
      mockPrisma.webhook_call_records.update.mockResolvedValue({});

      const result = await webhookService.triggerWebhook('wh_abc123def456abc1', {
        ipAddress: '10.0.0.1',
      });

      expect(result.received).toBe(true);
    });

    it('should skip IP check when allowedIps is empty', async () => {
      mockPrisma.webhooks.findFirst.mockResolvedValue(
        makeWebhookRow({ allowed_ips: [] })
      );
      mockPrisma.webhook_call_records.create.mockResolvedValue(
        makeCallRecordRow({ id: 'cr-no-ip-check' })
      );
      mockWorkflowRepository.findById.mockResolvedValue({
        id: 'wf-1',
        nodes: [],
        connections: [],
      });
      mockWorkflowExecutionService.initializeWorkflowExecution.mockResolvedValue('exec-1');
      mockPrisma.webhook_call_records.update.mockResolvedValue({});

      const result = await webhookService.triggerWebhook('wh_abc123def456abc1', {
        ipAddress: '1.2.3.4',
      });

      expect(result.received).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // getCallStatus (new status query)
  // --------------------------------------------------------------------------
  describe('getCallStatus', () => {
    it('should return call record status without execution', async () => {
      mockPrisma.webhook_call_records.findUnique.mockResolvedValue(
        makeCallRecordRow({ id: 'cr-1', status: 'pending', execution_id: null })
      );

      const result = await webhookService.getCallStatus('cr-1');

      expect(result.callRecordId).toBe('cr-1');
      expect(result.status).toBe('pending');
      expect(result.execution).toBeNull();
    });

    it('should return execution details when execution exists', async () => {
      const now = new Date();
      mockPrisma.webhook_call_records.findUnique.mockResolvedValue(
        makeCallRecordRow({ id: 'cr-2', status: 'success', execution_id: 'exec-1' })
      );
      mockPrisma.workflow_executions.findUnique.mockResolvedValue({
        id: 'exec-1',
        status: 'running',
        started_at: now,
        completed_at: null,
        node_executions: [
          {
            node_id: 'node-1',
            node_type: 'agent',
            status: 'completed',
            progress: 100,
            started_at: now,
            completed_at: now,
          },
          {
            node_id: 'node-2',
            node_type: 'tool',
            status: 'running',
            progress: 50,
            started_at: now,
            completed_at: null,
          },
        ],
      });

      const result = await webhookService.getCallStatus('cr-2');

      expect(result.callRecordId).toBe('cr-2');
      expect(result.status).toBe('success');
      expect(result.execution).not.toBeNull();
      expect(result.execution!.status).toBe('running');
      expect(result.execution!.nodes).toHaveLength(2);
      expect(result.execution!.nodes[0].nodeId).toBe('node-1');
      expect(result.execution!.nodes[0].progress).toBe(100);
      expect(result.execution!.nodes[1].status).toBe('running');
      expect(result.execution!.nodes[1].progress).toBe(50);
    });

    it('should return null execution when execution_id exists but execution deleted', async () => {
      mockPrisma.webhook_call_records.findUnique.mockResolvedValue(
        makeCallRecordRow({ id: 'cr-3', status: 'success', execution_id: 'exec-gone' })
      );
      mockPrisma.workflow_executions.findUnique.mockResolvedValue(null);

      const result = await webhookService.getCallStatus('cr-3');

      expect(result.execution).toBeNull();
    });

    it('should throw when call record not found', async () => {
      mockPrisma.webhook_call_records.findUnique.mockResolvedValue(null);

      await expect(
        webhookService.getCallStatus('cr-nonexistent')
      ).rejects.toThrow('Call record not found');
    });

    it('should include error message for failed executions', async () => {
      mockPrisma.webhook_call_records.findUnique.mockResolvedValue(
        makeCallRecordRow({
          id: 'cr-fail',
          status: 'failed',
          error_message: 'Workflow timeout exceeded',
        })
      );

      const result = await webhookService.getCallStatus('cr-fail');

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBe('Workflow timeout exceeded');
      expect(result.execution).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Redis caching for getWebhookConfig
  // --------------------------------------------------------------------------
  describe('webhook config caching', () => {
    it('should return cached config on cache hit', async () => {
      const cachedConfig = {
        id: 'uuid-1',
        webhookId: 'wh_cached',
        organizationId: 'org-1',
        workflowId: 'wf-1',
        name: 'Cached',
        isEnabled: true,
        timeoutSeconds: 30,
        secretHash: null,
        allowedIps: [],
      };
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedConfig));

      // Trigger uses getWebhookConfig internally
      mockPrisma.webhook_call_records.create.mockResolvedValue(
        makeCallRecordRow({ id: 'cr-cached' })
      );
      mockWorkflowRepository.findById.mockResolvedValue({
        id: 'wf-1',
        nodes: [],
        connections: [],
      });
      mockWorkflowExecutionService.initializeWorkflowExecution.mockResolvedValue('exec-1');
      mockPrisma.webhook_call_records.update.mockResolvedValue({});

      const result = await webhookService.triggerWebhook('wh_cached', {});

      expect(result.received).toBe(true);
      // DB should NOT have been queried for webhook config
      expect(mockPrisma.webhooks.findFirst).not.toHaveBeenCalled();
    });

    it('should query DB and cache on cache miss', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockPrisma.webhooks.findFirst.mockResolvedValue(makeWebhookRow());
      mockPrisma.webhook_call_records.create.mockResolvedValue(
        makeCallRecordRow({ id: 'cr-miss' })
      );
      mockWorkflowRepository.findById.mockResolvedValue({
        id: 'wf-1',
        nodes: [],
        connections: [],
      });
      mockWorkflowExecutionService.initializeWorkflowExecution.mockResolvedValue('exec-1');
      mockPrisma.webhook_call_records.update.mockResolvedValue({});

      await webhookService.triggerWebhook('wh_abc123def456abc1', {});

      expect(mockPrisma.webhooks.findFirst).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'webhook:wh_abc123def456abc1',
        expect.any(String),
        300000,
      );
    });
  });

  // --------------------------------------------------------------------------
  // deleteWebhook
  // --------------------------------------------------------------------------
  describe('deleteWebhook', () => {
    it('should soft-delete and disable webhook', async () => {
      mockPrisma.webhooks.findFirst.mockResolvedValue(makeWebhookRow());
      mockPrisma.webhooks.update.mockResolvedValue({});
      mockRedisService.delete.mockResolvedValue(true);

      await webhookService.deleteWebhook('wh_abc123def456abc1', 'org-1');

      const updateCall = mockPrisma.webhooks.update.mock.calls[0][0];
      expect(updateCall.data.deleted_at).toBeInstanceOf(Date);
      expect(updateCall.data.is_enabled).toBe(false);
      expect(mockRedisService.delete).toHaveBeenCalledWith('webhook:wh_abc123def456abc1');
    });

    it('should throw when webhook not found', async () => {
      mockPrisma.webhooks.findFirst.mockResolvedValue(null);

      await expect(
        webhookService.deleteWebhook('wh_nonexistent', 'org-1')
      ).rejects.toThrow('Webhook not found');
    });
  });
});
