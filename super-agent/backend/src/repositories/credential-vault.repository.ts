/**
 * Credential Vault Repository
 * Data access layer for encrypted credential storage.
 */

import { prisma } from '../config/database.js';

export interface CredentialVaultEntity {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  auth_type: string;
  encrypted_data: string;
  kms_key_arn: string | null;
  encrypted_dek: string | null;
  oauth_provider: string | null;
  oauth_scopes: string[];
  token_expires_at: Date | null;
  refresh_token_enc: string | null;
  status: string;
  last_verified_at: Date | null;
  expires_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

class CredentialVaultRepository {
  async findAll(organizationId: string): Promise<CredentialVaultEntity[]> {
    return prisma.credential_vault.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    }) as unknown as CredentialVaultEntity[];
  }

  async findById(id: string, organizationId: string): Promise<CredentialVaultEntity | null> {
    return prisma.credential_vault.findFirst({
      where: { id, organization_id: organizationId },
    }) as unknown as CredentialVaultEntity | null;
  }

  async findByName(organizationId: string, name: string): Promise<CredentialVaultEntity | null> {
    return prisma.credential_vault.findFirst({
      where: { organization_id: organizationId, name },
    }) as unknown as CredentialVaultEntity | null;
  }

  async create(
    data: Omit<CredentialVaultEntity, 'id' | 'organization_id' | 'created_at' | 'updated_at'>,
    organizationId: string,
  ): Promise<CredentialVaultEntity> {
    return prisma.credential_vault.create({
      data: { ...data, organization_id: organizationId },
    }) as unknown as CredentialVaultEntity;
  }

  async update(
    id: string,
    organizationId: string,
    data: Partial<CredentialVaultEntity>,
  ): Promise<CredentialVaultEntity | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;
    return prisma.credential_vault.update({
      where: { id },
      data,
    }) as unknown as CredentialVaultEntity;
  }

  async updateStatus(id: string, organizationId: string, status: string): Promise<void> {
    await this.update(id, organizationId, { status } as Partial<CredentialVaultEntity>);
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.findById(id, organizationId);
    if (!existing) return false;
    await prisma.credential_vault.delete({ where: { id } });
    return true;
  }

  async findExpiringSoon(withinMs: number): Promise<CredentialVaultEntity[]> {
    const threshold = new Date(Date.now() + withinMs);
    return prisma.credential_vault.findMany({
      where: {
        auth_type: 'oauth2',
        status: 'active',
        token_expires_at: { lte: threshold },
      },
    }) as unknown as CredentialVaultEntity[];
  }
}

export const credentialVaultRepository = new CredentialVaultRepository();
