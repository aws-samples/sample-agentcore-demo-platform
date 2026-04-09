/**
 * MCPServersPanel
 *
 * Slide-out panel for managing MCP servers within a chat session.
 * Shows installed servers, a searchable catalog of community + AWS servers,
 * and allows adding/removing servers at the session level.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  X, Loader2, Server, Trash2, Plus, AlertCircle, Wifi, Terminal,
  Search, ExternalLink, Cloud,
} from 'lucide-react'
import { restClient } from '@/services/api/restClient'
import { MCP_SERVER_CATALOG, type McpServerEntry } from '@/data/mcp-servers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionMcpServer {
  name: string
  type?: string
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
}

interface MCPServersPanelProps {
  open: boolean
  onClose: () => void
  sessionId: string | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MCPServersPanel({ open, onClose, sessionId }: MCPServersPanelProps) {
  const [servers, setServers] = useState<SessionMcpServer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removingName, setRemovingName] = useState<string | null>(null)
  const [addingName, setAddingName] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Add-form state
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addType, setAddType] = useState<'stdio' | 'sse'>('stdio')
  const [addCommand, setAddCommand] = useState('')
  const [addArgs, setAddArgs] = useState('')
  const [addUrl, setAddUrl] = useState('')
  const [adding, setAdding] = useState(false)

  // ── Load servers ──
  const loadServers = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    try {
      const res = await restClient.get<{ servers: SessionMcpServer[] }>(
        `/api/chat/sessions/${sessionId}/mcp-servers`,
      )
      setServers(res.servers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP servers')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (open) { void loadServers(); setSearchQuery('') }
  }, [open, loadServers])

  // ── Add server ──
  const handleAdd = useCallback(async (name: string, config: Record<string, unknown>) => {
    if (!sessionId || !name.trim()) return
    setAdding(true)
    setError(null)
    try {
      await restClient.put(`/api/chat/sessions/${sessionId}/mcp-servers`, {
        name: name.trim(),
        config,
      })
      setShowAdd(false)
      setAddName('')
      setAddCommand('')
      setAddArgs('')
      setAddUrl('')
      await loadServers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add MCP server')
    } finally {
      setAdding(false)
      setAddingName(null)
    }
  }, [sessionId, loadServers])

  // ── Remove server ──
  const handleRemove = useCallback(async (name: string) => {
    if (!sessionId) return
    setRemovingName(name)
    setError(null)
    try {
      await restClient.delete(`/api/chat/sessions/${sessionId}/mcp-servers/${encodeURIComponent(name)}`)
      await loadServers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove MCP server')
    } finally {
      setRemovingName(null)
    }
  }, [sessionId, loadServers])

  // ── Quick-add from catalog ──
  const handleQuickAdd = useCallback((entry: McpServerEntry) => {
    if (!entry.config) return
    setAddingName(entry.name)
    void handleAdd(entry.name, entry.config)
  }, [handleAdd])

  // ── Submit custom form ──
  const handleCustomAdd = useCallback(() => {
    if (!addName.trim()) return
    if (addType === 'stdio') {
      const args = addArgs.trim() ? addArgs.trim().split(/\s+/) : undefined
      void handleAdd(addName, { type: 'stdio', command: addCommand.trim(), ...(args ? { args } : {}) })
    } else {
      void handleAdd(addName, { type: 'sse', url: addUrl.trim() })
    }
  }, [addName, addType, addCommand, addArgs, addUrl, handleAdd])

  const installedNames = useMemo(() => new Set(servers.map(s => s.name)), [servers])

  // ── Filter catalog by search ──
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return MCP_SERVER_CATALOG
    return MCP_SERVER_CATALOG.filter(entry =>
      entry.name.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.tags.some(t => t.toLowerCase().includes(q)) ||
      (entry.author?.toLowerCase().includes(q))
    )
  }, [searchQuery])

  const getTypeLabel = (server: SessionMcpServer): string => {
    if (server.type) return server.type.toUpperCase()
    if (server.url) return 'SSE'
    return 'STDIO'
  }

  const getServerDetail = (server: SessionMcpServer): string => {
    if (server.url) return server.url
    if (server.command) {
      const args = server.args?.join(' ') ?? ''
      return `${server.command} ${args}`.trim()
    }
    return ''
  }

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
            <Server className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-semibold text-white">MCP Servers</span>
            <span className="text-xs text-gray-500">({servers.length})</span>
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
          {/* Installed servers */}
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
            ) : servers.length === 0 ? (
              <div className="text-center py-6">
                <Server className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No MCP servers in this session</p>
                <p className="text-xs text-gray-600 mt-1">Add servers to extend agent capabilities</p>
              </div>
            ) : (
              <div className="space-y-2">
                {servers.map(s => (
                  <div key={s.name} className="flex items-center gap-3 px-3 py-2.5 bg-gray-800/50 rounded-lg border border-gray-700/50 group">
                    {s.type === 'sse' || s.type === 'http' || s.url
                      ? <Wifi className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      : <Terminal className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{s.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 font-mono">
                          {getTypeLabel(s)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {getServerDetail(s)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(s.name)}
                      disabled={removingName === s.name}
                      className="p-1.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                      title="Remove from session"
                    >
                      {removingName === s.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add server form */}
          {showAdd && (
            <div className="mx-4 mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
              <div className="text-xs font-medium text-gray-300 mb-2">Add MCP Server</div>
              <div className="space-y-2">
                <input
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  placeholder="Server name (e.g. my-server)"
                  className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddType('stdio')}
                    className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                      addType === 'stdio'
                        ? 'bg-cyan-600/20 border-cyan-500/50 text-cyan-400'
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Terminal className="w-3 h-3 inline mr-1" />
                    STDIO
                  </button>
                  <button
                    onClick={() => setAddType('sse')}
                    className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                      addType === 'sse'
                        ? 'bg-cyan-600/20 border-cyan-500/50 text-cyan-400'
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Wifi className="w-3 h-3 inline mr-1" />
                    SSE / HTTP
                  </button>
                </div>
                {addType === 'stdio' ? (
                  <>
                    <input
                      value={addCommand}
                      onChange={e => setAddCommand(e.target.value)}
                      placeholder="Command (e.g. npx)"
                      className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      value={addArgs}
                      onChange={e => setAddArgs(e.target.value)}
                      placeholder="Arguments (space-separated, e.g. -y @org/server)"
                      className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </>
                ) : (
                  <input
                    value={addUrl}
                    onChange={e => setAddUrl(e.target.value)}
                    placeholder="Server URL (e.g. http://localhost:8080/sse)"
                    className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleCustomAdd}
                    disabled={adding || !addName.trim() || (addType === 'stdio' ? !addCommand.trim() : !addUrl.trim())}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAdd(false); setAddName(''); setAddCommand(''); setAddArgs(''); setAddUrl('') }}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Catalog with search ── */}
          <div className="px-4 py-3 border-t border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Browse Servers
              </span>
              <span className="text-[10px] text-gray-600">{filteredCatalog.length} servers</span>
            </div>

            {/* Search input */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search MCP servers..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Server list */}
            <div className="space-y-2">
              {filteredCatalog.length === 0 ? (
                <div className="text-center py-6">
                  <Search className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No servers match "{searchQuery}"</p>
                </div>
              ) : (
                filteredCatalog.map(entry => {
                  const installed = installedNames.has(entry.name)
                  return (
                    <div key={entry.id} className="flex items-start gap-3 px-3 py-2.5 bg-gray-800/30 rounded-lg border border-gray-700/30">
                      {entry.source === 'aws'
                        ? <Cloud className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                        : <Server className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{entry.name}</span>
                          {entry.source === 'aws' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-medium flex-shrink-0">
                              AWS
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{entry.description}</div>
                        {entry.marketplaceUrl && (
                          <a
                            href={entry.marketplaceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-cyan-500 hover:text-cyan-400 mt-1"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            View docs
                          </a>
                        )}
                      </div>
                      {installed ? (
                        <span className="text-xs text-green-400 px-2 py-1 bg-green-500/10 rounded flex-shrink-0">Added</span>
                      ) : entry.config ? (
                        <button
                          onClick={() => handleQuickAdd(entry)}
                          disabled={addingName === entry.name}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          {addingName === entry.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Add
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-600 px-2 py-1 flex-shrink-0">Managed</span>
                      )}
                    </div>
                  )
                })
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-600">
            MCP servers added here apply to this session only. Changes take effect on the next message.
          </p>
        </div>
      </div>
    </div>
  )
}
