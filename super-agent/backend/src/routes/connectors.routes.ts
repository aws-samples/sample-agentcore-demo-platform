/**
 * Data Connector Routes
 *
 * REST API for credentials, connectors, and scope bindings.
 * All routes require authentication and filter by organization_id.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { credentialVaultService } from '../services/credential-vault.service.js';
import { dataConnectorService } from '../services/data-connector.service.js';
import { oauthFlowService } from '../services/oauth-flow.service.js';
import { oauthProviderConfigService } from '../services/oauth-provider-config.service.js';
import { connectorRegistryService } from '../services/connector-registry.service.js';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';
import {
  createCredentialSchema, updateCredentialSchema,
  createConnectorSchema, updateConnectorSchema, connectorFilterSchema,
  bindConnectorToScopeSchema,
} from '../schemas/connector.schema.js';
import { ZodError } from 'zod';
import { AppError } from '../middleware/errorHandler.js';

function validate<T>(schema: { parse: (d: unknown) => T }, data: unknown): T {
  try { return schema.parse(data); }
  catch (e) { if (e instanceof ZodError) throw AppError.validation('Validation failed', e.issues); throw e; }
}

export async function connectorRoutes(fastify: FastifyInstance): Promise<void> {

  // ========================================================================
  // Credentials
  // ========================================================================

  fastify.get('/credentials', { preHandler: [authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const list = await credentialVaultService.list(req.user!.orgId);
      return reply.send({ data: list });
    });

  fastify.get<{ Params: { id: string } }>('/credentials/:id', { preHandler: [authenticate] },
    async (req, reply) => {
      const cred = await credentialVaultService.getById(req.params.id, req.user!.orgId);
      return reply.send(cred);
    });

  fastify.post('/credentials', { preHandler: [authenticate, requireModifyAccess] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const input = validate(createCredentialSchema, req.body);
      const cred = await credentialVaultService.create(req.user!.orgId, input, req.user!.id);
      return reply.status(201).send(cred);
    });

  fastify.put<{ Params: { id: string } }>('/credentials/:id', { preHandler: [authenticate, requireModifyAccess] },
    async (req, reply) => {
      const input = validate(updateCredentialSchema, req.body);
      const cred = await credentialVaultService.update(req.params.id, req.user!.orgId, input);
      return reply.send(cred);
    });

  fastify.delete<{ Params: { id: string } }>('/credentials/:id', { preHandler: [authenticate, requireModifyAccess] },
    async (req, reply) => {
      await credentialVaultService.delete(req.params.id, req.user!.orgId);
      return reply.status(204).send();
    });

  fastify.post<{ Params: { id: string } }>('/credentials/:id/verify', { preHandler: [authenticate] },
    async (req, reply) => {
      const result = await credentialVaultService.verify(req.params.id, req.user!.orgId);
      return reply.send(result);
    });

  // ========================================================================
  // Connectors
  // ========================================================================

  fastify.get('/connectors', { preHandler: [authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const filter = validate(connectorFilterSchema, req.query);
      const list = await dataConnectorService.list(req.user!.orgId, filter);
      return reply.send({ data: list });
    });

  fastify.get<{ Params: { id: string } }>('/connectors/:id', { preHandler: [authenticate] },
    async (req, reply) => {
      const connector = await dataConnectorService.getById(req.params.id, req.user!.orgId);
      return reply.send(connector);
    });

  fastify.post('/connectors', { preHandler: [authenticate, requireModifyAccess] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const input = validate(createConnectorSchema, req.body);
      const connector = await dataConnectorService.create(req.user!.orgId, input, req.user!.id);
      return reply.status(201).send(connector);
    });

  fastify.put<{ Params: { id: string } }>('/connectors/:id', { preHandler: [authenticate, requireModifyAccess] },
    async (req, reply) => {
      const input = validate(updateConnectorSchema, req.body);
      const connector = await dataConnectorService.update(req.params.id, req.user!.orgId, input);
      return reply.send(connector);
    });

  fastify.delete<{ Params: { id: string } }>('/connectors/:id', { preHandler: [authenticate, requireModifyAccess] },
    async (req, reply) => {
      await dataConnectorService.delete(req.params.id, req.user!.orgId);
      return reply.status(204).send();
    });

  fastify.post<{ Params: { id: string } }>('/connectors/:id/test', { preHandler: [authenticate] },
    async (req, reply) => {
      const result = await dataConnectorService.testConnection(req.params.id, req.user!.orgId);
      return reply.send(result);
    });

  fastify.get<{ Params: { id: string } }>('/connectors/:id/audit-log', { preHandler: [authenticate] },
    async (req, reply) => {
      const logs = await dataConnectorService.getAuditLog(req.user!.orgId, req.params.id);
      return reply.send({ data: logs });
    });

  // ========================================================================
  // Scope bindings
  // ========================================================================

  fastify.get<{ Params: { scopeId: string } }>('/scopes/:scopeId/connectors', { preHandler: [authenticate] },
    async (req, reply) => {
      const list = await dataConnectorService.getScopeConnectors(req.params.scopeId);
      return reply.send({ data: list });
    });

  fastify.post<{ Params: { scopeId: string } }>('/scopes/:scopeId/connectors', { preHandler: [authenticate, requireModifyAccess] },
    async (req, reply) => {
      const input = validate(bindConnectorToScopeSchema, req.body);
      const binding = await dataConnectorService.bindToScope(req.user!.orgId, req.params.scopeId, input, req.user!.id);
      return reply.status(201).send(binding);
    });

  fastify.delete<{ Params: { scopeId: string; connectorId: string } }>('/scopes/:scopeId/connectors/:connectorId', { preHandler: [authenticate, requireModifyAccess] },
    async (req, reply) => {
      await dataConnectorService.unbindFromScope(req.user!.orgId, req.params.scopeId, req.params.connectorId);
      return reply.status(204).send();
    });

  // ========================================================================
  // Connector template catalog (loaded from connector-packages/)
  // ========================================================================

  /** GET /api/data-connectors/templates — list all connector templates */
  fastify.get('/templates', { preHandler: [authenticate] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      await connectorRegistryService.loadAll();
      return reply.send({ data: connectorRegistryService.getAll() });
    });

  /** GET /api/data-connectors/templates/:id — get template detail + setup guide */
  fastify.get<{ Params: { id: string } }>('/templates/:id', { preHandler: [authenticate] },
    async (req, reply) => {
      await connectorRegistryService.loadAll();
      const pkg = connectorRegistryService.getById(req.params.id);
      if (!pkg) return reply.status(404).send({ error: 'Template not found' });
      return reply.send({
        manifest: pkg.manifest,
        setup_guide: pkg.setupGuide,
        tools: pkg.toolsDefinition,
      });
    });

  // ========================================================================
  // OAuth provider config (admin configures Client ID / Secret via UI)
  // ========================================================================

  /** GET /api/data-connectors/oauth/providers — list configured providers */
  fastify.get('/oauth/providers', { preHandler: [authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const list = await oauthProviderConfigService.list(req.user!.orgId);
      return reply.send({ data: list });
    });

  /** GET /api/data-connectors/oauth/providers/:provider — check if configured */
  fastify.get<{ Params: { provider: string } }>('/oauth/providers/:provider', { preHandler: [authenticate] },
    async (req, reply) => {
      const cfg = await oauthProviderConfigService.get(req.user!.orgId, req.params.provider);
      return reply.send({ configured: !!cfg, data: cfg });
    });

  /** PUT /api/data-connectors/oauth/providers/:provider — create or update */
  fastify.put<{ Params: { provider: string }; Body: { client_id: string; client_secret: string } }>(
    '/oauth/providers/:provider', { preHandler: [authenticate, requireModifyAccess] },
    async (req, reply) => {
      const { client_id, client_secret } = req.body as { client_id: string; client_secret: string };
      if (!client_id?.trim() || !client_secret?.trim()) {
        throw AppError.validation('client_id and client_secret are required');
      }
      const result = await oauthProviderConfigService.upsert(
        req.user!.orgId, req.params.provider, client_id.trim(), client_secret.trim(), req.user!.id,
      );
      return reply.send(result);
    });

  // ========================================================================
  // OAuth flow (popup-based)
  // ========================================================================

  /**
   * GET /api/data-connectors/oauth/:provider/authorize
   * Returns the OAuth authorization URL. Frontend opens this in a popup.
   */
  fastify.get<{ Params: { provider: string } }>('/oauth/:provider/authorize', { preHandler: [authenticate] },
    async (req, reply) => {
      const url = await oauthFlowService.getAuthorizeUrl(
        req.params.provider,
        req.user!.orgId,
        req.user!.id,
      );
      return reply.send({ authorize_url: url });
    });

  /**
   * GET /api/data-connectors/oauth/:provider/callback
   * OAuth callback — exchanges code for tokens, stores credential, closes popup.
   * This is called by the OAuth provider (Google, Salesforce), NOT by our frontend.
   * No JWT auth — the state param validates the request.
   */
  fastify.get<{ Params: { provider: string }; Querystring: { code?: string; state?: string; error?: string } }>(
    '/oauth/:provider/callback',
    async (req, reply) => {
      const { provider } = req.params;
      const { code, state, error: oauthError } = req.query;

      // Handle user denial or error
      if (oauthError || !code || !state) {
        return reply.type('text/html').send(callbackHtml(false, oauthError ?? 'Authorization was denied or failed.'));
      }

      try {
        const tokens = await oauthFlowService.handleCallback(provider, code, state);

        // Store as encrypted credential
        const credential = await credentialVaultService.create(tokens.orgId, {
          name: `${provider}-oauth-${Date.now()}`,
          auth_type: 'oauth2',
          credential_data: {
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            token_type: tokens.tokenType,
            scope: tokens.scope,
            expires_in: tokens.expiresIn,
          },
          oauth_provider: provider,
          oauth_scopes: tokens.scope.split(/[\s,]+/).filter(Boolean),
        }, tokens.userId);

        // Return HTML that posts the credential ID to the parent window and closes the popup
        return reply.type('text/html').send(callbackHtml(true, undefined, credential.id));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Token exchange failed';
        return reply.type('text/html').send(callbackHtml(false, msg));
      }
    });
}

/**
 * Generate the HTML page returned in the OAuth callback popup.
 * It posts a message to the parent window and closes itself.
 */
function callbackHtml(success: boolean, error?: string, credentialId?: string): string {
  const payload = JSON.stringify({ success, error: error ?? null, credentialId: credentialId ?? null });
  return `<!DOCTYPE html>
<html><head><title>OAuth Callback</title></head>
<body>
<p>${success ? 'Authorization successful. This window will close.' : `Error: ${error}`}</p>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'oauth-callback', payload: ${payload} }, '*');
  }
  setTimeout(() => window.close(), 1500);
</script>
</body></html>`;
}
