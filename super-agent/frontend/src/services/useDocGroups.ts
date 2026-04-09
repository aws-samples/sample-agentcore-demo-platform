/**
 * useDocGroups — React hook for document group management.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  restDocGroupService,
  type DocGroup,
  type DocGroupFile,
  type ScopeDocGroupAssignment,
} from './api/restDocGroupService'

export function useDocGroups() {
  const [groups, setGroups] = useState<DocGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await restDocGroupService.listGroups()
      if (mounted.current) setGroups(data)
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      if (mounted.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (data: { name: string; description?: string }) => {
    const group = await restDocGroupService.createGroup(data)
    if (mounted.current) setGroups(prev => [...prev, group])
    return group
  }, [])

  const remove = useCallback(async (id: string) => {
    await restDocGroupService.deleteGroup(id)
    if (mounted.current) setGroups(prev => prev.filter(g => g.id !== id))
  }, [])

  return { groups, isLoading, error, load, create, remove }
}

export function useScopeDocGroups(scopeId: string) {
  const [assignments, setAssignments] = useState<ScopeDocGroupAssignment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const mounted = useRef(true)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await restDocGroupService.listScopeAssignments(scopeId)
      if (mounted.current) setAssignments(data)
    } catch { /* ignore */ }
    finally { if (mounted.current) setIsLoading(false) }
  }, [scopeId])

  useEffect(() => { load() }, [load])

  const assign = useCallback(async (groupId: string) => {
    await restDocGroupService.assignToScope(scopeId, groupId)
    // Reload full list to get nested document_group data
    const data = await restDocGroupService.listScopeAssignments(scopeId)
    if (mounted.current) setAssignments(data)
  }, [scopeId])

  const unassign = useCallback(async (assignmentId: string) => {
    await restDocGroupService.unassignFromScope(scopeId, assignmentId)
    if (mounted.current) setAssignments(prev => prev.filter(a => a.id !== assignmentId))
  }, [scopeId])

  return { assignments, isLoading, load, assign, unassign }
}
