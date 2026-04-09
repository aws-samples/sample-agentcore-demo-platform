/**
 * REST Document Group Service
 * API client for document group CRUD, file management, and scope assignment.
 */

import { restClient } from './restClient'

export interface DocGroup {
  id: string
  organization_id: string
  name: string
  description: string | null
  storage_path: string
  created_at: string
  updated_at: string
  _count?: { files: number }
}

export interface DocGroupFile {
  id: string
  document_group_id: string
  original_filename: string
  stored_filename: string
  file_size: number
  mime_type: string
  uploaded_by: string | null
  created_at: string
}

export interface ScopeDocGroupAssignment {
  id: string
  business_scope_id: string
  document_group_id: string
  created_at: string
  document_group: DocGroup & { _count: { files: number } }
}

export const restDocGroupService = {
  // ── Group CRUD ──
  async listGroups(): Promise<DocGroup[]> {
    const res = await restClient.get<{ data: DocGroup[] }>('/api/document-groups')
    return res.data
  },

  async createGroup(data: { name: string; description?: string }): Promise<DocGroup> {
    const res = await restClient.post<{ data: DocGroup }>('/api/document-groups', data)
    return res.data
  },

  async updateGroup(id: string, data: { name?: string; description?: string }): Promise<DocGroup> {
    const res = await restClient.put<{ data: DocGroup }>(`/api/document-groups/${id}`, data)
    return res.data
  },

  async deleteGroup(id: string): Promise<void> {
    await restClient.delete(`/api/document-groups/${id}`)
  },

  // ── Files ──
  async listFiles(groupId: string): Promise<DocGroupFile[]> {
    const res = await restClient.get<{ data: DocGroupFile[] }>(`/api/document-groups/${groupId}/files`)
    return res.data
  },

  async uploadFile(groupId: string, file: File): Promise<DocGroupFile> {
    const formData = new FormData()
    formData.append('file', file)

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
    const { getValidToken } = await import('@/services/auth')
    const token = await getValidToken()

    const response = await fetch(`${API_BASE_URL}/api/document-groups/${groupId}/files`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(err.error || 'Upload failed')
    }

    const res = await response.json()
    return res.data
  },

  async deleteFile(groupId: string, fileId: string): Promise<void> {
    await restClient.delete(`/api/document-groups/${groupId}/files/${fileId}`)
  },

  // ── Scope assignments ──
  async listScopeAssignments(scopeId: string): Promise<ScopeDocGroupAssignment[]> {
    const res = await restClient.get<{ data: ScopeDocGroupAssignment[] }>(
      `/api/business-scopes/${scopeId}/document-groups`,
    )
    return res.data
  },

  async assignToScope(scopeId: string, groupId: string): Promise<ScopeDocGroupAssignment> {
    const res = await restClient.post<{ data: ScopeDocGroupAssignment }>(
      `/api/business-scopes/${scopeId}/document-groups`,
      { document_group_id: groupId },
    )
    return res.data
  },

  async unassignFromScope(scopeId: string, assignmentId: string): Promise<void> {
    await restClient.delete(`/api/business-scopes/${scopeId}/document-groups/${assignmentId}`)
  },
}
