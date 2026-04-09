/**
 * REST API Key Service
 * 
 * Client for API key management endpoints.
 */

import { restClient } from './restClient';

// ============================================================================
// Types
// ============================================================================

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerMinute: number;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes?: string[];
  rateLimitPerMinute?: number;
  expiresAt?: string;
}

export interface CreateApiKeyResponse {
  apiKey: string; // Full key - only shown once!
  data: ApiKey;
}

export interface ListApiKeysResponse {
  data: ApiKey[];
}

// ============================================================================
// Service
// ============================================================================

export const RestApiKeyService = {
  /**
   * List all API keys for the organization
   */
  async listApiKeys(): Promise<ApiKey[]> {
    const response = await restClient.get<ListApiKeysResponse>('/api/api-keys');
    return response.data;
  },

  /**
   * Create a new API key
   */
  async createApiKey(data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
    return restClient.post<CreateApiKeyResponse>('/api/api-keys', data);
  },

  /**
   * Revoke an API key (soft disable)
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await restClient.post(`/api/api-keys/${keyId}/revoke`);
  },

  /**
   * Delete an API key permanently
   */
  async deleteApiKey(keyId: string): Promise<void> {
    await restClient.delete(`/api/api-keys/${keyId}`);
  },
};

export default RestApiKeyService;
