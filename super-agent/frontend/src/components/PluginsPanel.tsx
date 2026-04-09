/**
 * PluginsPanel
 *
 * Slide-out panel for managing Claude Code plugins attached to the current
 * business scope. Users can view installed plugins, add new ones by git URL,
 * and remove existing ones. Plugins are cloned into session workspaces and
 * loaded by the SDK automatically.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  X, Loader2, Puzzle, Trash2, Plus, AlertCircle, GitBranch,
} from 'lucide-react'
import { restClient } from '@/services/api/restClient'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScopePlugin {
  id: string
  name: string
  git_url: string
  ref: string
  assigned_at: string
}

interface PluginsPanelProps {
  open: boolean
  onClose: () => void
  businessScopeId: string | null
}

// ---------------------------------------------------------------------------
// Well-known community plugins for quick-add
// ---------------------------------------------------------------------------

const POPULAR_PLUGINS = [
  {
    name: 'claude-mem',
    gitUrl: 'https://github.com/thedotmack/claude-mem.git',
    description: 'Persistent memory across sessions — auto-saves context, searchable recall.',
  },
  {
    name: 'superpowers',
    gitUrl: 'https://github.com/obra/superpowers.git',
    description: 'Skills framework for TDD, debugging, brainstorming, and subagent workflows.',
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PluginsPanel({ open, onClose, businessScopeId }: PluginsPanelProps) {
  const [plugins, setPlugins] = useState<ScopePlugin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Add-form state
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addGitUrl, setAddGitUrl] = useState('')
  const [addRef, setAddRef] = useState('main')
  const [adding, setAdding] = useState(false)

  // ── Load plugins ──
  const loadPlugins = useCallback(async () => {
    if (!businessScopeId) return
    setLoading(true)
    setError(null)
    try {
      const res = await restClient.get<{ data: ScopePlugin[] }>(
        `/api/business-scopes/${businessScopeId}/plugins`,
      )
      setPlugins(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins')
    } finally {
      setLoading(false)
    }
  }, [businessScopeId])

  useEffect(() => {
    if (open) void loadPlugins()
  }, [open, loadPlugins])

  // ── Add plugin ──
  const handleAdd = useCallback(async (name: string, gitUrl: string, ref: string) => {
    if (!businessScopeId || !name.trim() || !gitUrl.trim()) return
    setAdding(true)
    setError(null)
    try {
      await restClient.post(`/api/business-scopes/${businessScopeId}/plugins`, {
        name: name.trim(),
        gitUrl: gitUrl.trim(),
        ref: ref.trim() || 'main',
      })
      setShowAdd(false)
      setAddName('')
      setAddGitUrl('')
      setAddRef('main')
      await loadPlugins()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add plugin')
    } finally {
      setAdding(false)
    }
  }, [businessScopeId, loadPlugins])

  // ── Remove plugin ──
  const handleRemove = useCallback(async (pluginId: string) => {
    if (!businessScopeId) return
    setRemovingId(pluginId)
    setError(null)
    try {
      await restClient.delete(`/api/business-scopes/${businessScopeId}/plugins/${pluginId}`)
      await loadPlugins()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove plugin')
    } finally {
      setRemovingId(null)
    }
  }, [businessScopeId, loadPlugins])

  // ── Quick-add popular plugin ──
  const handleQuickAdd = useCallback((p: typeof POPULAR_PLUGINS[0]) => {
    void handleAdd(p.name, p.gitUrl, 'main')
  }, [handleAdd])

  const installedNames = new Set(plugins.map(p => p.name))

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-[420px] max-w-full h-full bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-violet-400" />
            <span className="text-sm font-semibold text-white">Plugins</span>
            <span className="text-xs text-gray-500">({plugins.length})</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-3 mt-2 px-3 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 truncate">{error}</span>
            <button onClick={() => setError(null)}><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Installed plugins */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Installed</span>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              </div>
            ) : plugins.length === 0 ? (
              <div className="text-center py-6">
                <Puzzle className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No plugins installed</p>
                <p className="text-xs text-gray-600 mt-1">Add a plugin to extend Claude Code capabilities</p>
              </div>
            ) : (
              <div className="space-y-2">
                {plugins.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-800/50 rounded-lg border border-gray-700/50 group">
                    <Puzzle className="w-4 h-4 text-violet-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{p.name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <GitBranch className="w-3 h-3" />
                        <span className="truncate">{p.ref}</span>
                        <span className="text-gray-600">·</span>
                        <span className="truncate">{p.git_url.replace(/^https?:\/\//, '').replace(/\.git$/, '')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(p.id)}
                      disabled={removingId === p.id}
                      className="p-1.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                      title="Remove plugin"
                    >
                      {removingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add plugin form */}
          {showAdd && (
            <div className="mx-4 mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
              <div className="text-xs font-medium text-gray-300 mb-2">Add Plugin</div>
              <div className="space-y-2">
                <input
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="Plugin name (e.g. claude-mem)"
                  className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <input
                  value={addGitUrl}
                  onChange={e => setAddGitUrl(e.target.value)}
                  placeholder="Git URL (e.g. https://github.com/user/plugin.git)"
                  className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <input
                  value={addRef}
                  onChange={e => setAddRef(e.target.value)}
                  placeholder="Branch / tag (default: main)"
                  className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleAdd(addName, addGitUrl, addRef)}
                    disabled={adding || !addName.trim() || !addGitUrl.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAdd(false); setAddName(''); setAddGitUrl(''); setAddRef('main') }}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Popular / recommended plugins */}
          <div className="px-4 py-3 border-t border-gray-800">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Popular Plugins</span>
            <div className="mt-3 space-y-2">
              {POPULAR_PLUGINS.map(p => {
                const installed = installedNames.has(p.name)
                return (
                  <div key={p.name} className="flex items-start gap-3 px-3 py-2.5 bg-gray-800/30 rounded-lg border border-gray-700/30">
                    <Puzzle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{p.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{p.description}</div>
                    </div>
                    {installed ? (
                      <span className="text-xs text-green-400 px-2 py-1 bg-green-500/10 rounded">Added</span>
                    ) : (
                      <button
                        onClick={() => handleQuickAdd(p)}
                        disabled={adding}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-600 mt-3">
              Added plugins will be git-cloned into the workspace and loaded by Claude Code when you start a new chat session or send the next message.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
