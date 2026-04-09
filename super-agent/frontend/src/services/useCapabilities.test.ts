import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCapabilities } from './useCapabilities'
import * as capabilityServiceModule from './capabilityService'

describe('useCapabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useCapabilities())

    expect(result.current.loading).toBe(true)
    expect(result.current.capabilities).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('should load capabilities successfully', async () => {
    const mockCapabilities = [
      {
        id: 'cap-1',
        category: 'Video Intelligence',
        name: 'Video Analysis',
        description: 'Analyze video',
        toolIdentifier: 'video.analysis.v1',
        icon: '🎬',
        color: '#FF6B6B',
      },
    ]

    vi.spyOn(capabilityServiceModule.capabilityService, 'getCapabilities').mockResolvedValue(
      mockCapabilities
    )

    const { result } = renderHook(() => useCapabilities())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.capabilities).toEqual(mockCapabilities)
    expect(result.current.error).toBeNull()
  })

  it('should handle errors', async () => {
    const errorMessage = 'Failed to load capabilities'
    vi.spyOn(capabilityServiceModule.capabilityService, 'getCapabilities').mockRejectedValue(
      new Error(errorMessage)
    )

    const { result } = renderHook(() => useCapabilities())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe(errorMessage)
    expect(result.current.capabilities).toEqual([])
  })

  it('should set loading to false after fetch completes', async () => {
    vi.spyOn(capabilityServiceModule.capabilityService, 'getCapabilities').mockResolvedValue([])

    const { result } = renderHook(() => useCapabilities())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('should clear error on successful load', async () => {
    const mockCapabilities = [
      {
        id: 'cap-1',
        category: 'Video Intelligence',
        name: 'Video Analysis',
        description: 'Analyze video',
        toolIdentifier: 'video.analysis.v1',
        icon: '🎬',
        color: '#FF6B6B',
      },
    ]

    vi.spyOn(capabilityServiceModule.capabilityService, 'getCapabilities').mockResolvedValue(
      mockCapabilities
    )

    const { result } = renderHook(() => useCapabilities())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeNull()
  })

  it('should call getCapabilities on mount', async () => {
    const getCapabilitiesSpy = vi
      .spyOn(capabilityServiceModule.capabilityService, 'getCapabilities')
      .mockResolvedValue([])

    renderHook(() => useCapabilities())

    await waitFor(() => {
      expect(getCapabilitiesSpy).toHaveBeenCalledTimes(1)
    })
  })

  it('should return capabilities with correct structure', async () => {
    const mockCapabilities = [
      {
        id: 'cap-1',
        category: 'Video Intelligence',
        name: 'Video Analysis',
        description: 'Analyze video',
        toolIdentifier: 'video.analysis.v1',
        icon: '🎬',
        color: '#FF6B6B',
      },
      {
        id: 'cap-2',
        category: 'Communication',
        name: 'Email Sending',
        description: 'Send emails',
        toolIdentifier: 'email.send.v1',
        icon: '📧',
        color: '#95E1D3',
      },
    ]

    vi.spyOn(capabilityServiceModule.capabilityService, 'getCapabilities').mockResolvedValue(
      mockCapabilities
    )

    const { result } = renderHook(() => useCapabilities())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.capabilities).toHaveLength(2)
    expect(result.current.capabilities[0].id).toBe('cap-1')
    expect(result.current.capabilities[1].id).toBe('cap-2')
  })
})
