/**
 * useUserGroups Hook
 * State management for user groups CRUD.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { RestUserGroupService, type UserGroup, type UserGroupDetail } from './api/restUserGroupService';

export function useUserGroups() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await RestUserGroupService.listGroups();
      if (mountedRef.current) setGroups(data);
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to load groups');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createGroup = useCallback(async (name: string, description?: string) => {
    try {
      const group = await RestUserGroupService.createGroup(name, description);
      await load();
      return group;
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to create group');
      return null;
    }
  }, [load]);

  const updateGroup = useCallback(async (id: string, data: { name?: string; description?: string }) => {
    try {
      await RestUserGroupService.updateGroup(id, data);
      await load();
      return true;
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to update group');
      return false;
    }
  }, [load]);

  const deleteGroup = useCallback(async (id: string) => {
    try {
      await RestUserGroupService.deleteGroup(id);
      if (mountedRef.current) setGroups(prev => prev.filter(g => g.id !== id));
      return true;
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to delete group');
      return false;
    }
  }, []);

  const addMember = useCallback(async (groupId: string, userId: string) => {
    try {
      await RestUserGroupService.addMember(groupId, userId);
      await load();
      return true;
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to add member');
      return false;
    }
  }, [load]);

  const removeMember = useCallback(async (groupId: string, userId: string) => {
    try {
      await RestUserGroupService.removeMember(groupId, userId);
      await load();
      return true;
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to remove member');
      return false;
    }
  }, [load]);

  return {
    groups, isLoading, error,
    clearError: () => setError(null),
    createGroup, updateGroup, deleteGroup,
    addMember, removeMember,
    refresh: load,
  };
}
