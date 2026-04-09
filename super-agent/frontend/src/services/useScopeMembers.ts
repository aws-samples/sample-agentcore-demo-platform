/**
 * Hook for managing scope-level membership and access control.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  ScopeMembershipService,
  type ScopeMember,
  type ScopeRole,
  type ScopeVisibility,
} from './api/restScopeMembershipService';

export function useScopeMembers(scopeId: string | null) {
  const [members, setMembers] = useState<ScopeMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!scopeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await ScopeMembershipService.getMembers(scopeId);
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scope members');
    } finally {
      setIsLoading(false);
    }
  }, [scopeId]);

  useEffect(() => { void fetch(); }, [fetch]);

  const addMember = useCallback(async (userId: string, role: ScopeRole) => {
    if (!scopeId) return false;
    try {
      await ScopeMembershipService.addMember(scopeId, userId, role);
      await fetch();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
      return false;
    }
  }, [scopeId, fetch]);

  const updateRole = useCallback(async (membershipId: string, role: ScopeRole) => {
    if (!scopeId) return;
    try {
      await ScopeMembershipService.updateRole(scopeId, membershipId, role);
      setMembers((prev) =>
        prev.map((m) => (m.id === membershipId ? { ...m, role } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  }, [scopeId]);

  const removeMember = useCallback(async (membershipId: string) => {
    if (!scopeId) return;
    try {
      await ScopeMembershipService.removeMember(scopeId, membershipId);
      setMembers((prev) => prev.filter((m) => m.id !== membershipId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }, [scopeId]);

  const updateVisibility = useCallback(async (visibility: ScopeVisibility) => {
    if (!scopeId) return;
    try {
      await ScopeMembershipService.updateVisibility(scopeId, visibility);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visibility');
    }
  }, [scopeId]);

  return {
    members,
    isLoading,
    error,
    clearError: () => setError(null),
    refetch: fetch,
    addMember,
    updateRole,
    removeMember,
    updateVisibility,
  };
}
