/**
 * MCP Service
 * 
 * This module provides the unified MCP server service that automatically switches
 * between mock and REST API implementations based on environment configuration.
 */

import type { MCPServer, ConnectionTestResult } from '@/types'
import { getServiceConfig } from './api/createService'
import { RestMCPService } from './api/restMCPService'
import { shouldUseRestApi } from './api/index'
import { ServiceError, withRetry, validateRequired, validateUrl, validateJson, logError } from '@/utils/errorHandling'

const SIMULATED_DELAY = 300

const mockMCPServers: MCPServer[] = [
  {
    id: 'mcp-1',
    name: 'GitHub Integration',
    description: 'Connect to GitHub repositories and manage code',
    hostAddress: 'https://github.com/api/v1',
    oauth: {
      clientId: 'github_client_id_123',
      clientSecret: 'github_client_secret_456',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scope: 'repo,user',
    },
    headers: { 'X-Custom-Header': 'github-integration' },
    status: 'active',
  },
  {
    id: 'mcp-2',
    name: 'Slack Integration',
    description: 'Send messages and manage Slack channels',
    hostAddress: 'https://slack.com/api',
    oauth: {
      clientId: 'slack_client_id_789',
      clientSecret: 'slack_client_secret_012',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scope: 'chat:write,channels:read',
    },
    headers: {},
    status: 'active',
  },
]

let mcpServerStore: MCPServer[] = [...mockMCPServers]

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function simulateNetworkFailure(): void {
  if (Math.random() < 0.1) throw new ServiceError('Simulated network failure', 'NETWORK_ERROR')
}

export const MockMCPService = {
  async getServers(): Promise<MCPServer[]> {
    return withRetry(async () => {
      simulateNetworkFailure()
      await delay(SIMULATED_DELAY)
      return [...mcpServerStore]
    })
  },

  async getServerById(id: string): Promise<MCPServer> {
    return withRetry(async () => {
      validateRequired(id, 'Server ID')
      simulateNetworkFailure()
      await delay(SIMULATED_DELAY)
      const server = mcpServerStore.find(s => s.id === id)
      if (!server) throw new ServiceError(`MCP server with id "${id}" not found`, 'NOT_FOUND')
      return { ...server }
    })
  },

  async createServer(data: Omit<MCPServer, 'id'>): Promise<MCPServer> {
    return withRetry(async () => {
      validateRequired(data.name?.trim(), 'Server name')
      validateRequired(data.hostAddress?.trim(), 'Host address')
      validateUrl(data.hostAddress)
      if (data.oauth?.tokenUrl) validateUrl(data.oauth.tokenUrl)
      if (data.headers) validateJson(JSON.stringify(data.headers))
      simulateNetworkFailure()
      await delay(SIMULATED_DELAY)
      const newServer: MCPServer = { ...data, id: `mcp-${Date.now()}` }
      mcpServerStore.push(newServer)
      return { ...newServer }
    })
  },

  async updateServer(id: string, data: Partial<Omit<MCPServer, 'id'>>): Promise<MCPServer> {
    return withRetry(async () => {
      validateRequired(id, 'Server ID')
      const index = mcpServerStore.findIndex(s => s.id === id)
      if (index === -1) throw new ServiceError(`MCP server with id "${id}" not found`, 'NOT_FOUND')
      if (data.name !== undefined) validateRequired(data.name.trim(), 'Server name')
      if (data.hostAddress !== undefined) { validateRequired(data.hostAddress.trim(), 'Host address'); validateUrl(data.hostAddress) }
      if (data.oauth?.tokenUrl) validateUrl(data.oauth.tokenUrl)
      if (data.headers !== undefined) validateJson(JSON.stringify(data.headers))
      simulateNetworkFailure()
      await delay(SIMULATED_DELAY)
      const updatedServer: MCPServer = { ...mcpServerStore[index], ...data, id: mcpServerStore[index].id }
      mcpServerStore[index] = updatedServer
      return { ...updatedServer }
    })
  },

  async deleteServer(id: string): Promise<void> {
    return withRetry(async () => {
      validateRequired(id, 'Server ID')
      const index = mcpServerStore.findIndex(s => s.id === id)
      if (index === -1) throw new ServiceError(`MCP server with id "${id}" not found`, 'NOT_FOUND')
      simulateNetworkFailure()
      await delay(SIMULATED_DELAY)
      mcpServerStore.splice(index, 1)
    })
  },

  async testConnection(id: string): Promise<ConnectionTestResult> {
    try {
      return await withRetry(async () => {
        validateRequired(id, 'Server ID')
        const server = mcpServerStore.find(s => s.id === id)
        if (!server) return { success: false, message: 'Server not found' }
        simulateNetworkFailure()
        await delay(SIMULATED_DELAY)
        const isSuccess = Math.random() > 0.2
        const latency = Math.floor(Math.random() * 500) + 50
        return { success: isSuccess, message: isSuccess ? 'Connection successful' : 'Connection failed', latency: isSuccess ? latency : undefined }
      }, { maxAttempts: 2 })
    } catch (error) {
      logError(error as Error, 'MCPService.testConnection', { serverId: id })
      return { success: false, message: `Connection test failed: ${(error as Error).message}` }
    }
  },

  resetStore(): void { mcpServerStore = [...mockMCPServers] },
  getMockServers(): MCPServer[] { return [...mockMCPServers] },
}

export interface IMCPService {
  getServers(): Promise<MCPServer[]>
  getServerById(id: string): Promise<MCPServer>
  createServer(data: Omit<MCPServer, 'id'>): Promise<MCPServer>
  updateServer(id: string, data: Partial<Omit<MCPServer, 'id'>>): Promise<MCPServer>
  deleteServer(id: string): Promise<void>
  testConnection(id: string): Promise<ConnectionTestResult>
  resetStore?(): void
  getMockServers?(): MCPServer[]
}

function selectMCPService(): IMCPService {
  if (shouldUseRestApi()) {
    return RestMCPService as unknown as IMCPService
  }
  const config = getServiceConfig()
  return config.useMock ? MockMCPService : (RestMCPService as unknown as IMCPService)
}

export const MCPService = selectMCPService()
export default MCPService
