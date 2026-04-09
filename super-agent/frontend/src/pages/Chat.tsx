import { useState, useCallback, useEffect, useRef, useContext, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, ChevronDown, AlertCircle, X, Bot, Layers, MessageSquare, File as FileIcon, Save, Eye, Pencil, Square, Paperclip, Upload, Trash2, Globe, Rocket, RefreshCw, ExternalLink, Brain, Download, Users } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { useTranslation } from '@/i18n'
import { MessageList, QuickQuestions, WorkspaceExplorer } from '@/components'
import type { FileNode } from '@/components/WorkspaceExplorer'
import { SessionHistoryPanel } from '@/components/chat/SessionHistoryPanel'
import { SaveToMemoryModal } from '@/components/chat/SaveToMemoryModal'
import { WorkspaceActions } from '@/components/WorkspaceActions'
import { ChatProvider, ChatContext } from '@/services/ChatContext'
import { AgentService } from '@/services/agentService'
import { BusinessScopeService, type BusinessScope } from '@/services/businessScopeService'
import { RestChatRoomService } from '@/services/api/restChatRoomService'
import type { QuickQuestion, Agent } from '@/types'
import { getAvatarDisplayUrl, getAvatarFallback, shouldShowAvatarImage } from '@/utils/avatarUtils'
import { restClient } from '@/services/api/restClient'

// ============================================================================
// File Tab types & viewer
// ============================================================================

interface FileTab {
  id: string       // unique key (path)
  name: string     // display name
  path: string     // workspace-relative path or published app URL
  kind?: 'file' | 'preview' | 'published-preview'
}

const PREVIEWABLE_EXTENSIONS = new Set(['md', 'markdown', 'html', 'htm'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'])

function getFileExtension(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot >= 0 ? path.slice(dot + 1).toLowerCase() : ''
}

/** Map common file extensions to highlight.js language identifiers */
const EXT_TO_LANG: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript',
  py: 'python', pyw: 'python',
  rb: 'ruby', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin', kts: 'kotlin',
  cs: 'csharp', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
  swift: 'swift', m: 'objectivec', mm: 'objectivec',
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini', ini: 'ini',
  xml: 'xml', html: 'xml', htm: 'xml', svg: 'xml',
  css: 'css', scss: 'scss', less: 'less', sass: 'scss',
  sql: 'sql', graphql: 'graphql', gql: 'graphql',
  md: 'markdown', markdown: 'markdown',
  dockerfile: 'dockerfile', docker: 'dockerfile',
  makefile: 'makefile', cmake: 'cmake',
  lua: 'lua', r: 'r', php: 'php', pl: 'perl', pm: 'perl',
  ex: 'elixir', exs: 'elixir', erl: 'erlang',
  hs: 'haskell', scala: 'scala', clj: 'clojure',
  prisma: 'prisma', proto: 'protobuf', tf: 'hcl',
  vue: 'xml', svelte: 'xml',
}

function getLanguageForExt(ext: string): string | undefined {
  return EXT_TO_LANG[ext]
}

/** Highlight code content using highlight.js. Returns HTML string. */
function useHighlightedCode(code: string | null, ext: string): string {
  return useMemo(() => {
    if (!code) return ''
    const lang = getLanguageForExt(ext)
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      // Auto-detect as fallback
      return hljs.highlightAuto(code).value
    } catch {
      return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
  }, [code, ext])
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none text-sm text-gray-300 leading-relaxed
      [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-6 [&_h1]:mb-3
      [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-5 [&_h2]:mb-2
      [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-4 [&_h3]:mb-2
      [&_strong]:text-white [&_strong]:font-semibold
      [&_a]:text-blue-400 [&_a]:underline
      [&_hr]:border-gray-700 [&_hr]:my-4
      [&_li]:text-gray-300
      [&_code]:bg-gray-800 [&_code]:text-green-400 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm
      [&_pre]:bg-gray-900 [&_pre]:border [&_pre]:border-gray-700 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:my-3 [&_pre]:overflow-x-auto
      [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-gray-300
      [&_table]:border-collapse [&_table]:border [&_table]:border-gray-600 [&_table]:my-3 [&_table]:text-sm [&_table]:w-full
      [&_th]:border [&_th]:border-gray-600 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-white [&_th]:bg-gray-800
      [&_td]:border [&_td]:border-gray-700 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-gray-300
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

function HtmlPreview({ content }: { content: string }) {
  return (
    <iframe
      srcDoc={content}
      className="w-full h-full border-0 bg-white rounded"
      sandbox="allow-scripts"
      title="HTML Preview"
    />
  )
}

function FileViewerTab({ path, sessionId }: { path: string; sessionId: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [editContent, setEditContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit' | 'preview'>('view')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const ext = getFileExtension(path)
  const canPreview = PREVIEWABLE_EXTENSIONS.has(ext)
  const isImage = IMAGE_EXTENSIONS.has(ext)
  const highlightedHtml = useHighlightedCode(content, ext)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    if (isImage) {
      // Fetch as blob for images
      const token = localStorage.getItem('local_auth_token') || localStorage.getItem('cognito_id_token')
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
      fetch(`${baseUrl}/api/chat/sessions/${sessionId}/workspace/file/raw?path=${encodeURIComponent(path)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to load image')
          return res.blob()
        })
        .then(blob => {
          if (!cancelled) setImageUrl(URL.createObjectURL(blob))
        })
        .catch(() => {
          if (!cancelled) setContent('Failed to load image')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => { cancelled = true }
    }

    restClient.get<{ content: string }>(
      `/api/chat/sessions/${sessionId}/workspace/file?path=${encodeURIComponent(path)}`
    ).then(res => {
      if (!cancelled) {
        setContent(res.content)
        setEditContent(res.content)
        setDirty(false)
      }
    }).catch(() => {
      if (!cancelled) setContent('Failed to load file')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [path, sessionId])

  // Clean up image object URL on unmount or path change
  useEffect(() => {
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl) }
  }, [imageUrl])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await restClient.put(`/api/chat/sessions/${sessionId}/workspace/file`, {
        path,
        content: editContent,
      })
      setContent(editContent)
      setDirty(false)
    } catch {
      // Could show a toast, but for now just stop the spinner
    } finally {
      setSaving(false)
    }
  }, [sessionId, path, editContent])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }, [handleSave])

  const handleDownload = useCallback(() => {
    const fileName = path.split('/').pop() ?? 'file'
    if (isImage && imageUrl) {
      const a = document.createElement('a')
      a.href = imageUrl
      a.download = fileName
      a.click()
    } else if (content !== null) {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    }
  }, [path, isImage, imageUrl, content])

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-500">Loading...</div>
  }

  // Image files — render as image, no edit/preview toolbar
  if (isImage) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-800 bg-gray-900/60 text-xs">
          <div className="flex-1" />
          <button
            onClick={handleDownload}
            disabled={!imageUrl}
            className="flex items-center gap-1 px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            <Download className="w-3 h-3" /> Download
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center overflow-auto p-4">
          {imageUrl ? (
            <img src={imageUrl} alt={path} className="max-w-full max-h-full object-contain rounded" />
          ) : (
            <span className="text-gray-500">Failed to load image</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-800 bg-gray-900/60 text-xs">
        <button
          onClick={() => setMode('view')}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${mode === 'view' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Eye className="w-3 h-3" /> View
        </button>
        <button
          onClick={() => { setMode('edit'); setEditContent(dirty ? editContent : content ?? '') }}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${mode === 'edit' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        {canPreview && (
          <button
            onClick={() => setMode('preview')}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${mode === 'preview' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Eye className="w-3 h-3" /> Preview
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={handleDownload}
          disabled={content === null}
          className="flex items-center gap-1 px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-40"
        >
          <Download className="w-3 h-3" /> Download
        </button>
        {mode === 'edit' && (
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              dirty ? 'bg-blue-600 text-white hover:bg-blue-500' : 'text-gray-500 cursor-default'
            }`}
          >
            <Save className="w-3 h-3" />
            {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
          </button>
        )}
      </div>

      {/* Content area */}
      {mode === 'edit' ? (
        <textarea
          value={editContent}
          onChange={e => { setEditContent(e.target.value); setDirty(e.target.value !== content) }}
          onKeyDown={handleKeyDown}
          className="flex-1 w-full p-4 bg-gray-950 text-sm text-gray-300 font-mono leading-relaxed resize-none outline-none border-none"
          spellCheck={false}
        />
      ) : mode === 'preview' && canPreview ? (
        <div className="flex-1 overflow-auto p-4">
          {ext === 'html' || ext === 'htm' ? (
            <HtmlPreview content={dirty ? editContent : content ?? ''} />
          ) : (
            <MarkdownPreview content={dirty ? editContent : content ?? ''} />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <pre className="hljs text-sm font-mono leading-relaxed p-4 m-0"><code dangerouslySetInnerHTML={{ __html: highlightedHtml }} /></pre>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// App Preview Tab — live iframe preview of generated apps
// ============================================================================

const PREVIEWABLE_APP_FILES = new Set(['index.html', 'index.htm', 'app.html'])

function isPreviewableFile(name: string): boolean {
  const lower = name.toLowerCase()
  return PREVIEWABLE_APP_FILES.has(lower) || lower.endsWith('.html') || lower.endsWith('.htm')
}

function AppPreviewTab({ path, sessionId }: { path: string; sessionId: string }) {
  const [refreshCount, setRefreshCount] = useState(0)
  const [status, setStatus] = useState<'starting' | 'running' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')
  const token = localStorage.getItem('local_auth_token') || localStorage.getItem('cognito_id_token')
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

  // Determine if this is a Vite/React app (has package.json sibling) or plain HTML
  // For now, always try dev server first; fall back to raw file serving
  const [useDevServer, setUseDevServer] = useState(true)

  // Start dev server on mount
  useEffect(() => {
    if (!useDevServer) {
      setStatus('running')
      return
    }
    let cancelled = false
    setStatus('starting')
    restClient.post<{ port: number; status: string }>(
      `/api/chat/sessions/${sessionId}/preview/start`, {}
    ).then(() => {
      if (!cancelled) setStatus('running')
    }).catch((err) => {
      if (cancelled) return
      // If no package.json, fall back to raw file serving
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('package.json')) {
        setUseDevServer(false)
        setStatus('running')
      } else {
        setStatus('error')
        setErrorMsg(msg)
      }
    })
    return () => { cancelled = true }
  }, [sessionId, useDevServer])

  const previewUrl = useDevServer
    ? `${baseUrl}/api/chat/sessions/${sessionId}/preview/?token=${encodeURIComponent(token || '')}&_r=${refreshCount}`
    : `${baseUrl}/api/chat/sessions/${sessionId}/workspace/file/raw?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token || '')}&_r=${refreshCount}`

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800 bg-gray-900/60 text-xs">
        <Globe className="w-3.5 h-3.5 text-green-400" />
        <span className="text-gray-300 font-medium">App Preview</span>
        {useDevServer && (
          <span className="px-1.5 py-0.5 rounded bg-green-600/20 text-green-400 text-[10px] font-medium">DEV</span>
        )}
        <span className="text-gray-600 truncate max-w-[200px]">{path}</span>
        <div className="flex-1" />
        <button
          onClick={() => setRefreshCount(c => c + 1)}
          className="flex items-center gap-1 px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title="Refresh preview"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
        <button
          onClick={() => { /* TODO: implement publish flow */ }}
          className="flex items-center gap-1 px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-500 transition-colors"
          title="Publish this app"
        >
          <Rocket className="w-3 h-3" />
          Publish
        </button>
      </div>

      {/* Content */}
      {status === 'starting' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-sm">Starting dev server...</span>
          <span className="text-xs text-gray-600">Running npm install & vite</span>
        </div>
      ) : status === 'error' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-red-400">
          <AlertCircle className="w-6 h-6" />
          <span className="text-sm">Failed to start preview</span>
          <span className="text-xs text-gray-500 max-w-md text-center">{errorMsg}</span>
        </div>
      ) : (
        <iframe
          key={refreshCount}
          src={previewUrl}
          className="flex-1 w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="App Preview"
        />
      )}
    </div>
  )
}

// ============================================================================
// Published App Preview Tab — iframe preview of a published/preview app
// ============================================================================

function PublishedAppPreviewTab({ url, name }: { url: string; name: string }) {
  const [refreshCount, setRefreshCount] = useState(0)
  const token = localStorage.getItem('local_auth_token') || localStorage.getItem('cognito_id_token')
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  const fullUrl = `${baseUrl}${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token || '')}&_r=${refreshCount}`

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800 bg-gray-900/60 text-xs">
        <Eye className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-gray-300 font-medium">Preview: {name}</span>
        <div className="flex-1" />
        <button
          onClick={() => setRefreshCount(c => c + 1)}
          className="flex items-center gap-1 px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title="Refresh preview"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
        <button
          onClick={() => window.open(fullUrl, '_blank')}
          className="flex items-center gap-1 px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title="Open in new tab"
        >
          <ExternalLink className="w-3 h-3" />
          Pop out
        </button>
      </div>
      <iframe
        key={refreshCount}
        src={fullUrl}
        className="flex-1 w-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title={`Preview: ${name}`}
      />
    </div>
  )
}

// ============================================================================
// Unified Chat Selector — single dropdown for scopes + independent agents
// ============================================================================

interface UnifiedChatSelectorProps {
  selectedScopeId: string | null
  selectedAgentId: string | null
  onSelectScope: (scopeId: string) => void
  onSelectIndependentAgent: (agentId: string) => void
}

function UnifiedChatSelector({ selectedScopeId, selectedAgentId, onSelectScope, onSelectIndependentAgent }: UnifiedChatSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [scopes, setScopes] = useState<BusinessScope[]>([])
  const [independentAgents, setIndependentAgents] = useState<Agent[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const [scopeList, allAgents] = await Promise.all([
          BusinessScopeService.getBusinessScopes(),
          AgentService.getAgents(),
        ])
        setScopes(scopeList)
        setIndependentAgents(allAgents.filter(a => !a.businessScopeId))

        // Auto-select default scope if nothing is selected
        if (!selectedScopeId && !selectedAgentId && scopeList.length > 0) {
          const defaultScope = scopeList.find(s => s.isDefault) || scopeList[0]
          onSelectScope(defaultScope.id)
        }
      } catch (err) {
        console.error('Failed to load scopes/agents:', err)
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedScope = scopes.find(s => s.id === selectedScopeId)
  const selectedIndependentAgent = independentAgents.find(a => a.id === selectedAgentId)

  // Determine display label
  let displayLabel = 'Select scope or agent'
  let displayIcon: React.ReactNode = <Layers className="w-4 h-4 text-gray-400" />
  if (selectedScope) {
    displayLabel = `${selectedScope.icon || ''} ${selectedScope.name}`.trim()
    displayIcon = <Layers className="w-4 h-4 text-blue-400" />
  } else if (selectedIndependentAgent) {
    displayLabel = selectedIndependentAgent.displayName
    displayIcon = <Bot className="w-4 h-4 text-green-400" />
  }

  const lowerSearch = search.toLowerCase()
  const filteredScopes = scopes.filter(s =>
    s.name.toLowerCase().includes(lowerSearch) ||
    (s.description || '').toLowerCase().includes(lowerSearch)
  )
  const filteredAgents = independentAgents.filter(a =>
    a.displayName.toLowerCase().includes(lowerSearch) ||
    (a.role || '').toLowerCase().includes(lowerSearch) ||
    a.name.toLowerCase().includes(lowerSearch)
  )

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm">
        <span className="text-gray-400">Loading...</span>
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors text-sm min-w-[200px]"
      >
        {displayIcon}
        <span className="text-white font-medium truncate max-w-[200px]">{displayLabel}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ml-auto ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-30 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-700">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search scopes or agents..."
              className="w-full px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* Business Scopes */}
            {filteredScopes.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Business Scopes
                </div>
                {filteredScopes.map(scope => (
                  <button
                    key={scope.id}
                    onClick={() => { onSelectScope(scope.id); setIsOpen(false); setSearch('') }}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors ${
                      scope.id === selectedScopeId ? 'bg-blue-600/20' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: scope.color || '#4B5563' }}
                      >
                        {scope.icon || scope.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${scope.id === selectedScopeId ? 'text-blue-400' : 'text-white'}`}>
                          {scope.name}
                        </div>
                        {scope.description && (
                          <div className="text-xs text-gray-400 truncate">{scope.description}</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Independent Agents */}
            {filteredAgents.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs text-gray-500 font-medium uppercase tracking-wider border-t border-gray-700">
                  Independent Agents
                </div>
                {filteredAgents.map(agent => {
                  const avatarUrl = getAvatarDisplayUrl(agent.avatar)
                  const fallbackChar = getAvatarFallback(agent.displayName, agent.avatar)
                  const showImage = shouldShowAvatarImage(agent.avatar)
                  return (
                    <button
                      key={agent.id}
                      onClick={() => { onSelectIndependentAgent(agent.id); setIsOpen(false); setSearch('') }}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors ${
                        agent.id === selectedAgentId && !selectedScopeId ? 'bg-blue-600/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden flex-shrink-0 ${
                          agent.status === 'active' ? 'bg-green-600' : 'bg-gray-600'
                        }`}>
                          {showImage && avatarUrl ? (
                            <img src={avatarUrl} alt={agent.displayName} className="w-full h-full object-cover" />
                          ) : (
                            fallbackChar
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate ${
                            agent.id === selectedAgentId && !selectedScopeId ? 'text-blue-400' : 'text-white'
                          }`}>
                            {agent.displayName}
                          </div>
                          <div className="text-xs text-gray-400 truncate">{agent.role}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </>
            )}

            {filteredScopes.length === 0 && filteredAgents.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Business Scope Selector (kept for backward compat, no longer used in header)
// ============================================================================

interface BusinessScopeSelectorProps {
  selectedScopeId: string | null
  onScopeChange: (scopeId: string) => void
}

function BusinessScopeSelector({ selectedScopeId, onScopeChange }: BusinessScopeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [scopes, setScopes] = useState<BusinessScope[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadScopes() {
      try {
        const scopeList = await BusinessScopeService.getBusinessScopes()
        setScopes(scopeList)
        if (scopeList.length > 0) {
          // If no scope selected, or the stored scope no longer exists, pick a default
          const storedScopeExists = selectedScopeId && scopeList.some(s => s.id === selectedScopeId)
          if (!storedScopeExists) {
            const defaultScope = scopeList.find(s => s.isDefault) || scopeList[0]
            onScopeChange(defaultScope.id)
          }
        }
      } catch (err) {
        console.error('Failed to load business scopes:', err)
      } finally {
        setIsLoading(false)
      }
    }
    void loadScopes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedScope = scopes.find(s => s.id === selectedScopeId)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (scopeId: string) => {
    onScopeChange(scopeId)
    setIsOpen(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm">
        <span className="text-gray-400">Loading scopes...</span>
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg 
                   hover:border-gray-600 transition-colors text-sm"
      >
        <Layers className="w-4 h-4 text-gray-400" />
        <span className="text-gray-400">Scope:</span>
        <span className="text-white font-medium">
          {selectedScope ? `${selectedScope.icon || ''} ${selectedScope.name}`.trim() : 'Select scope'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden max-h-80 overflow-y-auto">
          {scopes.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">No scopes available</div>
          ) : (
            scopes.map((scope) => (
              <button
                key={scope.id}
                onClick={() => handleSelect(scope.id)}
                className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors
                  ${scope.id === selectedScopeId ? 'bg-blue-600/20' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                    style={{ backgroundColor: scope.color || '#4B5563' }}
                  >
                    {scope.icon || scope.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate
                      ${scope.id === selectedScopeId ? 'text-blue-400' : 'text-white'}`}>
                      {scope.name}
                    </div>
                    {scope.description && (
                      <div className="text-xs text-gray-400 truncate">{scope.description}</div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Agent Selector (optional — filters by selected scope)
// ============================================================================

interface AgentSelectorProps {
  selectedAgentId: string | null
  selectedScopeId: string | null
  onAgentChange: (agentId: string | null) => void
}

function AgentSelector({ selectedAgentId, selectedScopeId, onAgentChange }: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [scopeAgents, setScopeAgents] = useState<Agent[]>([])
  const [independentAgents, setIndependentAgents] = useState<Agent[]>([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadAgents() {
      setIsLoadingAgents(true)
      try {
        const allAgents = await AgentService.getAgents()
        // Scope agents: those belonging to the selected scope
        if (selectedScopeId) {
          const scoped = AgentService.getAgentsByBusinessScope
            ? await AgentService.getAgentsByBusinessScope(selectedScopeId)
            : allAgents.filter(a => a.businessScopeId === selectedScopeId)
          setScopeAgents(scoped)
        } else {
          setScopeAgents([])
        }
        // Independent agents: those without a scope
        setIndependentAgents(allAgents.filter(a => !a.businessScopeId))
      } catch (err) {
        console.error('Failed to load agents:', err)
        setScopeAgents([])
        setIndependentAgents([])
      } finally {
        setIsLoadingAgents(false)
      }
    }
    void loadAgents()
  }, [selectedScopeId])

  const allAgents = [...scopeAgents, ...independentAgents]

  useEffect(() => {
    if (selectedAgentId && allAgents.length > 0 && !allAgents.find(a => a.id === selectedAgentId)) {
      onAgentChange(null)
    }
  }, [allAgents, selectedAgentId, onAgentChange])

  const selectedAgent = allAgents.find(a => a.id === selectedAgentId)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (agentId: string | null) => {
    onAgentChange(agentId)
    setIsOpen(false)
  }

  if (isLoadingAgents) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm">
        <span className="text-gray-400">Loading agents...</span>
      </div>
    )
  }
  if (allAgents.length === 0) return null

  const renderAgentItem = (agent: Agent) => {
    const avatarUrl = getAvatarDisplayUrl(agent.avatar)
    const fallbackChar = getAvatarFallback(agent.displayName, agent.avatar)
    const showImage = shouldShowAvatarImage(agent.avatar)
    return (
      <button
        key={agent.id}
        onClick={() => handleSelect(agent.id)}
        className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors
          ${agent.id === selectedAgentId ? 'bg-blue-600/20' : ''}`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden
            ${agent.status === 'active' ? 'bg-green-600' : 
              agent.status === 'busy' ? 'bg-yellow-600' : 'bg-gray-600'}`}>
            {showImage && avatarUrl ? (
              <img src={avatarUrl} alt={agent.displayName} className="w-full h-full object-cover" />
            ) : (
              fallbackChar
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-medium truncate
              ${agent.id === selectedAgentId ? 'text-blue-400' : 'text-white'}`}>
              {agent.displayName}
            </div>
            <div className="text-xs text-gray-400 truncate">{agent.role}</div>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg 
                   hover:border-gray-600 transition-colors text-sm"
      >
        <Bot className="w-4 h-4 text-gray-400" />
        <span className="text-gray-400">Agent:</span>
        <span className="text-white font-medium">
          {selectedAgent?.displayName || (selectedScopeId ? 'Auto (all agents)' : 'Select agent')}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden max-h-96 overflow-y-auto">
          {/* Auto option (only when scope is selected) */}
          {selectedScopeId && (
            <button
              onClick={() => handleSelect(null)}
              className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors
                ${!selectedAgentId ? 'bg-blue-600/20' : ''}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-gray-600">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${!selectedAgentId ? 'text-blue-400' : 'text-white'}`}>
                    Auto (all agents)
                  </div>
                  <div className="text-xs text-gray-400">Let the scope route to the right agent</div>
                </div>
              </div>
            </button>
          )}

          {/* Scope agents */}
          {scopeAgents.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs text-gray-500 font-medium uppercase tracking-wider border-t border-gray-700">
                Scope Agents
              </div>
              {scopeAgents.map(renderAgentItem)}
            </>
          )}

          {/* Independent agents */}
          {independentAgents.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs text-gray-500 font-medium uppercase tracking-wider border-t border-gray-700">
                Independent Agents
              </div>
              {independentAgents.map(renderAgentItem)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Message Input
// ============================================================================

// ============================================================================
// Upload Modal
// ============================================================================

function UploadModal({ open, onClose, onConfirm }: {
  open: boolean
  onClose: () => void
  onConfirm: (files: File[]) => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset files when modal opens
  useEffect(() => { if (open) setFiles([]) }, [open])

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles)
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      const unique = arr.filter(f => !existing.has(f.name + f.size))
      return [...prev, ...unique]
    })
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-400" />
            Upload to Workspace
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drop zone */}
        <div className="p-5">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-500'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => { if (e.target.files?.length) { addFiles(e.target.files); e.target.value = '' } }}
            />
            <Paperclip className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              Drag & drop files here, or <span className="text-blue-400">click to browse</span>
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-4 space-y-1 max-h-48 overflow-y-auto">
              {files.map((file, i) => (
                <div key={file.name + i} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-300 truncate">{file.name}</span>
                    <span className="text-xs text-gray-600 flex-shrink-0">
                      {file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`}
                    </span>
                  </div>
                  <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 ml-2">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(files); onClose() }}
            disabled={files.length === 0}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upload {files.length > 0 ? `(${files.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Message Input
// ============================================================================

interface MessageInputProps {
  onSend: (message: string) => void
  onStop: () => void
  onUpload: (files: File[]) => void
  sessionId: string | null
  disabled?: boolean
  isSending?: boolean
}

/** Flatten a FileNode tree into a list of file paths. */
function flattenFiles(nodes: FileNode[], prefix = ''): string[] {
  const result: string[] = []
  for (const n of nodes) {
    const p = prefix ? `${prefix}/${n.name}` : n.name
    if (n.type === 'file') result.push(p)
    if (n.children) result.push(...flattenFiles(n.children, p))
  }
  return result
}

function MessageInput({ onSend, onStop, onUpload, sessionId, disabled = false, isSending = false }: MessageInputProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // File autocomplete state
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [acVisible, setAcVisible] = useState(false)
  const [acQuery, setAcQuery] = useState('')
  const [acIndex, setAcIndex] = useState(0)
  const [atStart, setAtStart] = useState(-1) // cursor position of the '@'
  const acRef = useRef<HTMLDivElement>(null)

  // Fetch workspace files when sessionId changes
  useEffect(() => {
    if (!sessionId) { setAllFiles([]); return }
    restClient.get<{ files: FileNode[] }>(`/api/chat/sessions/${sessionId}/workspace`)
      .then(res => setAllFiles(flattenFiles(res.files)))
      .catch(() => setAllFiles([]))
  }, [sessionId])

  const filtered = acVisible
    ? allFiles.filter(f => f.toLowerCase().includes(acQuery.toLowerCase())).slice(0, 12)
    : []

  const dismissAc = useCallback(() => {
    setAcVisible(false)
    setAcQuery('')
    setAtStart(-1)
    setAcIndex(0)
  }, [])

  const selectFile = useCallback((filePath: string) => {
    // Replace @query with @filePath
    const before = input.slice(0, atStart)
    const afterCursor = input.slice(atStart).replace(/^@\S*/, '')
    const newInput = `${before}@${filePath}${afterCursor ? afterCursor : ' '}`
    setInput(newInput)
    dismissAc()
    // Refocus
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const pos = before.length + 1 + filePath.length + 1
        inputRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }, [input, atStart, dismissAc])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)

    const cursor = e.target.selectionStart ?? val.length
    // Walk backwards from cursor to find '@'
    let foundAt = -1
    for (let i = cursor - 1; i >= 0; i--) {
      if (val[i] === ' ' || val[i] === '\n') break
      if (val[i] === '@') { foundAt = i; break }
    }

    if (foundAt >= 0 && allFiles.length > 0) {
      const query = val.slice(foundAt + 1, cursor)
      setAtStart(foundAt)
      setAcQuery(query)
      setAcVisible(true)
      setAcIndex(0)
    } else {
      dismissAc()
    }
  }, [allFiles, dismissAc])

  const handleSubmit = useCallback(() => {
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
      dismissAc()
    }
  }, [input, disabled, onSend, dismissAc])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (acVisible && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setAcIndex(i => (i + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setAcIndex(i => (i - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectFile(filtered[acIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        dismissAc()
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  // Scroll active item into view
  useEffect(() => {
    if (acRef.current) {
      const active = acRef.current.children[acIndex] as HTMLElement | undefined
      active?.scrollIntoView({ block: 'nearest' })
    }
  }, [acIndex])

  return (
    <>
      <UploadModal open={showUpload} onClose={() => setShowUpload(false)} onConfirm={onUpload} />
      <div className="relative flex items-end gap-2 p-4 border-t border-gray-800 bg-gray-900">
        {/* File autocomplete dropdown */}
        {acVisible && filtered.length > 0 && (
          <div
            ref={acRef}
            className="absolute bottom-full left-16 right-16 mb-1 max-h-56 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50"
          >
            {filtered.map((f, i) => (
              <button
                key={f}
                onMouseDown={(e) => { e.preventDefault(); selectFile(f) }}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm transition-colors ${
                  i === acIndex ? 'bg-blue-600/30 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <FileIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                <span className="truncate">{f}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowUpload(true)}
          disabled={isSending}
          className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          title="Upload files to workspace"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(dismissAc, 150)}
          placeholder={t('chat.placeholder')}
          disabled={disabled}
          rows={1}
          className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg resize-none
                     text-white placeholder-gray-500 focus:outline-none focus:border-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {isSending ? (
          <button
            onClick={onStop}
            className="p-2 bg-red-600 border border-red-600 rounded-lg hover:bg-red-500 hover:border-red-500 transition-colors"
            title="Stop generation"
          >
            <Square className="w-5 h-5 text-white fill-white" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={disabled || !input.trim()}
            className="p-2 bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-500 hover:border-blue-500 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        )}
      </div>
    </>
  )
}

// ============================================================================
// Chat Interface Content
// ============================================================================

function ChatInterfaceContent() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    messages,
    quickQuestions,
    quickQuestionsLoading,
    selectedAgentId,
    selectedBusinessScopeId,
    backendSessionId,
    isLoading,
    isSending,
    error,
    sendMessage,
    stopGeneration,
    setSelectedAgent,
    setSelectedBusinessScope,
    clearError,
    loadSession,
    startNewSession,
    clearConversation,
  } = useContext(ChatContext)

  // Track workspace + session refresh — increment after each completed response
  const [wsRefreshKey, setWsRefreshKey] = useState(0)
  const [sessionRefreshKey, setSessionRefreshKey] = useState(0)
  const prevSending = useRef(isSending)
  useEffect(() => {
    if (prevSending.current && !isSending) {
      setWsRefreshKey(k => k + 1)
      setSessionRefreshKey(k => k + 1)
    }
    prevSending.current = isSending
  }, [isSending])

  // Also refresh session list when a new backend session is created
  const prevBackendSessionId = useRef(backendSessionId)
  useEffect(() => {
    if (backendSessionId && backendSessionId !== prevBackendSessionId.current) {
      setSessionRefreshKey(k => k + 1)
    }
    prevBackendSessionId.current = backendSessionId
  }, [backendSessionId])

  // Resizable workspace panel
  const [panelWidth, setPanelWidth] = useState(288) // 18rem ≈ 288px

  // Tab state: 'chat' is always present, file tabs are added dynamically
  const [fileTabs, setFileTabs] = useState<FileTab[]>([])
  const [activeTab, setActiveTab] = useState<string>('chat')
  const [showSaveMemory, setShowSaveMemory] = useState(false)
  const [showCreateRoom, setShowCreateRoom] = useState(false)

  const handleFileOpen = useCallback((path: string, name: string) => {
    const preview = isPreviewableFile(name)
    const tabId = preview ? `preview:${path}` : path
    // If tab already open, just activate it
    if (fileTabs.some(t => t.id === tabId)) {
      setActiveTab(tabId)
      return
    }
    setFileTabs(prev => [...prev, {
      id: tabId,
      name,
      path,
      kind: preview ? 'preview' : 'file',
    }])
    setActiveTab(tabId)
  }, [fileTabs])

  const handleCloseTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFileTabs(prev => prev.filter(t => t.id !== tabId))
    // If closing the active tab, switch to chat
    if (activeTab === tabId) setActiveTab('chat')
  }, [activeTab])

  // -----------------------------------------------------------------------
  // Keyboard shortcut to close in-app tabs.
  //
  // Cmd+W and Cmd+Shift+W are native Chrome shortcuts (close tab / close
  // window) that cannot be intercepted by web pages.  We use Alt+W instead,
  // which is free on both macOS and Windows/Linux.
  // -----------------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Alt+W — close active in-app tab
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.key === 'w') {
        if (fileTabs.length === 0) return
        e.preventDefault()
        if (activeTab !== 'chat') {
          setFileTabs(prev => prev.filter(t => t.id !== activeTab))
          setActiveTab('chat')
        } else {
          setFileTabs(prev => prev.slice(0, -1))
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fileTabs, activeTab])

  // Listen for preview_ready events from the SSE stream to open an in-app preview tab
  useEffect(() => {
    const onPreviewReady = (e: Event) => {
      const { url, name, appId } = (e as CustomEvent).detail
      const tabId = `published-preview:${appId}`
      setFileTabs(prev => {
        const existing = prev.find(t => t.id === tabId)
        if (existing) return prev // already open, just activate
        return [...prev, { id: tabId, name: name || 'Preview', path: url, kind: 'published-preview' as const }]
      })
      setActiveTab(tabId)
    }
    window.addEventListener('preview-ready', onPreviewReady)
    return () => window.removeEventListener('preview-ready', onPreviewReady)
  }, [])

  const handleSelectSession = useCallback((sessionId: string) => {
    setFileTabs([])
    setActiveTab('chat')
    loadSession(sessionId)
  }, [loadSession])

  const handleNewSession = useCallback(() => {
    setFileTabs([])
    setActiveTab('chat')
    startNewSession()
    // Bump session list refresh so the sidebar updates
    setSessionRefreshKey(k => k + 1)
  }, [startNewSession])

  const handleSendMessage = useCallback(async (content: string) => {
    // Switch to chat tab when sending a message
    setActiveTab('chat')
    await sendMessage(content)
  }, [sendMessage])

  const handleUploadFile = useCallback(async (files: File[]) => {
    if (!backendSessionId || files.length === 0) return
    for (const file of files) {
      const reader = new FileReader()
      await new Promise<void>((resolve) => {
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1]
          try {
            await restClient.post(`/api/chat/sessions/${backendSessionId}/workspace/upload`, {
              fileName: file.name,
              content: base64,
            })
          } catch (err) {
            console.error('Upload failed:', file.name, err)
          }
          resolve()
        }
        reader.readAsDataURL(file)
      })
    }
    setWsRefreshKey(k => k + 1)
  }, [backendSessionId])

  const handleQuickQuestionClick = useCallback((question: QuickQuestion) => {
    handleSendMessage(question.text)
  }, [handleSendMessage])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">{t('common.loading')}</div>
      </div>
    )
  }

  const noSelection = !selectedBusinessScopeId && !selectedAgentId
  const hasTabs = fileTabs.length > 0

  return (
    <div className="flex h-full">
      {/* Session history panel (left) */}
      <SessionHistoryPanel
        businessScopeId={selectedBusinessScopeId}
        activeSessionId={backendSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        refreshKey={sessionRefreshKey}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with unified selector */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <UnifiedChatSelector
              selectedScopeId={selectedBusinessScopeId}
              selectedAgentId={selectedAgentId}
              onSelectScope={(scopeId) => {
                setSelectedBusinessScope(scopeId)
                setSelectedAgent(null)
              }}
              onSelectIndependentAgent={(agentId) => {
                // Clear scope when selecting an independent agent
                setSelectedBusinessScope('')
                setSelectedAgent(agentId)
              }}
            />
            <button
              onClick={() => setShowCreateRoom(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-colors text-sm text-purple-300"
              title="Create a group chat room with multiple agents"
            >
              <Users className="w-4 h-4" />
              <span>Group Chat</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            {backendSessionId && selectedBusinessScopeId && (
              <button
                onClick={() => setShowSaveMemory(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                title="Save session to scope memory"
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Save to Memory</span>
              </button>
            )}
            <button
              onClick={clearConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Clear conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Tab bar — only shown when file tabs are open */}
        {hasTabs && (
          <div className="flex items-center border-b border-gray-800 bg-gray-900/50 overflow-x-auto">
            {/* Chat tab (always first) */}
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm border-r border-gray-800 flex-shrink-0 transition-colors ${
                activeTab === 'chat'
                  ? 'bg-gray-800 text-white border-b-2 border-b-blue-500'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
            {/* File tabs */}
            {fileTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm border-r border-gray-800 flex-shrink-0 transition-colors group ${
                  activeTab === tab.id
                    ? 'bg-gray-800 text-white border-b-2 border-b-blue-500'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`}
              >
                {tab.kind === 'preview' ? (
                  <Globe className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <FileIcon className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span className="max-w-[120px] truncate">{tab.name}</span>
                <span
                  role="button"
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="ml-1 rounded hover:bg-gray-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Close tab (⌥W)"
                >
                  <X className="w-3 h-3" />
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-4 flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400 flex-1">{error}</span>
            <button onClick={clearError} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab content */}
        {activeTab === 'chat' ? (
          noSelection ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Layers className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">
                  Start a Conversation
                </h2>
                <p className="text-gray-400 max-w-md">
                  Choose a business scope or an independent agent from the dropdown above to start chatting.
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.length === 0 && !isSending ? (
                <QuickQuestions
                  questions={quickQuestions}
                  onQuestionClick={handleQuickQuestionClick}
                  isLoading={quickQuestionsLoading}
                />
              ) : (
                <MessageList messages={messages} isTyping={isSending} />
              )}
              <WorkspaceActions
                sessionId={backendSessionId}
                refreshKey={wsRefreshKey}
                onSendMessage={handleSendMessage}
              />
              <MessageInput onSend={handleSendMessage} onStop={stopGeneration} onUpload={handleUploadFile} sessionId={backendSessionId} disabled={isSending} isSending={isSending} />
            </>
          )
        ) : (
          /* File viewer or app preview tab */
          backendSessionId ? (() => {
            const tab = fileTabs.find(t => t.id === activeTab)
            if (!tab) return null
            if (tab.kind === 'published-preview')
              return <PublishedAppPreviewTab url={tab.path} name={tab.name} />
            return tab.kind === 'preview'
              ? <AppPreviewTab path={tab.path} sessionId={backendSessionId} />
              : <FileViewerTab path={tab.path} sessionId={backendSessionId} />
          })() : null
        )}
      </div>

      {/* Resizable workspace panel */}
      <WorkspaceExplorer
        sessionId={backendSessionId}
        businessScopeId={selectedBusinessScopeId}
        refreshKey={wsRefreshKey}
        onFileOpen={handleFileOpen}
        width={panelWidth}
        onWidthChange={setPanelWidth}
      />

      {/* Save to Memory modal */}
      {showSaveMemory && backendSessionId && selectedBusinessScopeId && (
        <SaveToMemoryModal
          scopeId={selectedBusinessScopeId}
          sessionId={backendSessionId}
          onClose={() => setShowSaveMemory(false)}
        />
      )}

      {/* Create Group Chat Room dialog */}
      {showCreateRoom && (
        <CreateRoomQuickDialog
          selectedScopeId={selectedBusinessScopeId}
          onClose={() => setShowCreateRoom(false)}
          onCreated={(roomId) => {
            setShowCreateRoom(false)
            navigate(`/chat/room/${roomId}`)
          }}
        />
      )}
    </div>
  )
}

export function Chat() {
  return (
    <ChatProvider>
      <div className="h-full">
        <ChatInterfaceContent />
      </div>
    </ChatProvider>
  )
}

// ============================================================================
// Quick Create Room Dialog (inline in Chat page)
// ============================================================================

function CreateRoomQuickDialog({ selectedScopeId, onClose, onCreated }: {
  selectedScopeId: string | null;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}) {
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateFromScope = async () => {
    if (!selectedScopeId) return
    setIsCreating(true)
    try {
      const room = await RestChatRoomService.createRoomFromScope(selectedScopeId)
      onCreated(room.id)
    } catch (err) {
      console.error('Failed to create room:', err)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">Create Group Chat Room</h3>
        <p className="text-sm text-gray-400 mb-6">
          Create a room with multiple AI agents that can collaborate. Use @mention to talk to specific agents.
        </p>

        {selectedScopeId ? (
          <button
            onClick={handleCreateFromScope}
            disabled={isCreating}
            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {isCreating ? 'Creating...' : 'Create from current scope (all agents)'}
          </button>
        ) : (
          <p className="text-sm text-yellow-400">Select a business scope first to create a group chat room.</p>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
