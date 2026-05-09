/**
 * ArtifactListPanel — Simplified workspace view showing only session outputs.
 *
 * Designed for non-technical users. Shows generated files as a flat list
 * ordered by creation time, without exposing folder structure.
 *
 * App folders (containing index.html) are collapsed into a single entry
 * with a rocket icon and preview button, instead of listing every source file.
 */

import { useState, useEffect, useCallback } from 'react'
import { FileText, Image, Table2, File as FileIcon, Code, Globe, Loader2, Eye, RefreshCw, Rocket, Copy } from 'lucide-react'
import { restClient } from '@/services/api/restClient'
import type { FileNode } from '@/components/WorkspaceExplorer'

interface ArtifactListPanelProps {
  sessionId: string | null
  isGenerating?: boolean
  onFileOpen?: (path: string, name: string) => void
  onPreviewApp?: (folder: string) => void
  refreshKey?: number
}

interface ArtifactItem {
  name: string
  path: string
  size?: number
  type: 'document' | 'spreadsheet' | 'image' | 'code' | 'html' | 'other' | 'app'
  /** For app type: the folder path */
  appFolder?: string
  /** For app type: number of files in the app */
  fileCount?: number
}

// File extensions to exclude from artifact list (config/system files)
const EXCLUDED_PATTERNS = [
  /^\./, // hidden files
  /^node_modules/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^tsconfig/,
  /^vite\.config/,
  /^eslint/,
  /^\.gitignore$/,
  /^manifest\.json$/,
  /^CLAUDE\.md$/,
  /^settings\.json$/,
  /^\.workspace-manifest\.json$/,
]

const CONFIG_DIRS = new Set(['.claude', '.kiro', '.vscode', 'node_modules', '.git', 'memories', 'dist', 'build'])

function inferType(name: string): ArtifactItem['type'] {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['md', 'txt', 'docx', 'doc', 'pdf'].includes(ext)) return 'document'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'spreadsheet'
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'image'
  if (['html', 'htm'].includes(ext)) return 'html'
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'rb', 'sh', 'css'].includes(ext)) return 'code'
  return 'other'
}

function TypeIcon({ type }: { type: ArtifactItem['type'] }) {
  switch (type) {
    case 'app': return <Rocket className="w-4 h-4 text-purple-400" />
    case 'document': return <FileText className="w-4 h-4 text-blue-400" />
    case 'spreadsheet': return <Table2 className="w-4 h-4 text-green-400" />
    case 'image': return <Image className="w-4 h-4 text-purple-400" />
    case 'code': return <Code className="w-4 h-4 text-yellow-400" />
    case 'html': return <Globe className="w-4 h-4 text-orange-400" />
    default: return <FileIcon className="w-4 h-4 text-gray-400" />
  }
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Check if a directory node contains an index.html (directly or in dist/build).
 * If so, it's an "app folder" and should be collapsed.
 */
function isAppFolder(node: FileNode): boolean {
  if (node.type !== 'directory' || !node.children) return false
  for (const child of node.children) {
    if (child.type === 'file' && /^index\.html?$/i.test(child.name)) return true
    // Check dist/ or build/ subdirectories
    if (child.type === 'directory' && (child.name === 'dist' || child.name === 'build') && child.children) {
      for (const gc of child.children) {
        if (gc.type === 'file' && /^index\.html?$/i.test(gc.name)) return true
      }
    }
  }
  return false
}

/** Count all files recursively in a directory node */
function countFiles(node: FileNode): number {
  if (node.type === 'file') return 1
  if (!node.children) return 0
  return node.children.reduce((sum, child) => sum + countFiles(child), 0)
}

/** Flatten file tree into artifacts, collapsing app folders */
function flattenToArtifacts(nodes: FileNode[], parentPath = ''): ArtifactItem[] {
  const results: ArtifactItem[] = []

  // Check if root itself is an app (has index.html at top level)
  const rootHasIndex = nodes.some(n => n.type === 'file' && /^index\.html?$/i.test(n.name))
  const rootHasPackageJson = nodes.some(n => n.type === 'file' && n.name === 'package.json')

  if (rootHasIndex || rootHasPackageJson) {
    // Root is an app — collapse everything into one app entry
    const totalFiles = nodes.reduce((sum, n) => sum + (n.type === 'file' ? 1 : countFiles(n)), 0)
    results.push({
      name: 'App',
      path: '.',
      type: 'app',
      appFolder: '.',
      fileCount: totalFiles,
    })

    // Still show non-code files that aren't part of the app (e.g., documents)
    for (const node of nodes) {
      if (node.type === 'directory' && !CONFIG_DIRS.has(node.name) && !isAppFolder(node) && node.name !== 'src' && node.name !== 'public') {
        results.push(...flattenToArtifacts(node.children || [], node.path))
      }
    }
    return results
  }

  for (const node of nodes) {
    // Skip config directories
    if (node.type === 'directory' && CONFIG_DIRS.has(node.name)) continue

    if (node.type === 'directory') {
      // Check if this directory is an app
      if (isAppFolder(node)) {
        const fileCount = countFiles(node)
        results.push({
          name: node.name,
          path: node.path,
          type: 'app',
          appFolder: node.path,
          fileCount,
        })
      } else {
        // Recurse into non-app directories
        results.push(...flattenToArtifacts(node.children || [], node.path))
      }
    } else {
      // Regular file
      const isExcluded = EXCLUDED_PATTERNS.some(p => p.test(node.name))
      if (isExcluded) continue

      results.push({
        name: node.name,
        path: node.path,
        size: node.size,
        type: inferType(node.name),
      })
    }
  }

  return results
}

export function ArtifactListPanel({ sessionId, isGenerating, onFileOpen, onPreviewApp, refreshKey }: ArtifactListPanelProps) {
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [detectedAppName, setDetectedAppName] = useState<string | null>(null)

  const loadArtifacts = useCallback(async () => {
    if (!sessionId) { setArtifacts([]); return }
    setIsLoading(true)
    try {
      const [wsRes, appsRes] = await Promise.all([
        restClient.get<{ files: FileNode[]; workspacePath: string | null }>(
          `/api/chat/sessions/${sessionId}/workspace`
        ),
        restClient.get<{ apps: Array<{ folder: string; name: string | null }> }>(
          `/api/chat/sessions/${sessionId}/workspace/detect-apps`
        ).catch(() => ({ apps: [] })),
      ])

      const items = flattenToArtifacts(wsRes.files || [])

      // Use detected app name from the API (which reads package.json)
      if (appsRes.apps.length > 0 && appsRes.apps[0].name) {
        setDetectedAppName(appsRes.apps[0].name)
      }

      setArtifacts(items)
    } catch {
      setArtifacts([])
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => { loadArtifacts() }, [loadArtifacts, refreshKey])

  // Poll during generation
  useEffect(() => {
    if (!isGenerating || !sessionId) return
    const interval = setInterval(loadArtifacts, 3000)
    return () => clearInterval(interval)
  }, [isGenerating, sessionId, loadArtifacts])

  if (!sessionId) {
    return (
      <div className="p-4 text-center text-xs text-gray-600">
        开始对话后，生成的文件将显示在这里
      </div>
    )
  }

  if (isLoading && artifacts.length === 0) {
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
      </div>
    )
  }

  if (artifacts.length === 0) {
    return (
      <div className="p-4 text-center">
        <FileText className="w-8 h-8 text-gray-700 mx-auto mb-2" />
        <p className="text-xs text-gray-500">暂无产出物</p>
        <p className="text-[10px] text-gray-600 mt-1">AI 生成的文件将显示在这里</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs text-gray-400 font-medium">
          本次会话产出 ({artifacts.length})
        </span>
        <button
          onClick={loadArtifacts}
          className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
          title="刷新"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {artifacts.map((item) => (
          item.type === 'app' ? (
            <div
              key={item.path}
              className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-800/30 last:border-0 bg-purple-500/5"
            >
              <Rocket className="w-4 h-4 text-purple-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium truncate">
                  {detectedAppName || item.name}
                </p>
                {item.fileCount && (
                  <p className="text-[10px] text-gray-500">{item.fileCount} 个文件</p>
                )}
              </div>
              <button
                onClick={() => onPreviewApp?.(item.appFolder || item.path)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 transition-colors flex-shrink-0"
              >
                <Eye className="w-3 h-3" />
                Preview
              </button>
            </div>
          ) : (
            <div
              key={item.path}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-800/50 transition-colors text-left border-b border-gray-800/30 last:border-0"
            >
              <TypeIcon type={item.type} />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onFileOpen?.(item.path, item.name)}>
                <p className="text-xs text-white truncate">{item.name}</p>
                {item.size && (
                  <p className="text-[10px] text-gray-600">{formatSize(item.size)}</p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(item.path)
                }}
                className="p-1 text-gray-600 hover:text-blue-400 transition-colors flex-shrink-0"
                title="拷贝文件路径"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={() => onFileOpen?.(item.path, item.name)}
                className="p-1 text-gray-600 hover:text-white transition-colors flex-shrink-0"
                title="预览"
              >
                <Eye className="w-3 h-3" />
              </button>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
