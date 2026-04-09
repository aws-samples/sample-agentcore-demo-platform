/**
 * REST IM Channel Service
 * Client for IM channel binding management endpoints.
 */

import { restClient } from './restClient';

export interface IMChannelBinding {
  id: string;
  organization_id: string;
  business_scope_id: string;
  channel_type: string;
  channel_id: string;
  channel_name: string | null;
  bot_token_enc: string | null; // masked as '***' in responses
  webhook_url: string | null;
  config: Record<string, unknown>;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateIMChannelRequest {
  channel_type: string;
  channel_id: string;
  channel_name?: string;
  bot_token?: string;
  webhook_url?: string;
  config?: Record<string, unknown>;
}

export interface UpdateIMChannelRequest {
  channel_name?: string;
  bot_token?: string;
  webhook_url?: string;
  config?: Record<string, unknown>;
  is_enabled?: boolean;
}

export const RestIMChannelService = {
  async list(scopeId: string): Promise<IMChannelBinding[]> {
    const res = await restClient.get<{ data: IMChannelBinding[] }>(
      `/api/business-scopes/${scopeId}/im-channels`
    );
    return res.data;
  },

  async create(scopeId: string, data: CreateIMChannelRequest): Promise<IMChannelBinding> {
    const res = await restClient.post<{ data: IMChannelBinding }>(
      `/api/business-scopes/${scopeId}/im-channels`,
      data
    );
    return res.data;
  },

  async update(scopeId: string, bindingId: string, data: UpdateIMChannelRequest): Promise<IMChannelBinding> {
    const res = await restClient.put<{ data: IMChannelBinding }>(
      `/api/business-scopes/${scopeId}/im-channels/${bindingId}`,
      data
    );
    return res.data;
  },

  async remove(scopeId: string, bindingId: string): Promise<void> {
    await restClient.delete(`/api/business-scopes/${scopeId}/im-channels/${bindingId}`);
  },
};
