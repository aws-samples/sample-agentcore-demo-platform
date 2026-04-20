/**
 * Credential Vault Service
 *
 * Handles encrypted credential storage using KMS envelope encryption.
 * Credentials are encrypted at rest and only decrypted when needed
 * for Gateway provisioning or Token Vault sync.
 */

import crypto from 'crypto';
import { credentialVaultRepository, type CredentialVaultEntity } from '../repositories/credential-vault.repository.js';
import { connectorAuditRepository } from '../repositories/connector-audit.repository.js';
import { AppError } from '../middleware/errorHandler.js';
import type { CreateCredentialInput, UpdateCredentialInput } from '../schemas/connector.schema.js';

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

/**
 * In production, these would call AWS KMS GenerateDataKey / Decrypt.
 * For now we use a local AES key derived from an env var so the module
 * is functional without KMS infrastructure.
 */

function getDerivedKey(): Buffer {
  const secret = process.env.CONNECTOR_ENCRYPTION_KEY ?? 'super-agent-connector-dev-key-change-in-prod';
  return crypto.scryptSync(secret, 'salt', 32);
}

function encrypt(plaintext: string): { encryptedData: string; encryptedDek: string } {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedData: Buffer.concat([iv, authTag, encrypted]).toString('base64'),
    encryptedDek: '', // placeholder — real impl stores KMS-encrypted DEK
  };
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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CredentialVaultService {
  async list(organizationId: string): Promise<Omit<CredentialVaultEntity, 'encrypted_data' | 'encrypted_dek' | 'refresh_token_enc'>[]> {
    const rows = await credentialVaultRepository.findAll(organizationId);
    return rows.map(({ encrypted_data, encrypted_dek, refresh_token_enc, ...rest }) => rest);
  }

  async getById(id: string, organizationId: string) {
    const row = await credentialVaultRepository.findById(id, organizationId);
    if (!row) throw AppError.notFound(`Credential ${id} not found`);
    const { encrypted_data, encrypted_dek, refresh_token_enc, ...safe } = row;
    return safe;
  }

  async create(organizationId: string, input: CreateCredentialInput, createdBy?: string): Promise<CredentialVaultEntity> {
    // Check duplicate name
    const existing = await credentialVaultRepository.findByName(organizationId, input.name);
    if (existing) throw AppError.conflict(`Credential "${input.name}" already exists`);

    const { encryptedData, encryptedDek } = encrypt(JSON.stringify(input.credential_data));

    const entity = await credentialVaultRepository.create({
      name: input.name,
      description: input.description ?? null,
      auth_type: input.auth_type,
      encrypted_data: encryptedData,
      kms_key_arn: null,
      encrypted_dek: encryptedDek || null,
      oauth_provider: input.oauth_provider ?? null,
      oauth_scopes: input.oauth_scopes ?? [],
      token_expires_at: null,
      refresh_token_enc: null,
      status: 'active',
      last_verified_at: null,
      expires_at: null,
      created_by: createdBy ?? null,
    }, organizationId);

    await connectorAuditRepository.log(organizationId, {
      credential_id: entity.id,
      connector_id: null,
      action: 'credential_created',
      actor_id: createdBy ?? null,
      actor_type: 'user',
      details: { auth_type: input.auth_type },
      ip_address: null,
    });

    return entity;
  }

  async update(id: string, organizationId: string, input: UpdateCredentialInput): Promise<CredentialVaultEntity> {
    const existing = await credentialVaultRepository.findById(id, organizationId);
    if (!existing) throw AppError.notFound(`Credential ${id} not found`);

    const updateData: Partial<CredentialVaultEntity> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description ?? null;
    if (input.credential_data) {
      const { encryptedData, encryptedDek } = encrypt(JSON.stringify(input.credential_data));
      updateData.encrypted_data = encryptedData;
      updateData.encrypted_dek = encryptedDek || null;
    }

    const updated = await credentialVaultRepository.update(id, organizationId, updateData);
    if (!updated) throw AppError.notFound(`Credential ${id} not found`);

    await connectorAuditRepository.log(organizationId, {
      credential_id: id,
      connector_id: null,
      action: 'credential_updated',
      actor_id: null,
      actor_type: 'user',
      details: { fields: Object.keys(input) },
      ip_address: null,
    });

    return updated;
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const deleted = await credentialVaultRepository.delete(id, organizationId);
    if (!deleted) throw AppError.notFound(`Credential ${id} not found`);

    await connectorAuditRepository.log(organizationId, {
      credential_id: id,
      connector_id: null,
      action: 'credential_deleted',
      actor_id: null,
      actor_type: 'user',
      details: {},
      ip_address: null,
    });

    return true;
  }

  /** Decrypt credential data (internal use only — never expose via API) */
  async decryptCredential(id: string, organizationId: string): Promise<Record<string, unknown>> {
    const row = await credentialVaultRepository.findById(id, organizationId);
    if (!row) throw AppError.notFound(`Credential ${id} not found`);

    await connectorAuditRepository.log(organizationId, {
      credential_id: id,
      connector_id: null,
      action: 'credential_accessed',
      actor_id: null,
      actor_type: 'system',
      details: { purpose: 'decrypt' },
      ip_address: null,
    });

    return JSON.parse(decrypt(row.encrypted_data));
  }

  async verify(id: string, organizationId: string): Promise<{ valid: boolean; message?: string }> {
    const row = await credentialVaultRepository.findById(id, organizationId);
    if (!row) throw AppError.notFound(`Credential ${id} not found`);

    // Basic verification: can we decrypt it?
    try {
      decrypt(row.encrypted_data);
      await credentialVaultRepository.update(id, organizationId, {
        status: 'active',
        last_verified_at: new Date(),
      } as Partial<CredentialVaultEntity>);
      return { valid: true };
    } catch (err) {
      await credentialVaultRepository.updateStatus(id, organizationId, 'error');
      return { valid: false, message: err instanceof Error ? err.message : 'Decryption failed' };
    }
  }
}

export const credentialVaultService = new CredentialVaultService();
