/**
 * Data Connector Service
 *
 * API client for the Data Connector module.
 * Handles credentials, connectors, and scope bindings.
 */

import { restClient } from '@/services/api/restClient'

const BASE = '/api/data-connectors'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Credential {
  id: string
  organization_id: string
  name: string
  description: string | null
  auth_type: string
  oauth_provider: string | null
  oauth_scopes: string[]
  status: string
  last_verified_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateCredentialInput {
  name: string
  description?: string | null
  auth_type: string
  credential_data: Record<string, unknown>
  oauth_provider?: string | null
  oauth_scopes?: string[]
}

export interface Connector {
  id: string
  organization_id: string
  name: string
  display_name: string
  description: string | null
  icon: string | null
  connector_type: string
  credential_id: string
  gateway_target_id: string | null
  gateway_target_arn: string | null
  config: Record<string, unknown>
  template_id: string | null
  status: string
  last_health_check: string | null
  health_message: string | null
  error_count: number
  usage_count: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateConnectorInput {
  name: string
  display_name: string
  description?: string | null
  icon?: string | null
  connector_type: string
  credential_id: string
  config?: Record<string, unknown>
  template_id?: string | null
}

export interface ScopeConnectorBinding {
  id: string
  business_scope_id: string
  connector_id: string
  assigned_at: string
  scope_config: Record<string, unknown> | null
  connector: Connector
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const connectorService = {
  // Credentials
  listCredentials: () =>
    restClient.get<{ data: Credential[] }>(`${BASE}/credentials`).then(r => r.data),

  getCredential: (id: string) =>
    restClient.get<Credential>(`${BASE}/credentials/${id}`),

  createCredential: (input: CreateCredentialInput) =>
    restClient.post<Credential>(`${BASE}/credentials`, input),

  updateCredential: (id: string, input: Partial<CreateCredentialInput>) =>
    restClient.put<Credential>(`${BASE}/credentials/${id}`, input),

  deleteCredential: (id: string) =>
    restClient.delete(`${BASE}/credentials/${id}`),

  verifyCredential: (id: string) =>
    restClient.post<{ valid: boolean; message?: string }>(`${BASE}/credentials/${id}/verify`),

  // Connectors
  listConnectors: (filter?: { connector_type?: string; status?: string }) => {
    const params = new URLSearchParams()
    if (filter?.connector_type) params.set('connector_type', filter.connector_type)
    if (filter?.status) params.set('status', filter.status)
    const qs = params.toString()
    return restClient.get<{ data: Connector[] }>(`${BASE}/connectors${qs ? `?${qs}` : ''}`).then(r => r.data)
  },

  getConnector: (id: string) =>
    restClient.get<Connector>(`${BASE}/connectors/${id}`),

  createConnector: (input: CreateConnectorInput) =>
    restClient.post<Connector>(`${BASE}/connectors`, input),

  updateConnector: (id: string, input: Partial<CreateConnectorInput>) =>
    restClient.put<Connector>(`${BASE}/connectors/${id}`, input),

  deleteConnector: (id: string) =>
    restClient.delete(`${BASE}/connectors/${id}`),

  testConnector: (id: string) =>
    restClient.post<{ success: boolean; message?: string }>(`${BASE}/connectors/${id}/test`),

  getAuditLog: (id: string) =>
    restClient.get<{ data: any[] }>(`${BASE}/connectors/${id}/audit-log`).then(r => r.data),

  // Scope bindings
  listScopeConnectors: (scopeId: string) =>
    restClient.get<{ data: ScopeConnectorBinding[] }>(`${BASE}/scopes/${scopeId}/connectors`).then(r => r.data),

  bindToScope: (scopeId: string, connectorId: string, scopeConfig?: Record<string, unknown>) =>
    restClient.post(`${BASE}/scopes/${scopeId}/connectors`, { connector_id: connectorId, scope_config: scopeConfig }),

  unbindFromScope: (scopeId: string, connectorId: string) =>
    restClient.delete(`${BASE}/scopes/${scopeId}/connectors/${connectorId}`),

  // Connector templates (loaded from connector-packages)
  listTemplates: () =>
    restClient.get<{ data: any[] }>(`${BASE}/templates`).then(r => r.data),

  getTemplate: (id: string) =>
    restClient.get<{ manifest: any; setup_guide: string; tools: any }>(`${BASE}/templates/${id}`),

  // OAuth
  getOAuthAuthorizeUrl: (provider: string) =>
    restClient.get<{ authorize_url: string }>(`${BASE}/oauth/${provider}/authorize`),

  getOAuthProviderConfig: (provider: string) =>
    restClient.get<{ configured: boolean; data: any }>(`${BASE}/oauth/providers/${provider}`),

  saveOAuthProviderConfig: (provider: string, clientId: string, clientSecret: string) =>
    restClient.put(`${BASE}/oauth/providers/${provider}`, { client_id: clientId, client_secret: clientSecret }),
}
