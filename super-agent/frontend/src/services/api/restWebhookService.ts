/**
 * REST Webhook Service
 * 
 * Client for webhook management endpoints.
 */

import { restClient } from './restClient';
import type { ScheduleExecutionLog } from './restScheduleService';

// ============================================================================
// Types
// ============================================================================

export interface Webhook {
  id: string;
  webhookId: string;
  name: string | null;
  isEnabled: boolean;
  timeoutSeconds: number;
  allowedIps: string[];
  webhookUrl: string;
}

export interface WebhookCallRecord {
  id: string;
  webhookId: string;
  executionId: string | null;
  status: string;
  responseTimeMs: number | null;
  errorMessage: string | null;
  logs: ScheduleExecutionLog[];
  createdAt: string;
}

export interface CreateWebhookRequest {
  name?: string;
  timeoutSeconds?: number;
  generateSecret?: boolean;
  allowedIps?: string[];
}

export interface CreateWebhookResponse {
  webhook: Webhook;
  secret?: string; // Only shown once if generated
  webhookUrl: string;
}

export interface UpdateWebhookRequest {
  name?: string;
  isEnabled?: boolean;
  timeoutSeconds?: number;
  allowedIps?: string[];
}

export interface ListWebhooksResponse {
  data: Webhook[];
}

export interface WebhookHistoryResponse {
  data: WebhookCallRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Service
// ============================================================================

export const RestWebhookService = {
  /**
   * List webhooks for a workflow
   */
  async listWebhooks(workflowId: string): Promise<Webhook[]> {
    const response = await restClient.get<ListWebhooksResponse>(
      `/api/workflows/${workflowId}/webhooks`
    );
    return response.data;
  },

  /**
   * Create a webhook for a workflow
   */
  async createWebhook(
    workflowId: string,
    data: CreateWebhookRequest = {}
  ): Promise<CreateWebhookResponse> {
    return restClient.post<CreateWebhookResponse>(
      `/api/workflows/${workflowId}/webhooks`,
      data
    );
  },

  /**
   * Update a webhook
   */
  async updateWebhook(webhookId: string, data: UpdateWebhookRequest): Promise<Webhook> {
    const response = await restClient.patch<{ data: Webhook }>(
      `/api/webhooks/${webhookId}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await restClient.delete(`/api/webhooks/${webhookId}`);
  },

  /**
   * Get webhook call history
   */
  async getCallHistory(
    webhookId: string,
    page = 1,
    limit = 20
  ): Promise<WebhookHistoryResponse> {
    return restClient.get<WebhookHistoryResponse>(
      `/api/webhooks/${webhookId}/history?page=${page}&limit=${limit}`
    );
  },
};

export default RestWebhookService;
