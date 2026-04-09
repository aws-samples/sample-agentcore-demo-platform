/**
 * ScopeMemoryPanel — Admin panel for managing scope memories.
 * Embedded in ScopeProfile alongside IM Channels and MCP Servers.
 */

import { useState } from 'react'
import { Brain, Pin, PinOff, Trash2, Plus, Search, X, Edit3, Check } from 'lucide-react'
import { useScopeMemories } from '@/services/useScopeMemories'

const CATEGORIES = ['lesson', 'decision', 'procedure', 'fact', 'custom'] as const
const CATEGORY_COLORS: Record<string, string> = {
  lesson: 'bg-blue-500/20 text-blue-400',
  decision: 'bg-purple-500/20 text-purple-400',
  procedure: 'bg-emerald-500/20 text-emerald-400',
  fact: 'bg-amber-500/20 text-amber-400',
  custom: 'bg-gray-500/20 text-gray-400',
}

interface ScopeMemoryPanelProps {
  scopeId: string
  scopeName?: string
}

export function ScopeMemoryPanel({ scopeId, scopeName }: ScopeMemoryPanelProps) {
  const { memories, isLoading, create, update, remove, load } = useScopeMemories(scopeId)
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | ''>('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ title: '', content: '', category: 'lesson', tags: '' })
  const [formData, setFormData] = useState({ title: '', content: '', category: 'lesson', tags: '', is_pinned: false })

  const handleSearch = () => {
    load({ q: searchQuery || undefined, category: filterCategory || undefined })
  }

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return
    await create({
      title: formData.title.trim(),
      content: formData.content.trim(),
      category: formData.category,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      is_pinned: formData.is_pinned,
    })
    setFormData({ title: '', content: '', category: 'lesson', tags: '', is_pinned: false })
    setShowForm(false)
  }

  const handleEdit = (m: typeof memories[0]) => {
    setEditingId(m.id)
    setEditData({ title: m.title, content: m.content, category: m.category, tags: m.tags.join(', ') })
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    await update(editingId, {
      title: editData.title.trim(),
      content: editData.content.trim(),
      category: editData.category,
      tags: editData.tags ? editData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    })
    setEditingId(null)
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-gray-400" />
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Scope Memory</h3>
          <span className="text-[10px] text-gray-600">{memories.length} entries</span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Memory
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search memories..."
            className="w-full pl-7 pr-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); setTimeout(handleSearch, 0) }}
          className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 focus:outline-none"
        >
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="mb-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg space-y-2">
          <input
            type="text"
            value={formData.title}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Memory title"
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 focus:outline-none"
          />
          <textarea
            value={formData.content}
            onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
            placeholder="What should this scope remember?"
            rows={3}
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <select
              value={formData.category}
              onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 focus:outline-none"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="text"
              value={formData.tags}
              onChange={e => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="Tags (comma-separated)"
              className="flex-1 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white focus:border-blue-500 focus:outline-none"
            />
            <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_pinned}
                onChange={e => setFormData(prev => ({ ...prev, is_pinned: e.target.checked }))}
                className="rounded"
              />
              Pin
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-white">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={!formData.title.trim() || !formData.content.trim()}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-40"
            >
              Save Memory
            </button>
          </div>
        </div>
      )}

      {/* Memory List */}
      {isLoading ? (
        <div className="py-6 text-center text-xs text-gray-500">Loading memories...</div>
      ) : memories.length === 0 ? (
        <div className="py-6 text-center">
          <Brain className="w-6 h-6 text-gray-700 mx-auto mb-1" />
          <p className="text-xs text-gray-500">No memories yet</p>
          <p className="text-[10px] text-gray-600 mt-0.5">
            Add knowledge that {scopeName || 'this scope'} should remember across sessions.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map(m => (
            <div key={m.id} className="p-2.5 bg-gray-800/50 border border-gray-700/50 rounded-lg group">
              {editingId === m.id ? (
                /* Edit mode */
                <div className="space-y-2">
                  <input
                    type="text" value={editData.title}
                    onChange={e => setEditData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                  <textarea
                    value={editData.content}
                    onChange={e => setEditData(prev => ({ ...prev, content: e.target.value }))}
                    rows={3}
                    className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <select
                      value={editData.category}
                      onChange={e => setEditData(prev => ({ ...prev, category: e.target.value }))}
                      className="px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      type="text" value={editData.tags}
                      onChange={e => setEditData(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="Tags (comma-separated)"
                      className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                    />
                    <button onClick={handleSaveEdit} className="px-2 py-1 text-xs bg-blue-600 text-white rounded"><Check className="w-3 h-3" /></button>
                    <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs text-gray-400"><X className="w-3 h-3" /></button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {m.is_pinned && <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                      <span className="text-sm font-medium text-white truncate">{m.title}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[m.category] || CATEGORY_COLORS.custom}`}>
                        {m.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => handleEdit(m)} className="p-1 text-gray-500 hover:text-white"><Edit3 className="w-3 h-3" /></button>
                      <button
                        onClick={() => update(m.id, { is_pinned: !m.is_pinned })}
                        className="p-1 text-gray-500 hover:text-amber-400"
                      >
                        {m.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                      </button>
                      <button onClick={() => remove(m.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{m.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {m.tags.map(t => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 bg-gray-700/50 text-gray-500 rounded">{t}</span>
                    ))}
                    <span className="text-[9px] text-gray-600 ml-auto">{timeAgo(m.created_at)}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
