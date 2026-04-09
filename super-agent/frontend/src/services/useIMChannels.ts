/**
 * useIMChannels Hook
 * React hook for managing IM channel bindings on a business scope.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { RestIMChannelService } from './api/restIMChannelService';
import type { IMChannelBinding, CreateIMChannelRequest, UpdateIMChannelRequest } from './api/restIMChannelService';

export type { IMChannelBinding, CreateIMChannelRequest, UpdateIMChannelRequest };

export function useIMChannels(scopeId?: string) {
  const [bindings, setBindings] = useState<IMChannelBinding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (id?: string) => {
    const sid = id || scopeId;
    if (!sid) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await RestIMChannelService.list(sid);
      if (mountedRef.current) setBindings(data);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    if (scopeId) load();
  }, [scopeId, load]);

  const create = useCallback(async (data: CreateIMChannelRequest) => {
    if (!scopeId) return null;
    try {
      const binding = await RestIMChannelService.create(scopeId, data);
      if (mountedRef.current) setBindings(prev => [binding, ...prev]);
      return binding;
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to create');
      return null;
    }
  }, [scopeId]);

  const update = useCallback(async (bindingId: string, data: UpdateIMChannelRequest) => {
    if (!scopeId) return null;
    try {
      const updated = await RestIMChannelService.update(scopeId, bindingId, data);
      if (mountedRef.current) setBindings(prev => prev.map(b => b.id === bindingId ? updated : b));
      return updated;
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to update');
      return null;
    }
  }, [scopeId]);

  const remove = useCallback(async (bindingId: string) => {
    if (!scopeId) return false;
    try {
      await RestIMChannelService.remove(scopeId, bindingId);
      if (mountedRef.current) setBindings(prev => prev.filter(b => b.id !== bindingId));
      return true;
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to delete');
      return false;
    }
  }, [scopeId]);

  return { bindings, isLoading, error, load, create, update, remove, clearError: () => setError(null) };
}
