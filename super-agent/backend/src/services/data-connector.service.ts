/**
 * Data Connector Service
 *
 * Business logic for connector CRUD, scope binding, health checks,
 * and audit logging. Gateway provisioning is delegated to
 * ConnectorProvisionerService (future).
 */

import { dataConnectorRepository, type DataConnectorEntity, type ScopeDataConnectorEntity } from '../repositories/data-connector.repository.js';
import { credentialVaultRepository } from '../repositories/credential-vault.repository.js';
import { connectorAuditRepository } from '../repositories/connector-audit.repository.js';
import { AppError } from '../middleware/errorHandler.js';
import type { CreateConnectorInput, UpdateConnectorInput, ConnectorFilter, BindConnectorToScopeInput } from '../schemas/connector.schema.js';

export class DataConnectorService {
  // ── Connector CRUD ──

  async list(organizationId: string, filter?: ConnectorFilter): Promise<DataConnectorEntity[]> {
    return dataConnectorRepository.findAll(organizationId, filter);
  }

  async getById(id: string, organizationId: string): Promise<DataConnectorEntity> {
    const row = await dataConnectorRepository.findById(id, organizationId);
    if (!row) throw AppError.notFound(`Connector ${id} not found`);
    return row;
  }

  async create(organizationId: string, input: CreateConnectorInput, createdBy?: string): Promise<DataConnectorEntity> {
    // Validate credential exists
    const cred = await credentialVaultRepository.findById(input.credential_id, organizationId);
    if (!cred) throw AppError.notFound(`Credential ${input.credential_id} not found`);

    // Check duplicate name
    const existing = await dataConnectorRepository.findByName(organizationId, input.name);
    if (existing) throw AppError.conflict(`Connector "${input.name}" already exists`);

    const entity = await dataConnectorRepository.create({
      name: input.name,
      display_name: input.display_name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      connector_type: input.connector_type,
      credential_id: input.credential_id,
      gateway_target_id: null,
      gateway_target_arn: null,
      identity_provider_arn: null,
      config: input.config ?? {},
      template_id: input.template_id ?? null,
      status: 'configured',
      last_health_check: null,
      health_message: null,
      error_count: 0,
      usage_count: 0,
      last_used_at: null,
      created_by: createdBy ?? null,
    }, organizationId);

    await connectorAuditRepository.log(organizationId, {
      connector_id: entity.id,
      credential_id: input.credential_id,
      action: 'connector_created',
      actor_id: createdBy ?? null,
      actor_type: 'user',
      details: { connector_type: input.connector_type, template_id: input.template_id },
      ip_address: null,
    });

    return entity;
  }

  async update(id: string, organizationId: string, input: UpdateConnectorInput): Promise<DataConnectorEntity> {
    const existing = await dataConnectorRepository.findById(id, organizationId);
    if (!existing) throw AppError.notFound(`Connector ${id} not found`);

    const updateData: Partial<DataConnectorEntity> = {};
    if (input.display_name !== undefined) updateData.display_name = input.display_name;
    if (input.description !== undefined) updateData.description = input.description ?? null;
    if (input.icon !== undefined) updateData.icon = input.icon ?? null;
    if (input.config !== undefined) updateData.config = input.config;
    if (input.status !== undefined) updateData.status = input.status;

    const updated = await dataConnectorRepository.update(id, organizationId, updateData);
    if (!updated) throw AppError.notFound(`Connector ${id} not found`);

    await connectorAuditRepository.log(organizationId, {
      connector_id: id,
      credential_id: null,
      action: 'connector_updated',
      actor_id: null,
      actor_type: 'user',
      details: { fields: Object.keys(input) },
      ip_address: null,
    });

    return updated;
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const deleted = await dataConnectorRepository.delete(id, organizationId);
    if (!deleted) throw AppError.notFound(`Connector ${id} not found`);

    await connectorAuditRepository.log(organizationId, {
      connector_id: id,
      credential_id: null,
      action: 'connector_deleted',
      actor_id: null,
      actor_type: 'user',
      details: {},
      ip_address: null,
    });

    return true;
  }

  // ── Scope bindings ──

  async getScopeConnectors(businessScopeId: string): Promise<(ScopeDataConnectorEntity & { connector: DataConnectorEntity })[]> {
    return dataConnectorRepository.findScopeConnectors(businessScopeId);
  }

  async bindToScope(organizationId: string, businessScopeId: string, input: BindConnectorToScopeInput, assignedBy?: string): Promise<ScopeDataConnectorEntity> {
    // Verify connector belongs to this org
    const connector = await dataConnectorRepository.findById(input.connector_id, organizationId);
    if (!connector) throw AppError.notFound(`Connector ${input.connector_id} not found`);

    const binding = await dataConnectorRepository.bindToScope(
      businessScopeId, input.connector_id, assignedBy, input.scope_config,
    );

    await connectorAuditRepository.log(organizationId, {
      connector_id: input.connector_id,
      credential_id: null,
      action: 'connector_bound_to_scope',
      actor_id: assignedBy ?? null,
      actor_type: 'user',
      details: { business_scope_id: businessScopeId },
      ip_address: null,
    });

    return binding;
  }

  async unbindFromScope(organizationId: string, businessScopeId: string, connectorId: string): Promise<boolean> {
    const result = await dataConnectorRepository.unbindFromScope(businessScopeId, connectorId);
    if (!result) throw AppError.notFound('Scope-connector binding not found');

    await connectorAuditRepository.log(organizationId, {
      connector_id: connectorId,
      credential_id: null,
      action: 'connector_unbound_from_scope',
      actor_id: null,
      actor_type: 'user',
      details: { business_scope_id: businessScopeId },
      ip_address: null,
    });

    return true;
  }

  // ── Health & stats ──

  async testConnection(id: string, organizationId: string): Promise<{ success: boolean; message?: string }> {
    const connector = await this.getById(id, organizationId);

    // TODO: Implement actual Gateway health check via MCP list_tools call
    // For now, verify the credential is valid
    const cred = await credentialVaultRepository.findById(connector.credential_id, organizationId);
    if (!cred || cred.status !== 'active') {
      await dataConnectorRepository.update(id, organizationId, {
        status: 'error',
        health_message: 'Credential is not active',
        last_health_check: new Date(),
        error_count: connector.error_count + 1,
      } as Partial<DataConnectorEntity>);
      return { success: false, message: 'Credential is not active' };
    }

    await dataConnectorRepository.update(id, organizationId, {
      status: 'connected',
      health_message: null,
      last_health_check: new Date(),
      error_count: 0,
    } as Partial<DataConnectorEntity>);

    await connectorAuditRepository.log(organizationId, {
      connector_id: id,
      credential_id: connector.credential_id,
      action: 'health_check',
      actor_id: null,
      actor_type: 'system',
      details: { result: 'success' },
      ip_address: null,
    });

    return { success: true };
  }

  async getAuditLog(organizationId: string, connectorId: string, limit = 50) {
    return connectorAuditRepository.findByConnector(organizationId, connectorId, limit);
  }
}

export const dataConnectorService = new DataConnectorService();
