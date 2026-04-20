/**
 * Data Connector Repository
 * Data access layer for connector entities and scope bindings.
 */

import { prisma } from '../config/database.js';

export interface DataConnectorEntity {
  id: string;
  organization_id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  connector_type: string;
  credential_id: string;
  gateway_target_id: string | null;
  gateway_target_arn: string | null;
  identity_provider_arn: string | null;
  config: Record<string, unknown>;
  template_id: string | null;
  status: string;
  last_health_check: Date | null;
  health_message: string | null;
  error_count: number;
  usage_count: number;
  last_used_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ScopeDataConnectorEntity {
  id: string;
  business_scope_id: string;
  connector_id: string;
  assigned_at: Date;
  assigned_by: string | null;
  scope_config: Record<string, unknown> | null;
}

class DataConnectorRepository {
  // ── Connector CRUD ──

  async findAll(organizationId: string, filter?: { connector_type?: string; status?: string }): Promise<DataConnectorEntity[]> {
    return prisma.data_connectors.findMany({
      where: {
        organization_id: organizationId,
        ...(filter?.connector_type ? { connector_type: filter.connector_type } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: { created_at: 'desc' },
    }) as unknown as DataConnectorEntity[];
  }

  async findById(id: string, organizationId: string): Promise<DataConnectorEntity | null> {
    return prisma.data_connectors.findFirst({
      where: { id, organization_id: organizationId },
    }) as unknown as DataConnectorEntity | null;
  }

  async findByName(organizationId: string, name: string): Promise<DataConnectorEntity | null> {
    return prisma.data_connectors.findFirst({
      where: { organization_id: organizationId, name },
    }) as unknown as DataConnectorEntity | null;
  }

  async create(
    data: Omit<DataConnectorEntity, 'id' | 'organization_id' | 'created_at' | 'updated_at'>,
    organizationId: string,
  ): Promise<DataConnectorEntity> {
    return prisma.data_connectors.create({
      data: { ...data, organization_id: organizationId } as any,
    }) as unknown as DataConnectorEntity;
  }

  async update(
    id: string,
    organizationId: string,
    data: Partial<DataConnectorEntity>,
  ): Promise<DataConnectorEntity | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;
    return prisma.data_connectors.update({
      where: { id },
      data: data as any,
    }) as unknown as DataConnectorEntity;
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.findById(id, organizationId);
    if (!existing) return false;
    await prisma.data_connectors.delete({ where: { id } });
    return true;
  }

  async incrementUsage(id: string): Promise<void> {
    await prisma.data_connectors.update({
      where: { id },
      data: { usage_count: { increment: 1 }, last_used_at: new Date() },
    });
  }

  // ── Scope bindings ──

  async findScopeConnectors(businessScopeId: string): Promise<(ScopeDataConnectorEntity & { connector: DataConnectorEntity })[]> {
    const rows = await prisma.scope_data_connectors.findMany({
      where: { business_scope_id: businessScopeId },
      include: { connector: true },
      orderBy: { assigned_at: 'desc' },
    });
    return rows as unknown as (ScopeDataConnectorEntity & { connector: DataConnectorEntity })[];
  }

  async bindToScope(
    businessScopeId: string,
    connectorId: string,
    assignedBy?: string,
    scopeConfig?: Record<string, unknown> | null,
  ): Promise<ScopeDataConnectorEntity> {
    return prisma.scope_data_connectors.create({
      data: {
        business_scope_id: businessScopeId,
        connector_id: connectorId,
        assigned_by: assignedBy ?? null,
        scope_config: (scopeConfig ?? undefined) as any,
      },
    }) as unknown as ScopeDataConnectorEntity;
  }

  async unbindFromScope(businessScopeId: string, connectorId: string): Promise<boolean> {
    try {
      await prisma.scope_data_connectors.delete({
        where: { unique_scope_connector: { business_scope_id: businessScopeId, connector_id: connectorId } },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const dataConnectorRepository = new DataConnectorRepository();
