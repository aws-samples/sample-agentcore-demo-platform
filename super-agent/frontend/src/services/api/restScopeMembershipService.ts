/**
 * REST Scope Membership Service
 *
 * Frontend API client for scope-level access control.
 */

import { restClient } from './restClient';

export type ScopeRole = 'admin' | 'member' | 'viewer';
export type ScopeVisibility = 'open' | 'restricted';

export interface ScopeMember {
  id: string;
  user_id: string;
  role: ScopeRole;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

export const ScopeMembershipService = {
  async getMembers(scopeId: string): Promise<ScopeMember[]> {
    const res = await restClient.get<{ data: ScopeMember[] }>(
      `/api/business-scopes/${scopeId}/members`,
    );
    return res.data;
  },

  async addMember(scopeId: string, userId: string, role: ScopeRole = 'viewer') {
    return restClient.post(`/api/business-scopes/${scopeId}/members`, {
      user_id: userId,
      role,
    });
  },

  async updateRole(scopeId: string, membershipId: string, role: ScopeRole) {
    return restClient.patch(`/api/business-scopes/${scopeId}/members/${membershipId}`, { role });
  },

  async removeMember(scopeId: string, membershipId: string) {
    return restClient.delete(`/api/business-scopes/${scopeId}/members/${membershipId}`);
  },

  async updateVisibility(scopeId: string, visibility: ScopeVisibility) {
    return restClient.patch<{ id: string; visibility: ScopeVisibility }>(
      `/api/business-scopes/${scopeId}/visibility`,
      { visibility },
    );
  },
};
