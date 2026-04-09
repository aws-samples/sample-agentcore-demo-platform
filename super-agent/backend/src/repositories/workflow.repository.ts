/**
 * Workflow Repository
 * Data access layer for Workflow entities with multi-tenancy support.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { BaseRepository, type FindAllOptions } from './base.repository.js';
import type { WorkflowFilter } from '../schemas/workflow.schema.js';

/**
 * Workflow entity type matching the Prisma schema
 */
export interface WorkflowEntity {
  id: string;
  organization_id: string;
  business_scope_id: string | null;
  name: string;
  version: string;
  is_official: boolean;
  parent_version: string | null;
  nodes: unknown[];
  connections: unknown[];
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Workflow Repository class extending BaseRepository with workflow-specific methods.
 * Provides multi-tenancy filtering for all operations.
 */
export class WorkflowRepository extends BaseRepository<WorkflowEntity> {
  constructor() {
    super('workflows');
  }

  /**
   * Find all workflows with optional filters.
   * Supports filtering by business_scope_id, is_official, and name.
   *
   * @param organizationId - The organization ID to filter by
   * @param filters - Optional filters (business_scope_id, is_official, name)
   * @param options - Optional query options (pagination, ordering)
   * @returns Array of workflows matching the criteria
   */
  async findAllWithFilters(
    organizationId: string,
    filters?: WorkflowFilter,
    options?: Omit<FindAllOptions<WorkflowEntity>, 'where'>
  ): Promise<WorkflowEntity[]> {
    const where: Partial<WorkflowEntity> = {};

    if (filters?.business_scope_id) {
      where.business_scope_id = filters.business_scope_id;
    }

    if (filters?.is_official !== undefined) {
      where.is_official = filters.is_official;
    }

    return this.findAll(organizationId, {
      ...options,
      where,
    });
  }

  /**
   * Find workflows by business scope.
   *
   * @param organizationId - The organization ID to filter by
   * @param businessScopeId - The business scope ID to filter by
   * @returns Array of workflows in the specified business scope
   */
  async findByBusinessScope(
    organizationId: string,
    businessScopeId: string
  ): Promise<WorkflowEntity[]> {
    return this.findAll(organizationId, {
      where: { business_scope_id: businessScopeId },
    });
  }

  /**
   * Find workflow by name within an organization.
   * Useful for checking uniqueness.
   *
   * @param organizationId - The organization ID to filter by
   * @param name - The workflow name to search for
   * @returns The workflow if found, null otherwise
   */
  async findByName(organizationId: string, name: string): Promise<WorkflowEntity | null> {
    return this.findFirst(organizationId, { name });
  }

  /**
   * Find workflow by name and version within an organization.
   * Useful for checking uniqueness of name+version combination.
   *
   * @param organizationId - The organization ID to filter by
   * @param name - The workflow name to search for
   * @param version - The workflow version to search for
   * @returns The workflow if found, null otherwise
   */
  async findByNameAndVersion(
    organizationId: string,
    name: string,
    version: string
  ): Promise<WorkflowEntity | null> {
    return this.findFirst(organizationId, { name, version });
  }

  /**
   * Find official workflows within an organization.
   *
   * @param organizationId - The organization ID to filter by
   * @returns Array of official workflows
   */
  async findOfficialWorkflows(organizationId: string): Promise<WorkflowEntity[]> {
    return this.findAll(organizationId, {
      where: { is_official: true },
    });
  }

  /**
   * Get workflow with business scope included.
   *
   * @param id - The workflow ID
   * @param organizationId - The organization ID to filter by
   * @returns The workflow with business scope, or null if not found
   */
  async findByIdWithBusinessScope(
    id: string,
    organizationId: string
  ): Promise<WorkflowEntity | null> {
    return this.findById(id, organizationId, {
      include: { business_scope: true },
    });
  }

  /**
   * Create a workflow with created_by field.
   *
   * @param data - The workflow data
   * @param organizationId - The organization ID
   * @param createdBy - The user ID who created the workflow
   * @returns The created workflow
   */
  async createWithUser(
    data: Omit<
      WorkflowEntity,
      'id' | 'organization_id' | 'created_at' | 'updated_at' | 'created_by'
    >,
    organizationId: string,
    createdBy?: string
  ): Promise<WorkflowEntity> {
    return this.getModel().create({
      data: {
        ...data,
        organization_id: organizationId,
        created_by: createdBy ?? null,
      },
    });
  }
}

// Export singleton instance
export const workflowRepository = new WorkflowRepository();
