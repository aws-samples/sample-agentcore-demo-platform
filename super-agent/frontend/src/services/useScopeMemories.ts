/**
 * useScopeMemories — React hook for scope memory management.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { restScopeMemoryService, type ScopeMemory, type ScopeMemoryDraft } from './api/restScopeMemoryService'

export function useScopeMemories(scopeId: string) {
  const [memories, setMemories] = useState<ScopeMemory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const load = useCallback(async (params?: { category?: string; q?: string }) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await restScopeMemoryService.list(scopeId, params)
      if (mounted.current) setMemories(data)
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Failed to load memories')
    } finally {
      if (mounted.current) setIsLoading(false)
    }
  }, [scopeId])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (data: {
    title: string; content: string; category?: string;
    tags?: string[]; is_pinned?: boolean; session_id?: string
  }) => {
    const memory = await restScopeMemoryService.create(scopeId, data)
    if (mounted.current) setMemories(prev => [memory, ...prev])
    return memory
  }, [scopeId])

  const update = useCallback(async (memoryId: string, data: {
    title?: string; content?: string; category?: string;
    tags?: string[]; is_pinned?: boolean
  }) => {
    const updated = await restScopeMemoryService.update(scopeId, memoryId, data)
    if (mounted.current) setMemories(prev => prev.map(m => m.id === memoryId ? updated : m))
    return updated
  }, [scopeId])

  const remove = useCallback(async (memoryId: string) => {
    await restScopeMemoryService.remove(scopeId, memoryId)
    if (mounted.current) setMemories(prev => prev.filter(m => m.id !== memoryId))
  }, [scopeId])

  const summarize = useCallback(async (sessionId: string): Promise<ScopeMemoryDraft> => {
    return restScopeMemoryService.summarize(scopeId, sessionId)
  }, [scopeId])

  return { memories, isLoading, error, load, create, update, remove, summarize }
}
