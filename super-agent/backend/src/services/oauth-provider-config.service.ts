/**
 * OAuth Provider Config Service
 *
 * Manages per-org OAuth app credentials (Client ID / Secret).
 * These are configured by org admins via the UI, not via .env files.
 * The client_secret is encrypted at rest using the same mechanism as credential_vault.
 */

import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

// Reuse the same encryption from credential-vault.service
function getDerivedKey(): Buffer {
  const secret = process.env.CONNECTOR_ENCRYPTION_KEY ?? 'super-agent-connector-dev-key-change-in-prod';
  return crypto.scryptSync(secret, 'salt', 32);
}

function encrypt(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(encryptedData: string): string {
  const key = getDerivedKey();
  const raw = Buffer.from(encryptedData, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export interface OAuthProviderConfig {
  id: string;
  provider: string;
  client_id: string;
  scopes: string[];
  created_at: Date;
  updated_at: Date;
}

export class OAuthProviderConfigService {

  /** Get provider config (without decrypted secret) */
  async get(organizationId: string, provider: string): Promise<OAuthProviderConfig | null> {
    const row = await prisma.connector_oauth_providers.findFirst({
      where: { organization_id: organizationId, provider },
    });
    if (!row) return null;
    return {
      id: row.id,
      provider: row.provider,
      client_id: row.client_id,
      scopes: row.scopes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /** Get provider config with decrypted secret (internal use only) */
  async getWithSecret(organizationId: string, provider: string): Promise<{ clientId: string; clientSecret: string; scopes: string[] } | null> {
    const row = await prisma.connector_oauth_providers.findFirst({
      where: { organization_id: organizationId, provider },
    });
    if (!row) return null;
    return {
      clientId: row.client_id,
      clientSecret: decrypt(row.client_secret_enc),
      scopes: row.scopes,
    };
  }

  /** List all configured providers for an org */
  async list(organizationId: string): Promise<OAuthProviderConfig[]> {
    const rows = await prisma.connector_oauth_providers.findMany({
      where: { organization_id: organizationId },
      orderBy: { provider: 'asc' },
    });
    return rows.map(r => ({
      id: r.id,
      provider: r.provider,
      client_id: r.client_id,
      scopes: r.scopes,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  /** Create or update provider config */
  async upsert(
    organizationId: string,
    provider: string,
    clientId: string,
    clientSecret: string,
    createdBy?: string,
  ): Promise<OAuthProviderConfig> {
    const encryptedSecret = encrypt(clientSecret);

    const row = await prisma.connector_oauth_providers.upsert({
      where: { unique_oauth_provider_per_org: { organization_id: organizationId, provider } },
      create: {
        organization_id: organizationId,
        provider,
        client_id: clientId,
        client_secret_enc: encryptedSecret,
        scopes: this.getDefaultScopes(provider),
        created_by: createdBy ?? null,
      },
      update: {
        client_id: clientId,
        client_secret_enc: encryptedSecret,
      },
    });

    return {
      id: row.id,
      provider: row.provider,
      client_id: row.client_id,
      scopes: row.scopes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async delete(organizationId: string, provider: string): Promise<boolean> {
    try {
      await prisma.connector_oauth_providers.delete({
        where: { unique_oauth_provider_per_org: { organization_id: organizationId, provider } },
      });
      return true;
    } catch { return false; }
  }

  private getDefaultScopes(provider: string): string[] {
    switch (provider) {
      case 'google': return [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
      ];
      case 'salesforce': return ['api', 'refresh_token'];
      default: return [];
    }
  }
}

export const oauthProviderConfigService = new OAuthProviderConfigService();
