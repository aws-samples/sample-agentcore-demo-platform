/**
 * WorkspaceActions
 *
 * Dynamic action bar that appears above the chat input when the agent
 * has built an app (detected by scanning the workspace for index.html).
 * Shows contextual actions: Preview, Publish / Update, Open.
 *
 * Preview sends a prompt to the agent which triggers a preview-typed publish.
 * The backend emits a `preview_ready` SSE event with the URL, and the
 * SessionStreamManager auto-opens it in a new tab.
 */

import { useState, useEffect, useCallback } from 'react'
import { Rocket, Eye, Loader2, X, RefreshCw, ExternalLink } from 'lucide-react'
import { restClient } from '@/services/api/restClient'

interface DetectedApp {
  folder: string
  entryPoint: string
  hasPackageJson: boolean
  name: string | null
  publishedAppId: string | null
  publishedAt: string | null
  publishedVersion: string | null
  previewAppId: string | null
}

interface WorkspaceActionsProps {
  sessionId: string | null
  refreshKey: number
  onSendMessage?: (message: string) => void
}

export function WorkspaceActions({ sessionId, refreshKey, onSendMessage }: WorkspaceActionsProps) {
  const [apps, setApps] = useState<DetectedApp[]>([])
  const [publishing, setPublishing] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!sessionId) { setApps([]); return }
    setDismissed(false)

    restClient.get<{ apps: DetectedApp[] }>(`/api/chat/sessions/${sessionId}/workspace/detect-apps`)
      .then(res => setApps(res.apps))
      .catch(() => setApps([]))
  }, [sessionId, refreshKey])

  const handlePublish = useCallback((app: DetectedApp) => {
    if (!sessionId || !onSendMessage) return
    setPublishing(app.folder)

    const name = app.name || app.folder || 'my-app'
    const folder = app.folder === '.' ? '' : app.folder
    const isUpdate = !!app.publishedAppId

    const msg = isUpdate
      ? `Update the published app "${name}" (ID: ${app.publishedAppId}) from the "${folder || 'root'}" folder. Rebuild if needed and re-publish.`
      : folder
        ? `Publish the app in the "${folder}" folder to the marketplace. App name: "${name}".`
        : `Publish the app in the workspace root to the marketplace. App name: "${name}".`

    onSendMessage(msg)
    setTimeout(() => setPublishing(null), 2000)
  }, [sessionId, onSendMessage])

  const handlePreview = useCallback((app: DetectedApp) => {
    if (!sessionId || !onSendMessage) return
    setPreviewing(app.folder)

    const name = app.name || app.folder || 'my-app'
    const folder = app.folder === '.' ? '' : app.folder

    const msg = folder
      ? `Use the app-publisher skill to preview the app in the "${folder}" folder. App name: "${name}". Pass --status "preview" to publish-app.sh.`
      : `Use the app-publisher skill to preview the app in the workspace root. App name: "${name}". Pass --status "preview" to publish-app.sh.`

    onSendMessage(msg)
    setTimeout(() => setPreviewing(null), 3000)
  }, [sessionId, onSendMessage])

  const handleOpenPublished = useCallback((app: DetectedApp) => {
    if (!app.publishedAppId) return
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    const token = localStorage.getItem('cognito_id_token')
    const url = `${baseUrl}/api/apps/${app.publishedAppId}/static/index.html${token ? `?token=${encodeURIComponent(token)}` : ''}`
    window.open(url, '_blank')
  }, [])

  if (!apps.length || dismissed) return null

  return (
    <div className="mx-4 mb-2">
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/20 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-purple-300">
              {apps.length === 1 ? 'App detected' : `${apps.length} apps detected`}
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-0.5 rounded text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {apps.map(app => {
            const label = app.name || (app.folder === '.' ? 'Root app' : app.folder)
            const isPublishing = publishing === app.folder
            const isPreviewing = previewing === app.folder
            const isPublished = !!app.publishedAppId

            return (
              <div key={app.folder} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                  <span className="text-sm text-white truncate">{label}</span>
                  {isPublished && app.publishedVersion && (
                    <span className="text-[10px] text-green-400/70 bg-green-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      v{app.publishedVersion}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Preview button */}
                  {onSendMessage && (
                    <button
                      onClick={() => handlePreview(app)}
                      disabled={isPreviewing}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 transition-colors disabled:opacity-50"
                    >
                      {isPreviewing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                      {isPreviewing ? 'Loading...' : 'Preview'}
                    </button>
                  )}

                  {/* Open published app in new tab */}
                  {isPublished && (
                    <button
                      onClick={() => handleOpenPublished(app)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30 transition-colors"
                      title="Open published app"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open
                    </button>
                  )}

                  {/* Publish / Update button */}
                  {onSendMessage && (
                    <button
                      onClick={() => handlePublish(app)}
                      disabled={isPublishing}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                        isPublished
                          ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30'
                          : 'bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50'
                      }`}
                    >
                      {isPublishing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isPublished ? (
                        <RefreshCw className="w-3 h-3" />
                      ) : (
                        <Rocket className="w-3 h-3" />
                      )}
                      {isPublishing ? 'Publishing...' : isPublished ? 'Update' : 'Publish'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
