/**
 * useConnectors hook
 *
 * Data fetching and state management for the Data Connector module.
 */

import { useState, useEffect, useCallback } from 'react'
import { connectorService, type Connector, type Credential, type ScopeConnectorBinding } from '@/services/connectorService'

export function useCredentials() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCredentials(await connectorService.listCredentials())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load credentials')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return { credentials, loading, error, reload: load }
}

export function useConnectors(filter?: { connector_type?: string; status?: string }) {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setConnectors(await connectorService.listConnectors(filter))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load connectors')
    } finally {
      setLoading(false)
    }
  }, [filter?.connector_type, filter?.status])

  useEffect(() => { void load() }, [load])

  return { connectors, loading, error, reload: load }
}

export function useScopeConnectors(scopeId: string | null) {
  const [bindings, setBindings] = useState<ScopeConnectorBinding[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!scopeId) return
    setLoading(true)
    setError(null)
    try {
      setBindings(await connectorService.listScopeConnectors(scopeId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load scope connectors')
    } finally {
      setLoading(false)
    }
  }, [scopeId])

  useEffect(() => { void load() }, [load])

  return { bindings, loading, error, reload: load }
}
