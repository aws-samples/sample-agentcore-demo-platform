import { useState, useCallback, useEffect, useRef } from 'react';
import { RestMembersService, type Member, type MemberRole, type Organization } from './api/restMembersService';

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
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
      const data = await RestMembersService.listMembers();
      if (mountedRef.current) setMembers(data);
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const invite = useCallback(async (email: string, role: MemberRole) => {
    try {
      const member = await RestMembersService.inviteMember(email, role);
      if (mountedRef.current) setMembers((prev) => [...prev, member]);
      return true;
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to invite member');
      return false;
    }
  }, []);

  const updateRole = useCallback(async (id: string, role: MemberRole) => {
    try {
      const updated = await RestMembersService.updateMember(id, role);
      if (mountedRef.current) setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
      return true;
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to update role');
      return false;
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await RestMembersService.removeMember(id);
      if (mountedRef.current) setMembers((prev) => prev.filter((m) => m.id !== id));
      return true;
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to remove member');
      return false;
    }
  }, []);

  const provision = useCallback(async (username: string, password: string, role: MemberRole, fullName?: string) => {
    try {
      const result = await RestMembersService.provisionMember(username, password, role, fullName);
      // Reload members list to get the full member object
      await load();
      return result;
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to create user');
      return null;
    }
  }, [load]);

  return { members, isLoading, error, clearError: () => setError(null), invite, updateRole, remove, provision };
}

export function useOrganization() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    RestMembersService.getOrganization()
      .then((data) => { if (mountedRef.current) setOrg(data); })
      .catch((e) => { if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to load organization'); })
      .finally(() => { if (mountedRef.current) setIsLoading(false); });
  }, []);

  const save = useCallback(async (data: Partial<Pick<Organization, 'name' | 'slug'>>) => {
    if (!org) return false;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await RestMembersService.updateOrganization(org.id, data);
      if (mountedRef.current) setOrg(updated);
      return true;
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to save');
      return false;
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  }, [org]);

  return { org, isLoading, isSaving, error, clearError: () => setError(null), save };
}
