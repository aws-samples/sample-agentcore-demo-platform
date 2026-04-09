/**
 * REST Members & Organization Service
 */

import { restClient } from './restClient';

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type MemberStatus = 'active' | 'pending';

export interface Member {
  id: string;
  user_id: string;
  invited_email?: string;
  role: MemberRole;
  status: MemberStatus;
  // joined from profile (may not always be present)
  email?: string;
  name?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_type: string;
}

export const RestMembersService = {
  listMembers: () =>
    restClient
      .get<{ data: Member[]; pagination: unknown }>('/api/organizations/members?limit=0')
      .then((r) => r.data),

  inviteMember: (email: string, role: MemberRole) =>
    restClient.post<Member>('/api/organizations/members/invite', { invited_email: email, role }),

  provisionMember: (username: string, password: string, role: MemberRole, fullName?: string) =>
    restClient.post<{ userId: string; username: string; role: string; membershipId: string }>(
      '/api/organizations/members/provision',
      { username, password, role, fullName },
    ),

  // Backend uses PUT /members/:id
  updateMember: (id: string, role: MemberRole) =>
    restClient.put<Member>(`/api/organizations/members/${id}`, { role }),

  removeMember: (id: string) =>
    restClient.delete(`/api/organizations/members/${id}`),

  getOrganization: () =>
    restClient.get<Organization>('/api/organizations/current'),

  // Backend uses PUT /:id — we need the org id, so accept it as param
  updateOrganization: (id: string, data: Partial<Pick<Organization, 'name' | 'slug'>>) =>
    restClient.put<Organization>(`/api/organizations/${id}`, data),
};
