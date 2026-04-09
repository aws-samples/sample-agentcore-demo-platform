import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMCP } from './useMCP'
import { MCPService } from './mcpService'

describe('useMCP', () => {
  beforeEach(() => {
    MCPService.resetStore()
  })

  describe('initial state', () => {
    it('should have empty servers array initially', () => {
      const { result } = renderHook(() => useMCP())
      expect(result.current.servers).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('getServers', () => {
    it('should fetch and set servers', async () => {
      const { result } = renderHook(() => useMCP())

      await act(async () => {
        await result.current.getServers()
      })

      expect(result.current.servers).toHaveLength(2)
      expect(result.current.servers[0].name).toBe('GitHub Integration')
      expect(result.current.isLoading).toBe(false)
    })

    it('should clear error on successful fetch', async () => {
      const { result } = renderHook(() => useMCP())

      await act(async () => {
        await result.current.getServers()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('createServer', () => {
    it('should create a new server and add to list', async () => {
      const { result } = renderHook(() => useMCP())

      await act(async () => {
        await result.current.getServers()
      })

      expect(result.current.servers).toHaveLength(2)

      await act(async () => {
        await result.current.createServer({
          name: 'New Server',
          description: 'Test',
          hostAddress: 'https://example.com',
          status: 'active',
        })
      })

      expect(result.current.servers).toHaveLength(3)
      expect(result.current.servers[2].name).toBe('New Server')
    })

    it('should throw error on validation failure', async () => {
      const { result } = renderHook(() => useMCP())

      await expect(
        act(async () => {
          await result.current.createServer({
            name: '',
            description: 'Test',
            hostAddress: 'https://example.com',
            status: 'active',
          })
        })
      ).rejects.toThrow()
    })
  })

  describe('updateServer', () => {
    it('should update an existing server', async () => {
      const { result } = renderHook(() => useMCP())

      await act(async () => {
        await result.current.getServers()
      })

      await act(async () => {
        await result.current.updateServer('mcp-1', {
          name: 'Updated Name',
        })
      })

      expect(result.current.servers[0].name).toBe('Updated Name')
    })

    it('should throw error if server not found', async () => {
      const { result } = renderHook(() => useMCP())

      await expect(
        act(async () => {
          await result.current.updateServer('nonexistent', {
            name: 'Test',
          })
        })
      ).rejects.toThrow()
    })
  })

  describe('deleteServer', () => {
    it('should delete a server from list', async () => {
      const { result } = renderHook(() => useMCP())

      await act(async () => {
        await result.current.getServers()
      })

      expect(result.current.servers).toHaveLength(2)

      await act(async () => {
        await result.current.deleteServer('mcp-1')
      })

      expect(result.current.servers).toHaveLength(1)
      expect(result.current.servers[0].id).toBe('mcp-2')
    })

    it('should throw error if server not found', async () => {
      const { result } = renderHook(() => useMCP())

      await expect(
        act(async () => {
          await result.current.deleteServer('nonexistent')
        })
      ).rejects.toThrow()
    })
  })

  describe('testConnection', () => {
    it('should return connection result', async () => {
      const { result } = renderHook(() => useMCP())

      let connectionResult
      await act(async () => {
        connectionResult = await result.current.testConnection('mcp-1')
      })

      expect(connectionResult).toHaveProperty('success')
      expect(connectionResult).toHaveProperty('message')
    })
  })

  describe('clearError', () => {
    it('should clear error state', async () => {
      const { result } = renderHook(() => useMCP())

      // Trigger an error and wait for state update
      try {
        await act(async () => {
          await result.current.getServerById('nonexistent')
        })
      } catch {
        // Expected to throw
      }

      // Wait for the error state to be set
      await act(async () => {
        // Give time for state update
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(result.current.error).not.toBeNull()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})
