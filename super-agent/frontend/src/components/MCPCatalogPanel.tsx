/**
 * MCPCatalogPanel
 *
 * Right slide-out panel for browsing and installing MCP servers from the catalog,
 * or adding a custom MCP server with a user-provided JSON config.
 */

import { useState, useMemo, useCallback } from 'react'
import {
  X, Search, Server, Cloud, Plus, Loader2, ExternalLink, Check, PenLine,
} from 'lucide-react'
import { MCP_SERVER_CATALOG, type McpServerEntry } from '@/data/mcp-servers'

export interface CustomMcpServer {
  name: string
  description: string
  scopeConfig: Record<string, unknown>
}

interface MCPCatalogPanelProps {
  open: boolean
  onClose: () => void
  installedNames: Set<string>
  onInstall: (entry: McpServerEntry) => Promise<void>
  /** Called when the user adds a custom (non-catalog) MCP server */
  onCustomInstall?: (server: CustomMcpServer) => Promise<void>
}

const CUSTOM_CONFIG_PLACEHOLDER = JSON.stringify({
  mcpServers: {
    'my-server': {
      command: 'npx',
      args: ['-y', 'my-mcp-server'],
      env: {},
      disabled: false,
      autoApprove: [],
    },
  },
}, null, 2)

export function MCPCatalogPanel({ open, onClose, installedNames, onInstall, onCustomInstall }: MCPCatalogPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [installingId, setInstallingId] = useState<string | null>(null)

  // Custom server form state
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [customConfig, setCustomConfig] = useState('')
  // Track whether the name was auto-detected (vs manually typed)
  const [nameAutoDetected, setNameAutoDetected] = useState(true)
  const [customAdding, setCustomAdding] = useState(false)
  const [customError, setCustomError] = useState<string | null>(null)

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return MCP_SERVER_CATALOG
    return MCP_SERVER_CATALOG.filter(entry =>
      entry.name.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.tags.some(t => t.toLowerCase().includes(q)) ||
      entry.author?.toLowerCase().includes(q),
    )
  }, [searchQuery])

  const handleInstall = useCallback(async (entry: McpServerEntry) => {
    setInstallingId(entry.id)
    try { await onInstall(entry) }
    finally { setInstallingId(null) }
  }, [onInstall])

  const handleCustomAdd = useCallback(async () => {
    if (!customName.trim()) { setCustomError('Server name is required'); return }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(customConfig || '{}')
    } catch {
      setCustomError('Invalid JSON — please check syntax')
      return
    }
    setCustomError(null)
    setCustomAdding(true)
    try {
      await onCustomInstall?.({ name: customName.trim(), description: customDesc.trim(), scopeConfig: parsed })
      setShowCustom(false)
      setCustomName('')
      setCustomDesc('')
      setCustomConfig('')
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : 'Failed to add server')
    } finally { setCustomAdding(false) }
  }, [customName, customDesc, customConfig, onCustomInstall])

  const resetCustomForm = () => {
    setShowCustom(false); setCustomName(''); setCustomDesc(''); setCustomConfig(''); setCustomError(null); setNameAutoDetected(true)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-[480px] max-w-full h-full bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Browse MCP Servers</span>
            <span className="text-xs text-gray-500">({filteredCatalog.length})</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search + Custom toggle */}
        <div className="px-5 py-3 border-b border-gray-800 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search servers by name, tag, or description..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {onCustomInstall && !showCustom && (
            <button
              onClick={() => setShowCustom(true)}
              className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <PenLine className="w-3.5 h-3.5" />
              Add custom MCP server
            </button>
          )}
        </div>

        {/* Custom server form */}
        {showCustom && (
          <div className="px-5 py-3 border-b border-gray-800 bg-gray-800/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300">Custom MCP Server</span>
              <button onClick={resetCustomForm} className="text-[10px] text-gray-500 hover:text-gray-300">Cancel</button>
            </div>
            <input
              value={customName}
              onChange={e => { setCustomName(e.target.value); setNameAutoDetected(false) }}
              placeholder="Server name (e.g. my-custom-server)"
              className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
            <input
              value={customDesc}
              onChange={e => setCustomDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
            <textarea
              value={customConfig}
              onChange={e => {
                const val = e.target.value
                setCustomConfig(val)
                setCustomError(null)
                // Auto-detect server name from pasted mcpServers JSON
                try {
                  const parsed = JSON.parse(val)
                  if (parsed?.mcpServers && typeof parsed.mcpServers === 'object') {
                    const keys = Object.keys(parsed.mcpServers)
                    if (keys.length === 1 && nameAutoDetected) {
                      setCustomName(keys[0])
                    }
                  }
                } catch { /* ignore parse errors while typing */ }
              }}
              placeholder={CUSTOM_CONFIG_PLACEHOLDER}
              rows={8}
              className="w-full px-3 py-2 text-xs bg-gray-900 border border-gray-700 rounded text-white font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-y"
              spellCheck={false}
            />
            {customError && (
              <p className="text-xs text-red-400">{customError}</p>
            )}
            <button
              onClick={handleCustomAdd}
              disabled={customAdding || !customName.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
            >
              {customAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add to scope
            </button>
          </div>
        )}

        {/* Catalog list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filteredCatalog.length === 0 ? (
            <div className="text-center py-10">
              <Search className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No servers match "{searchQuery}"</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCatalog.map(entry => {
                const installed = installedNames.has(entry.name)
                const installing = installingId === entry.id
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 px-4 py-3 bg-gray-800/40 rounded-lg border border-gray-700/40 hover:border-gray-600/60 transition-colors"
                  >
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
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{entry.description}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {entry.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/60 text-gray-400">
                            {tag}
                          </span>
                        ))}
                        {entry.marketplaceUrl && (
                          <a
                            href={entry.marketplaceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-cyan-500 hover:text-cyan-400 ml-auto"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            Docs
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 mt-0.5">
                      {installed ? (
                        <span className="flex items-center gap-1 text-xs text-green-400 px-2.5 py-1 bg-green-500/10 rounded">
                          <Check className="w-3 h-3" />
                          Installed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleInstall(entry)}
                          disabled={installing}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50"
                        >
                          {installing
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Plus className="w-3 h-3" />
                          }
                          Install
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-600">
            Click Install to add a server, then configure it from the server list.
          </p>
        </div>
      </div>
    </div>
  )
}
