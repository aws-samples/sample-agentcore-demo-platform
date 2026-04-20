/**
 * Connector Audit Log Repository
 */

import { prisma } from '../config/database.js';

export interface ConnectorAuditEntity {
  id: string;
  organization_id: string;
  connector_id: string | null;
  credential_id: string | null;
  action: string;
  actor_id: string | null;
  actor_type: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: Date;
}

class ConnectorAuditRepository {
  async log(
    organizationId: string,
    entry: Omit<ConnectorAuditEntity, 'id' | 'organization_id' | 'created_at'>,
  ): Promise<void> {
    await prisma.connector_audit_log.create({
      data: { ...entry, organization_id: organizationId } as any,
    });
  }

  async findByConnector(
    organizationId: string,
    connectorId: string,
    limit = 50,
  ): Promise<ConnectorAuditEntity[]> {
    return prisma.connector_audit_log.findMany({
      where: { organization_id: organizationId, connector_id: connectorId },
      orderBy: { created_at: 'desc' },
      take: limit,
    }) as unknown as ConnectorAuditEntity[];
  }

  async findByCredential(
    organizationId: string,
    credentialId: string,
    limit = 50,
  ): Promise<ConnectorAuditEntity[]> {
    return prisma.connector_audit_log.findMany({
      where: { organization_id: organizationId, credential_id: credentialId },
      orderBy: { created_at: 'desc' },
      take: limit,
    }) as unknown as ConnectorAuditEntity[];
  }
}

export const connectorAuditRepository = new ConnectorAuditRepository();
