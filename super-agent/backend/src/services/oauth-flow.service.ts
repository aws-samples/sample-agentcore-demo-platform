/**
 * OAuth Flow Service
 *
 * Handles OAuth 2.0 Authorization Code flow for data connectors.
 * Supports Google (Gmail, Maps, BigQuery) and Salesforce.
 *
 * Flow:
 *   1. Frontend calls GET /api/data-connectors/oauth/:provider/authorize
 *   2. Backend generates state, stores in Redis, returns authorize URL
 *   3. Frontend opens URL in popup
 *   4. User consents on provider's page
 *   5. Provider redirects to GET /api/data-connectors/oauth/:provider/callback
 *   6. Backend exchanges code for tokens, encrypts & stores, closes popup
 */

import crypto from 'crypto';
import { config } from '../config/index.js';
import { oauthProviderConfigService } from './oauth-provider-config.service.js';
import { AppError } from '../middleware/errorHandler.js';

// ---------------------------------------------------------------------------
// Provider configs
// ---------------------------------------------------------------------------

interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  extraParams?: Record<string, string>;
}

async function getProviderConfig(provider: string, orgId: string): Promise<OAuthProviderConfig> {
  // Read client credentials from database (configured by admin via UI)
  const dbConfig = await oauthProviderConfigService.getWithSecret(orgId, provider);

  // Fallback to env vars for backward compatibility
  const clientId = dbConfig?.clientId
    ?? (provider === 'google' ? config.connectorOAuth.google.clientId : '')
    ?? (provider === 'salesforce' ? config.connectorOAuth.salesforce.clientId : '');
  const clientSecret = dbConfig?.clientSecret
    ?? (provider === 'google' ? config.connectorOAuth.google.clientSecret : '')
    ?? (provider === 'salesforce' ? config.connectorOAuth.salesforce.clientSecret : '');

  if (!clientId || !clientSecret) {
    throw AppError.validation(
      `OAuth not configured for ${provider}. Please configure Client ID and Client Secret in the connector settings.`
    );
  }

  switch (provider) {
    case 'google':
      return {
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId, clientSecret,
        scopes: dbConfig?.scopes ?? [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
        ],
        extraParams: { access_type: 'offline', prompt: 'consent' },
      };
    case 'salesforce':
      return {
        authorizeUrl: 'https://login.salesforce.com/services/oauth2/authorize',
        tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
        clientId, clientSecret,
        scopes: dbConfig?.scopes ?? ['api', 'refresh_token'],
        extraParams: {},
      };
    default:
      throw AppError.validation(`Unsupported OAuth provider: ${provider}`);
  }
}

// ---------------------------------------------------------------------------
// In-memory state store (use Redis in production)
// ---------------------------------------------------------------------------

const pendingStates = new Map<string, { provider: string; orgId: string; userId: string; createdAt: number }>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (now - val.createdAt > 10 * 60 * 1000) pendingStates.delete(key);
  }
}, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class OAuthFlowService {

  /**
   * Generate the authorization URL for the popup.
   * Returns the URL that the frontend should open in a popup window.
   */
  async getAuthorizeUrl(provider: string, orgId: string, userId: string): Promise<string> {
    const providerConfig = await getProviderConfig(provider, orgId);

    // Generate CSRF state token
    const state = crypto.randomBytes(32).toString('hex');
    pendingStates.set(state, { provider, orgId, userId, createdAt: Date.now() });

    const redirectUri = `${config.connectorOAuth.redirectBaseUrl}/api/data-connectors/oauth/${provider}/callback`;

    const params = new URLSearchParams({
      client_id: providerConfig.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: providerConfig.scopes.join(' '),
      state,
      ...providerConfig.extraParams,
    });

    return `${providerConfig.authorizeUrl}?${params.toString()}`;
  }

  /**
   * Handle the OAuth callback — exchange code for tokens.
   * Returns the tokens (caller is responsible for encrypting & storing).
   */
  async handleCallback(
    provider: string,
    code: string,
    state: string,
  ): Promise<{
    orgId: string;
    userId: string;
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
    scope: string;
    tokenType: string;
    raw: Record<string, unknown>;
  }> {
    // Validate state
    const pending = pendingStates.get(state);
    if (!pending) throw AppError.validation('Invalid or expired OAuth state');
    if (pending.provider !== provider) throw AppError.validation('OAuth provider mismatch');
    pendingStates.delete(state);

    // Check expiry (10 min)
    if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
      throw AppError.validation('OAuth state expired');
    }

    const providerConfig = await getProviderConfig(provider, pending.orgId);
    const redirectUri = `${config.connectorOAuth.redirectBaseUrl}/api/data-connectors/oauth/${provider}/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error(`[oauth] Token exchange failed for ${provider}:`, errBody);
      throw AppError.validation(`OAuth token exchange failed: ${tokenRes.status}`);
    }

    const tokens = await tokenRes.json() as Record<string, unknown>;

    return {
      orgId: pending.orgId,
      userId: pending.userId,
      accessToken: tokens.access_token as string,
      refreshToken: (tokens.refresh_token as string) ?? null,
      expiresIn: (tokens.expires_in as number) ?? 3600,
      scope: (tokens.scope as string) ?? '',
      tokenType: (tokens.token_type as string) ?? 'Bearer',
      raw: tokens,
    };
  }

  /**
   * Refresh an OAuth access token using a refresh token.
   */
  async refreshToken(
    provider: string,
    refreshToken: string,
    orgId: string,
  ): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number }> {
    const providerConfig = await getProviderConfig(provider, orgId);

    const res = await fetch(providerConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      throw AppError.validation(`OAuth token refresh failed: ${res.status}`);
    }

    const data = await res.json() as Record<string, unknown>;

    return {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string) ?? null,
      expiresIn: (data.expires_in as number) ?? 3600,
    };
  }
}

export const oauthFlowService = new OAuthFlowService();
