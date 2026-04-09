/**
 * REST User Group Service
 * Frontend API client for user group management and RBAC.
 */

import { restClient } from './restClient';

export interface UserGroup {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  member_count: number;
  members: UserGroupMember[];
}

export interface UserGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
  user: { id: string; full_name: string | null; username: string | null } | null;
}

export interface UserGroupDetail extends UserGroup {
  skills: Array<{ id: string; name: string; display_name: string }>;
  mcp_servers: Array<{ id: string; name: string; description: string | null }>;
}

export const RestUserGroupService = {
  // Group CRUD
  listGroups: () =>
    restClient.get<{ data: UserGroup[] }>('/api/user-groups').then(r => r.data),

  getGroup: (id: string) =>
    restClient.get<UserGroupDetail>(`/api/user-groups/${id}`),

  createGroup: (name: string, description?: string) =>
    restClient.post<UserGroup>('/api/user-groups', { name, description }),

  updateGroup: (id: string, data: { name?: string; description?: string }) =>
    restClient.put<UserGroup>(`/api/user-groups/${id}`, data),

  deleteGroup: (id: string) =>
    restClient.delete(`/api/user-groups/${id}`),

  // Member management
  addMember: (groupId: string, userId: string) =>
    restClient.post(`/api/user-groups/${groupId}/members`, { user_id: userId }),

  removeMember: (groupId: string, userId: string) =>
    restClient.delete(`/api/user-groups/${groupId}/members/${userId}`),

  getMyGroups: () =>
    restClient.get<{ data: UserGroup[] }>('/api/user-groups/my-groups').then(r => r.data),

  // Skill access
  setSkillAccess: (skillId: string, groupIds: string[]) =>
    restClient.put(`/api/user-groups/skills/${skillId}/access`, { group_ids: groupIds }),

  getSkillAccess: (skillId: string) =>
    restClient.get<{ group_ids: string[] }>(`/api/user-groups/skills/${skillId}/access`).then(r => r.group_ids),

  // MCP access
  setMcpAccess: (mcpId: string, groupIds: string[]) =>
    restClient.put(`/api/user-groups/mcp/${mcpId}/access`, { group_ids: groupIds }),

  getMcpAccess: (mcpId: string) =>
    restClient.get<{ group_ids: string[] }>(`/api/user-groups/mcp/${mcpId}/access`).then(r => r.group_ids),
};
