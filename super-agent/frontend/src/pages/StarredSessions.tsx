/**
 * StarredSessions — "明星案例" / Favorites page.
 *
 * Two view modes:
 *   - By Scope: sessions grouped by business scope
 *   - By Category: sessions grouped by star_category label
 *
 * Admin/Owner sees all starred sessions; regular users see only their own.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Star, MessageSquare, Clock, Briefcase, Loader2, Search,
  Pencil, Tag, LayoutGrid, ChevronDown, ChevronRight, X,
} from 'lucide-react'
import { restClient } from '@/services/api/restClient'

const PRESET_CATEGORIES = [
  { value: 'showcase', label: '客户演示', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'best-practice', label: '最佳实践', color: 'bg-emerald-500/20 text-emerald-400' },
  { value: 'training', label: '培训教材', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'template', label: '可复用模板', color: 'bg-amber-500/20 text-amber-400' },
]

const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  PRESET_CATEGORIES.map(c => [c.value, c.color])
)

interface StarredSession {
  id: string
  title: string | null
  status: string
  user_id: string
  starred_at: string | null
  starred_by: string | null
  star_category: string | null
  created_at: string
  updated_at: string
  business_scope?: { id: string; name: string; icon: string | null } | null
}

type ViewMode = 'scope' | 'category'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function CategoryBadge({ category, onClick }: { category: string | null; onClick?: (e: React.MouseEvent) => void }) {
  if (!category) return null
  const color = CATEGORY_COLOR[category] ?? 'bg-gray-500/20 text-gray-400'
  const label = PRESET_CATEGORIES.find(c => c.value === category)?.label ?? category
  return (
    <span
      onClick={onClick}
      className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${color} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
    >
      {label}
    </span>
  )
}

function CategoryPicker({ sessionId, current, onUpdate }: {
  sessionId: string
  current: string | null
  onUpdate: (id: string, cat: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = async (cat: string | null) => {
    try {
      await restClient.put(`/api/chat/sessions/${sessionId}/star-category`, { category: cat })
      onUpdate(sessionId, cat)
    } catch (err) {
      console.error('Failed to update category:', err)
    }
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
        title="Set category"
      >
        <Tag className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1">
          {PRESET_CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => handleSelect(cat.value)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                current === cat.value ? 'text-white' : 'text-gray-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${cat.color.split(' ')[0]}`} />
              {cat.label}
              {current === cat.value && <span className="ml-auto text-blue-400">✓</span>}
            </button>
          ))}
          {current && (
            <>
              <div className="border-t border-gray-700 my-1" />
              <button
                onClick={() => handleSelect(null)}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2"
              >
                <X className="w-3 h-3" /> Remove category
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function StarredSessions() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<StarredSession[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('scope')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const loadStarred = useCallback(async () => {
    setLoading(true)
    try {
      const res = await restClient.get<{ data: StarredSession[] }>('/api/chat/sessions/starred')
      setSessions(res.data || [])
    } catch (err) {
      console.error('Failed to load starred sessions:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStarred() }, [loadStarred])

  const handleUnstar = async (sessionId: string) => {
    try {
      await restClient.put(`/api/chat/sessions/${sessionId}/unstar`, {})
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (err) {
      console.error('Failed to unstar:', err)
    }
  }

  const handleCategoryUpdate = (sessionId: string, category: string | null) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, star_category: category } : s))
  }

  const handleStartRename = (sessionId: string, currentTitle: string | null, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(sessionId)
    setEditTitle(currentTitle || '')
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const handleSaveRename = async () => {
    if (!editingId) return
    const trimmed = editTitle.trim()
    if (trimmed) {
      try {
        await restClient.put(`/api/chat/sessions/${editingId}`, { title: trimmed })
        setSessions(prev => prev.map(s => s.id === editingId ? { ...s, title: trimmed } : s))
      } catch (err) {
        console.error('Failed to rename:', err)
      }
    }
    setEditingId(null)
  }

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Filter
  const filtered = searchQuery.trim()
    ? sessions.filter(s =>
        (s.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.business_scope?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.star_category ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sessions

  // Group
  const grouped = useMemo(() => {
    const map = new Map<string, StarredSession[]>()
    for (const s of filtered) {
      const key = viewMode === 'scope'
        ? (s.business_scope?.name ?? '未分类')
        : (PRESET_CATEGORIES.find(c => c.value === s.star_category)?.label ?? s.star_category ?? '未分类')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [filtered, viewMode])

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <Star className="w-6 h-6 text-yellow-400" fill="currentColor" />
          <h1 className="text-xl font-semibold text-white">明星案例</h1>
          <span className="text-sm text-gray-500">{sessions.length} starred</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search starred sessions..."
              className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-600"
            />
          </div>
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-0.5 border border-gray-800">
            <button
              onClick={() => setViewMode('scope')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'scope' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> By Scope
            </button>
            <button
              onClick={() => setViewMode('category')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'category' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Tag className="w-3.5 h-3.5" /> By Category
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Loading...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Star className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No starred sessions yet</p>
            <p className="text-xs text-gray-600 mt-1">Star a chat session to save it as a showcase case.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {[...grouped.entries()].map(([groupName, items]) => {
              const isCollapsed = collapsedGroups.has(groupName)
              return (
                <div key={groupName}>
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {viewMode === 'scope' && <Briefcase className="w-3.5 h-3.5 text-gray-500" />}
                    {viewMode === 'category' && <Tag className="w-3.5 h-3.5 text-gray-500" />}
                    {groupName}
                    <span className="text-xs text-gray-600">({items.length})</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-2 ml-6">
                      {items.map(session => (
                        <div
                          key={session.id}
                          onClick={() => navigate(`/chat?session=${session.id}`)}
                          className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <MessageSquare className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                {editingId === session.id ? (
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <input
                                      ref={editInputRef}
                                      type="text"
                                      value={editTitle}
                                      onChange={e => setEditTitle(e.target.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveRename()
                                        if (e.key === 'Escape') setEditingId(null)
                                      }}
                                      onBlur={handleSaveRename}
                                      className="w-full px-2 py-1 bg-gray-900 border border-blue-500 rounded text-sm text-white focus:outline-none"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="text-sm font-medium text-white truncate"
                                      onDoubleClick={(e) => handleStartRename(session.id, session.title, e)}
                                      title="Double-click to rename"
                                    >
                                      {session.title || 'Untitled chat'}
                                    </span>
                                    <button
                                      onClick={(e) => handleStartRename(session.id, session.title, e)}
                                      className="p-0.5 rounded text-gray-600 hover:text-white opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                                      title="Rename"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                                  {viewMode === 'category' && session.business_scope && (
                                    <span className="flex items-center gap-1">
                                      <Briefcase className="w-3 h-3" />
                                      {session.business_scope.icon ?? '📁'} {session.business_scope.name}
                                    </span>
                                  )}
                                  {viewMode === 'scope' && session.star_category && (
                                    <CategoryBadge category={session.star_category} />
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(session.created_at)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <CategoryPicker
                                sessionId={session.id}
                                current={session.star_category}
                                onUpdate={handleCategoryUpdate}
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleUnstar(session.id) }}
                                className="p-1 rounded text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 transition-colors"
                                title="Unstar"
                              >
                                <Star className="w-3.5 h-3.5" fill="currentColor" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
