/**
 * MCP Server Service
 * Business logic layer for MCP Server management.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { mcpServerRepository, type McpServerEntity } from '../repositories/mcp.repository.js';
import { AppError } from '../middleware/errorHandler.js';
import type {
  CreateMcpServerInput,
  UpdateMcpServerInput,
  McpServerFilter,
  McpServerTestResponse,
} from '../schemas/mcp.schema.js';

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * MCP Server Service class providing business logic for MCP server operations.
 */
export class McpServerService {
  /**
   * Get all MCP servers for an organization with optional filters.
   * Requirements: 9.1
   *
   * @param organizationId - The organization ID
   * @param filters - Optional filters (status, name)
   * @param pagination - Optional pagination options
   * @returns Paginated list of MCP servers
   */
  async getMcpServers(
    organizationId: string,
    filters?: McpServerFilter,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<McpServerEntity>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const servers = await mcpServerRepository.findAllWithFilters(organizationId, filters, {
      skip,
      take: limit,
    });

    // Get total count for pagination
    const total = await mcpServerRepository.count(
      organizationId,
      filters as Partial<McpServerEntity>
    );

    return {
      data: servers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single MCP server by ID.
   * Requirements: 9.1
   *
   * @param id - The MCP server ID
   * @param organizationId - The organization ID
   * @returns The MCP server if found
   * @throws AppError.notFound if MCP server doesn't exist
   */
  async getMcpServerById(id: string, organizationId: string): Promise<McpServerEntity> {
    const server = await mcpServerRepository.findById(id, organizationId);

    if (!server) {
      throw AppError.notFound(`MCP server with ID ${id} not found`);
    }

    return server;
  }

  /**
   * Create a new MCP server.
   * Requirements: 9.2
   *
   * @param data - The MCP server data
   * @param organizationId - The organization ID
   * @returns The created MCP server
   * @throws AppError.validation if name is empty or invalid
   * @throws AppError.conflict if name already exists
   */
  async createMcpServer(
    data: CreateMcpServerInput,
    organizationId: string
  ): Promise<McpServerEntity> {
    // Validate required fields
    if (!data.name || data.name.trim() === '') {
      throw AppError.validation('MCP server name is required');
    }

    if (!data.host_address || data.host_address.trim() === '') {
      throw AppError.validation('Host address is required');
    }

    // Check for duplicate name within organization
    const existingServer = await mcpServerRepository.findByName(organizationId, data.name);
    if (existingServer) {
      throw AppError.conflict(`MCP server with name "${data.name}" already exists`);
    }

    // Create the MCP server
    const server = await mcpServerRepository.create(
      {
        name: data.name.trim(),
        description: data.description ?? null,
        host_address: data.host_address.trim(),
        oauth_secret_id: data.oauth_secret_id ?? null,
        headers: data.headers ?? {},
        config: data.config ?? null,
        status: data.status ?? 'inactive',
      },
      organizationId
    );

    return server;
  }

  /**
   * Update an existing MCP server.
   * Requirements: 9.3
   *
   * @param id - The MCP server ID
   * @param data - The update data
   * @param organizationId - The organization ID
   * @returns The updated MCP server
   * @throws AppError.notFound if MCP server doesn't exist
   * @throws AppError.validation if data is invalid
   */
  async updateMcpServer(
    id: string,
    data: UpdateMcpServerInput,
    organizationId: string
  ): Promise<McpServerEntity> {
    // Verify MCP server exists
    const existingServer = await mcpServerRepository.findById(id, organizationId);
    if (!existingServer) {
      throw AppError.notFound(`MCP server with ID ${id} not found`);
    }

    // Validate name if provided
    if (data.name !== undefined) {
      if (!data.name || data.name.trim() === '') {
        throw AppError.validation('MCP server name cannot be empty');
      }

      // Check for duplicate name (excluding current server)
      const serverWithName = await mcpServerRepository.findByName(organizationId, data.name);
      if (serverWithName && serverWithName.id !== id) {
        throw AppError.conflict(`MCP server with name "${data.name}" already exists`);
      }
    }

    // Validate host_address if provided
    if (
      data.host_address !== undefined &&
      (!data.host_address || data.host_address.trim() === '')
    ) {
      throw AppError.validation('Host address cannot be empty');
    }

    // Build update object with only provided fields
    const updateData: Partial<McpServerEntity> = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.host_address !== undefined) updateData.host_address = data.host_address.trim();
    if (data.oauth_secret_id !== undefined) updateData.oauth_secret_id = data.oauth_secret_id;
    if (data.headers !== undefined) updateData.headers = data.headers;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.status !== undefined) updateData.status = data.status;

    const updatedServer = await mcpServerRepository.update(id, organizationId, updateData);

    if (!updatedServer) {
      throw AppError.notFound(`MCP server with ID ${id} not found`);
    }

    return updatedServer;
  }

  /**
   * Delete an MCP server.
   * Requirements: 9.4
   *
   * @param id - The MCP server ID
   * @param organizationId - The organization ID
   * @returns True if deleted successfully
   * @throws AppError.notFound if MCP server doesn't exist
   */
  async deleteMcpServer(id: string, organizationId: string): Promise<boolean> {
    const deleted = await mcpServerRepository.delete(id, organizationId);

    if (!deleted) {
      throw AppError.notFound(`MCP server with ID ${id} not found`);
    }

    return true;
  }

  /**
   * Test connection to an MCP server.
   * Requirements: 9.5
   *
   * @param id - The MCP server ID
   * @param organizationId - The organization ID
   * @param timeoutMs - Connection timeout in milliseconds
   * @returns Test result with success status and latency
   * @throws AppError.notFound if MCP server doesn't exist
   */
  async testMcpServerConnection(
      id: string,
      organizationId: string,
      timeoutMs: number = 5000
    ): Promise<McpServerTestResponse> {
      // Verify MCP server exists
      const server = await mcpServerRepository.findById(id, organizationId);
      if (!server) {
        throw AppError.notFound(`MCP server with ID ${id} not found`);
      }

      // Determine server type from config or host_address
      const config = server.config as Record<string, unknown> | null;
      const isStdio = config?.type === 'stdio' ||
        (!config && server.host_address && !server.host_address.startsWith('http://') && !server.host_address.startsWith('https://'));

      // For stdio servers, we can't do an HTTP test — just verify the command exists
      if (isStdio) {
        const command = (config?.command as string) || server.host_address.split(/\s+/)[0];
        try {
          const { execFile } = await import('child_process');
          const { promisify } = await import('util');
          const execFileAsync = promisify(execFile);
          await execFileAsync('which', [command], { timeout: 5000 });
          await mcpServerRepository.updateStatus(id, organizationId, 'active');
          return { success: true, latency_ms: 0 };
        } catch {
          // Command not found locally is not necessarily an error (e.g. npx downloads it)
          // Don't set status to error for stdio servers
          await mcpServerRepository.updateStatus(id, organizationId, 'active');
          return {
            success: true,
            latency_ms: 0,
            error: `stdio server — command "${command}" will be resolved at runtime (e.g. via npx)`,
          };
        }
      }

      // SSE/HTTP servers: test via HTTP HEAD
      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const url = (config?.url as string) || server.host_address;
        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: server.headers,
        });

        clearTimeout(timeoutId);
        const latencyMs = Date.now() - startTime;

        if (response.ok || response.status < 500) {
          await mcpServerRepository.updateStatus(id, organizationId, 'active');
          return { success: true, latency_ms: latencyMs };
        } else {
          await mcpServerRepository.updateStatus(id, organizationId, 'error');
          return { success: false, latency_ms: latencyMs, error: `Server returned status ${response.status}` };
        }
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        await mcpServerRepository.updateStatus(id, organizationId, 'error');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          latency_ms: latencyMs,
          error: errorMessage.includes('abort') ? 'Connection timeout' : errorMessage,
        };
      }
    }

  /**
   * Get active MCP servers for an organization.
   *
   * @param organizationId - The organization ID
   * @returns List of active MCP servers
   */
  async getActiveMcpServers(organizationId: string): Promise<McpServerEntity[]> {
    return mcpServerRepository.findActive(organizationId);
  }
}

// Export singleton instance
export const mcpServerService = new McpServerService();
