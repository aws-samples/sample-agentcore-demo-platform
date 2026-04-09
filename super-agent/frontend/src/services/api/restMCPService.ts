/**
 * REST MCP Service
 * 
 * Implements the MCP server service interface using the REST API backend.
 */

import { restClient } from './restClient';
import type { MCPServer, MCPServerStatus, MCPServerConfig, ConnectionTestResult } from '@/types';
import { ServiceError } from '@/utils/errorHandling';

/**
 * API response type for MCP servers (snake_case from backend)
 */
interface ApiMCPServer {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  host_address: string;
  oauth_secret_id: string | null;
  headers: Record<string, string>;
  config: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Maps API MCP server response to application MCPServer type
 */
function mapApiMCPServerToMCPServer(apiServer: ApiMCPServer): MCPServer {
  return {
    id: apiServer.id,
    name: apiServer.name,
    description: apiServer.description || '',
    hostAddress: apiServer.host_address,
    headers: apiServer.headers,
    config: apiServer.config as MCPServerConfig | null,
    status: apiServer.status as MCPServerStatus,
  };
}

/**
 * Maps application MCPServer to API request format
 */
function mapMCPServerToApiRequest(server: Partial<MCPServer>): Record<string, unknown> {
  const request: Record<string, unknown> = {};
  
  if (server.name !== undefined) request.name = server.name;
  if (server.description !== undefined) request.description = server.description;
  if (server.hostAddress !== undefined) request.host_address = server.hostAddress;
  if (server.headers !== undefined) request.headers = server.headers;
  if (server.config !== undefined) request.config = server.config;
  if (server.status !== undefined) request.status = server.status;
  
  return request;
}

/**
 * REST implementation of the MCP Service
 */
export const RestMCPService = {
  /**
   * Retrieves all MCP servers from the API
   */
  async getServers(): Promise<MCPServer[]> {
    try {
      const response = await restClient.get<{
        data: ApiMCPServer[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>('/api/mcp/servers');
      return response.data.map(mapApiMCPServerToMCPServer);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to fetch MCP servers', 'UNKNOWN');
    }
  },

  /**
   * Retrieves a single MCP server by ID
   */
  async getServerById(id: string): Promise<MCPServer> {
    try {
      const response = await restClient.get<ApiMCPServer>(`/api/mcp/servers/${id}`);
      return mapApiMCPServerToMCPServer(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch MCP server with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Creates a new MCP server
   */
  async createServer(data: Omit<MCPServer, 'id'>): Promise<MCPServer> {
    try {
      if (!data.name || data.name.trim() === '') {
        throw new ServiceError('MCP server name is required', 'VALIDATION_ERROR');
      }
      // hostAddress is required as a fallback identifier, but not necessarily a URL for stdio servers
      if (!data.hostAddress || data.hostAddress.trim() === '') {
        throw new ServiceError('MCP server host address is required', 'VALIDATION_ERROR');
      }

      const requestData = mapMCPServerToApiRequest(data);
      const response = await restClient.post<ApiMCPServer>('/api/mcp/servers', requestData);
      return mapApiMCPServerToMCPServer(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to create MCP server', 'UNKNOWN');
    }
  },

  /**
   * Updates an MCP server
   */
  async updateServer(id: string, data: Partial<MCPServer>): Promise<MCPServer> {
    try {
      if (data.name !== undefined && data.name.trim() === '') {
        throw new ServiceError('MCP server name cannot be empty', 'VALIDATION_ERROR');
      }

      const requestData = mapMCPServerToApiRequest(data);
      const response = await restClient.put<ApiMCPServer>(`/api/mcp/servers/${id}`, requestData);
      return mapApiMCPServerToMCPServer(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to update MCP server with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Deletes an MCP server
   */
  async deleteServer(id: string): Promise<void> {
    try {
      await restClient.delete(`/api/mcp/servers/${id}`);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to delete MCP server with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Tests connection to an MCP server
   */
  async testConnection(id: string): Promise<ConnectionTestResult> {
    try {
      const response = await restClient.post<ConnectionTestResult>(`/api/mcp/servers/${id}/test`);
      return response;
    } catch (error) {
      if (error instanceof ServiceError) {
        return {
          success: false,
          message: error.message,
        };
      }
      return {
        success: false,
        message: 'Connection test failed',
      };
    }
  },

  /**
   * Retrieves MCP servers filtered by status
   */
  async getServersByStatus(status: MCPServerStatus): Promise<MCPServer[]> {
    try {
      const response = await restClient.get<{
        data: ApiMCPServer[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(
        `/api/mcp/servers?status=${encodeURIComponent(status)}`
      );
      return response.data.map(mapApiMCPServerToMCPServer);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch MCP servers with status "${status}"`, 'UNKNOWN');
    }
  },

  /**
   * Subscribes to real-time MCP server changes (no-op for REST)
   */
  subscribeToChanges(callback: (payload: { eventType: string; new?: MCPServer; old?: MCPServer }) => void) {
    console.warn('REST API does not support real-time subscriptions. Consider using polling.');
    return () => {};
  },
};

export default RestMCPService;
