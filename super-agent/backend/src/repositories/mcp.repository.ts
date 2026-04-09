/**
 * MCP Server Repository
 * Data access layer for MCP Server entities with multi-tenancy support.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { BaseRepository, type FindAllOptions } from './base.repository.js';
import type { McpServerFilter } from '../schemas/mcp.schema.js';

/**
 * MCP Server entity type matching the Prisma schema
 */
export interface McpServerEntity {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  host_address: string;
  oauth_secret_id: string | null;
  headers: Record<string, string>;
  config: Record<string, unknown> | null;
  status: 'active' | 'inactive' | 'error';
  created_at: Date;
  updated_at: Date;
}

/**
 * MCP Server Repository class extending BaseRepository with MCP-specific methods.
 * Provides multi-tenancy filtering for all operations.
 */
export class McpServerRepository extends BaseRepository<McpServerEntity> {
  constructor() {
    super('mcp_servers');
  }

  /**
   * Find all MCP servers with optional filters.
   * Supports filtering by status and name.
   *
   * @param organizationId - The organization ID to filter by
   * @param filters - Optional filters (status, name)
   * @param options - Optional query options (pagination, ordering)
   * @returns Array of MCP servers matching the criteria
   */
  async findAllWithFilters(
    organizationId: string,
    filters?: McpServerFilter,
    options?: Omit<FindAllOptions<McpServerEntity>, 'where'>
  ): Promise<McpServerEntity[]> {
    const where: Partial<McpServerEntity> = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.name) {
      where.name = filters.name;
    }

    return this.findAll(organizationId, {
      ...options,
      where,
    });
  }

  /**
   * Find MCP servers by status.
   *
   * @param organizationId - The organization ID to filter by
   * @param status - The status to filter by
   * @returns Array of MCP servers with the specified status
   */
  async findByStatus(
    organizationId: string,
    status: McpServerEntity['status']
  ): Promise<McpServerEntity[]> {
    return this.findAll(organizationId, {
      where: { status },
    });
  }

  /**
   * Find MCP server by name within an organization.
   * Useful for checking uniqueness.
   *
   * @param organizationId - The organization ID to filter by
   * @param name - The MCP server name to search for
   * @returns The MCP server if found, null otherwise
   */
  async findByName(organizationId: string, name: string): Promise<McpServerEntity | null> {
    return this.findFirst(organizationId, { name });
  }

  /**
   * Update MCP server status.
   *
   * @param id - The MCP server ID
   * @param organizationId - The organization ID to filter by
   * @param status - The new status
   * @returns The updated MCP server, or null if not found
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: McpServerEntity['status']
  ): Promise<McpServerEntity | null> {
    return this.update(id, organizationId, { status });
  }

  /**
   * Get active MCP servers for an organization.
   *
   * @param organizationId - The organization ID to filter by
   * @returns Array of active MCP servers
   */
  async findActive(organizationId: string): Promise<McpServerEntity[]> {
    return this.findByStatus(organizationId, 'active');
  }
}

// Export singleton instance
export const mcpServerRepository = new McpServerRepository();
