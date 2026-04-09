import { useState, useCallback } from 'react'
import { MCPService } from './mcpService'
import { ServiceError } from '@/utils/errorHandling'
import type { MCPServer, ConnectionTestResult } from '@/types'

export interface UseMCPState {
  servers: MCPServer[]
  isLoading: boolean
  error: string | null
}

export interface UseMCPReturn extends UseMCPState {
  getServers: () => Promise<MCPServer[]>
  getServerById: (id: string) => Promise<MCPServer>
  createServer: (data: Omit<MCPServer, 'id'>) => Promise<MCPServer>
  updateServer: (id: string, data: Partial<Omit<MCPServer, 'id'>>) => Promise<MCPServer>
  deleteServer: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<ConnectionTestResult>
  clearError: () => void
}

export function useMCP(): UseMCPReturn {
  const [state, setState] = useState<UseMCPState>({
    servers: [],
    isLoading: false,
    error: null,
  })

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }))
  }, [])

  const getServers = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const servers = await MCPService.getServers()
      setState(prev => ({ ...prev, servers, isLoading: false }))
      return servers
    } catch (err) {
      const message = err instanceof ServiceError ? err.message : 'Failed to fetch servers'
      setError(message)
      setState(prev => ({ ...prev, isLoading: false }))
      return []
    }
  }, [setError])

  const getServerById = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const server = await MCPService.getServerById(id)
      setState(prev => ({ ...prev, isLoading: false }))
      return server
    } catch (err) {
      const message = err instanceof ServiceError ? err.message : 'Failed to fetch server'
      setError(message)
      setState(prev => ({ ...prev, isLoading: false }))
      throw err
    }
  }, [setError])

  const createServer = useCallback(async (data: Omit<MCPServer, 'id'>) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const server = await MCPService.createServer(data)
      setState(prev => ({
        ...prev,
        servers: [...prev.servers, server],
        isLoading: false,
      }))
      return server
    } catch (err) {
      const message = err instanceof ServiceError ? err.message : 'Failed to create server'
      setError(message)
      setState(prev => ({ ...prev, isLoading: false }))
      throw err
    }
  }, [setError])

  const updateServer = useCallback(async (id: string, data: Partial<Omit<MCPServer, 'id'>>) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const server = await MCPService.updateServer(id, data)
      setState(prev => ({
        ...prev,
        servers: prev.servers.map(s => (s.id === id ? server : s)),
        isLoading: false,
      }))
      return server
    } catch (err) {
      const message = err instanceof ServiceError ? err.message : 'Failed to update server'
      setError(message)
      setState(prev => ({ ...prev, isLoading: false }))
      throw err
    }
  }, [setError])

  const deleteServer = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      await MCPService.deleteServer(id)
      setState(prev => ({
        ...prev,
        servers: prev.servers.filter(s => s.id !== id),
        isLoading: false,
      }))
    } catch (err) {
      const message = err instanceof ServiceError ? err.message : 'Failed to delete server'
      setError(message)
      setState(prev => ({ ...prev, isLoading: false }))
      throw err
    }
  }, [setError])

  const testConnection = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const result = await MCPService.testConnection(id)
      setState(prev => ({ ...prev, isLoading: false }))
      return result
    } catch (err) {
      const message = err instanceof ServiceError ? err.message : 'Failed to test connection'
      setError(message)
      setState(prev => ({ ...prev, isLoading: false }))
      throw err
    }
  }, [setError])

  const clearError = useCallback(() => {
    setError(null)
  }, [setError])

  return {
    ...state,
    getServers,
    getServerById,
    createServer,
    updateServer,
    deleteServer,
    testConnection,
    clearError,
  }
}
