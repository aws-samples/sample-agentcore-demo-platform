import { useState, useEffect } from 'react'
import type { Capability } from '@/types'
import { capabilityService } from './capabilityService'

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<Capability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCapabilities = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await capabilityService.getCapabilities()
        setCapabilities(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load capabilities')
      } finally {
        setLoading(false)
      }
    }

    fetchCapabilities()
  }, [])

  return { capabilities, loading, error }
}
