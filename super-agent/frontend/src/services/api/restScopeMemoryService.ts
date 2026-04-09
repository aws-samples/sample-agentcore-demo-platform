/**
 * REST Scope Memory Service
 * API client for scope memory CRUD and summarization.
 */

import { restClient } from './restClient'

export interface ScopeMemory {
  id: string
  organization_id: string
  business_scope_id: string
  session_id: string | null
  title: string
  content: string
  category: string
  tags: string[]
  is_pinned: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ScopeMemoryDraft {
  title: string
  content: string
  category: string
  tags: string[]
  session_id?: string
}

const base = (scopeId: string) => `/api/business-scopes/${scopeId}/memories`

export const restScopeMemoryService = {
  async list(scopeId: string, params?: { category?: string; q?: string; pinned?: boolean }) {
    const query = new URLSearchParams()
    if (params?.category) query.set('category', params.category)
    if (params?.q) query.set('q', params.q)
    if (params?.pinned !== undefined) query.set('pinned', String(params.pinned))
    const qs = query.toString()
    const res = await restClient.get(`${base(scopeId)}${qs ? `?${qs}` : ''}`)
    return (res as { data: ScopeMemory[] }).data
  },

  async create(scopeId: string, data: {
    title: string; content: string; category?: string;
    tags?: string[]; is_pinned?: boolean; session_id?: string
  }) {
    const res = await restClient.post(base(scopeId), data)
    return (res as { data: ScopeMemory }).data
  },

  async update(scopeId: string, memoryId: string, data: {
    title?: string; content?: string; category?: string;
    tags?: string[]; is_pinned?: boolean
  }) {
    const res = await restClient.put(`${base(scopeId)}/${memoryId}`, data)
    return (res as { data: ScopeMemory }).data
  },

  async remove(scopeId: string, memoryId: string) {
    await restClient.delete(`${base(scopeId)}/${memoryId}`)
  },

  async summarize(scopeId: string, sessionId: string) {
    const res = await restClient.post(`${base(scopeId)}/summarize`, { session_id: sessionId })
    return (res as { data: ScopeMemoryDraft }).data
  },
}
