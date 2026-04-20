/**
 * Zod validation schemas for Data Connector module
 */
import { z } from 'zod';
import { uuidSchema } from './common.schema.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const connectorTypeValues = ['saas', 'database', 'aws_service', 'internal_api'] as const;
export const connectorTypeSchema = z.enum(connectorTypeValues);

export const connectorStatusValues = ['configured', 'connected', 'error', 'disabled'] as const;
export const connectorStatusSchema = z.enum(connectorStatusValues);

export const authTypeValues = ['oauth2', 'api_key', 'basic', 'iam_role', 'connection_string', 'service_account'] as const;
export const authTypeSchema = z.enum(authTypeValues);

export const credentialStatusValues = ['active', 'expired', 'revoked', 'error'] as const;
export const credentialStatusSchema = z.enum(credentialStatusValues);

// ---------------------------------------------------------------------------
// Credential Vault
// ---------------------------------------------------------------------------

export const createCredentialSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  auth_type: authTypeSchema,
  /** Plain-text credential data (will be encrypted server-side) */
  credential_data: z.record(z.string(), z.unknown()),
  oauth_provider: z.string().max(100).optional().nullable(),
  oauth_scopes: z.array(z.string()).default([]),
});

export const updateCredentialSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  credential_data: z.record(z.string(), z.unknown()).optional(),
});

export const credentialFilterSchema = z.object({
  auth_type: authTypeSchema.optional(),
  status: credentialStatusSchema.optional(),
});

// ---------------------------------------------------------------------------
// Data Connector
// ---------------------------------------------------------------------------

export const createConnectorSchema = z.object({
  name: z.string().min(1).max(255),
  display_name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  icon: z.string().max(255).optional().nullable(),
  connector_type: connectorTypeSchema,
  credential_id: uuidSchema,
  config: z.record(z.string(), z.unknown()).default({}),
  template_id: z.string().max(100).optional().nullable(),
});

export const updateConnectorSchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  icon: z.string().max(255).optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: connectorStatusSchema.optional(),
});

export const connectorFilterSchema = z.object({
  connector_type: connectorTypeSchema.optional(),
  status: connectorStatusSchema.optional(),
});

// ---------------------------------------------------------------------------
// Scope binding
// ---------------------------------------------------------------------------

export const bindConnectorToScopeSchema = z.object({
  connector_id: uuidSchema,
  scope_config: z.record(z.string(), z.unknown()).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type CreateCredentialInput = z.infer<typeof createCredentialSchema>;
export type UpdateCredentialInput = z.infer<typeof updateCredentialSchema>;
export type CredentialFilter = z.infer<typeof credentialFilterSchema>;
export type CreateConnectorInput = z.infer<typeof createConnectorSchema>;
export type UpdateConnectorInput = z.infer<typeof updateConnectorSchema>;
export type ConnectorFilter = z.infer<typeof connectorFilterSchema>;
export type BindConnectorToScopeInput = z.infer<typeof bindConnectorToScopeSchema>;
