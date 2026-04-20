/**
 * ProjectBoard Page
 * Kanban board + list view with agent execution and auto-process.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, LayoutGrid, List, Loader2, GripVertical, Bot, User, MessageSquare, Settings, Play, X, Sparkles, Terminal, ChevronDown, ChevronUp, Send, RefreshCw, FileCode } from 'lucide-react'
import { RestProjectService, type Project, type ProjectIssue, type IssueComment, type IssueRelation, type TriageReport } from '@/services/api/restProjectService'
import { useTranslation } from '@/i18n'
import { WorkspaceExplorer } from '@/components'

const LANES = [
  { id: 'backlog', labelKey: 'project.backlog', color: 'border-gray-600' },
  { id: 'todo', labelKey: 'project.todo', color: 'border-blue-600' },
  { id: 'in_progress', labelKey: 'project.inProgress', color: 'border-yellow-600' },
  { id: 'in_review', labelKey: 'project.inReview', color: 'border-purple-600' },
  { id: 'done', labelKey: 'project.done', color: 'border-green-600' },
]

const PRIORITY_BADGES: Record<string, { label: string; cls: string }> = {
  critical: { label: '🔴', cls: 'text-red-400' },
  high: { label: '🟠', cls: 'text-orange-400' },
  medium: { label: '🟡', cls: 'text-yellow-400' },
  low: { label: '🟢', cls: 'text-green-400' },
}

const RELATION_TYPE_CONFIG: Record<string, { icon: string; labelKey: string }> = {
  conflicts_with: { icon: '⚠️', labelKey: 'project.conflictsWith' },
  depends_on: { icon: '🔗', labelKey: 'project.dependsOn' },
  duplicates: { icon: '📋', labelKey: 'project.duplicatesOf' },
  related_to: { icon: '🔄', labelKey: 'project.relatedTo' },
}

type ViewMode = 'board' | 'list'

export function ProjectBoard() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [project, setProject] = useState<Project | null>(null)
  const [issues, setIssues] = useState<ProjectIssue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [dragIssueId, setDragIssueId] = useState<string | null>(null)

  // Dialogs
  const [showCreateIssue, setShowCreateIssue] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showExecuteConfirm, setShowExecuteConfirm] = useState<ProjectIssue | null>(null)
  const [selectedIssue, setSelectedIssue] = useState<ProjectIssue | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPriority, setEditPriority] = useState('medium')
  const [editStatus, setEditStatus] = useState('backlog')
  const [isSavingIssue, setIsSavingIssue] = useState(false)

  // AI Refine diff
  const [isRefining, setIsRefining] = useState(false)
  const [refinedDesc, setRefinedDesc] = useState<string | null>(null) // non-null = show diff

  // Code diff viewer
  const [showDiffPanel, setShowDiffPanel] = useState(false)
  const [diffPatch, setDiffPatch] = useState<string | null>(null)
  const [diffStat, setDiffStat] = useState<import('@/services/api/restProjectService').DiffStat | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)

  // Issue detail comments
  const [issueComments, setIssueComments] = useState<IssueComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Create issue form
  const [newIssueTitle, setNewIssueTitle] = useState('')
  const [newIssueLane, setNewIssueLane] = useState('backlog')
  const [newIssuePriority, setNewIssuePriority] = useState('medium')

  // Settings
  const [autoProcess, setAutoProcess] = useState(false)
  const autoProcessRef = useRef(false)
  const autoProcessTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // AI Governance
  const [projectRelations, setProjectRelations] = useState<IssueRelation[]>([])
  const [issueRelations, setIssueRelations] = useState<IssueRelation[]>([])
  const [showTriageReport, setShowTriageReport] = useState(false)
  const [triageReport, setTriageReport] = useState<TriageReport | null>(null)
  const [isGeneratingTriage, setIsGeneratingTriage] = useState(false)

  // Workspace panel
  const [wsPanelWidth, setWsPanelWidth] = useState(288)
  const [wsRefreshKey, setWsRefreshKey] = useState(0)

  // Agent console (bottom panel)
  const [showConsole, setShowConsole] = useState(false)
  const [consoleHeight, setConsoleHeight] = useState(200)
  const [consoleMessages, setConsoleMessages] = useState<Array<{ id: string; type: string; content: string; created_at: string }>>([])
  const consoleEndRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    if (!projectId) return
    try {
      const [proj, issueList] = await Promise.all([
        RestProjectService.getProject(projectId),
        RestProjectService.listIssues(projectId),
      ])
      setProject(proj)
      setIssues(issueList)

      // Ensure workspace session exists (lazy init)
      if (!proj.workspace_session_id) {
        try {
          const sessionId = await RestProjectService.ensureWorkspace(projectId)
          setProject(prev => prev ? { ...prev, workspace_session_id: sessionId } : prev)
        } catch { /* workspace init can fail silently */ }
      }

      // Load settings
      try {
        const settings = await RestProjectService.getSettings(projectId)
        const ap = !!settings.auto_process
        setAutoProcess(ap)
        autoProcessRef.current = ap
      } catch { /* no settings yet */ }

      // Load project-level relations for card badges
      try {
        const rels = await RestProjectService.getProjectRelations(projectId)
        setProjectRelations(rels)
      } catch { /* relations not critical */ }
    } catch (err) {
      console.error('Failed to load project:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => { loadData() }, [loadData])

  // Poll agent console messages when panel is open
  useEffect(() => {
    const sessionId = project?.workspace_session_id
    if (!showConsole || !sessionId) return

    const loadMessages = async () => {
      try {
        const { restClient } = await import('@/services/api/restClient')
        const messages = await restClient.get<Array<{ id: string; type: string; content: string; created_at: string }>>(
          `/api/chat/history/${sessionId}?limit=50`
        )
        setConsoleMessages(Array.isArray(messages) ? messages : [])
        setTimeout(() => consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      } catch { /* ignore */ }
    }

    loadMessages()
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [showConsole, project?.workspace_session_id])

  // Auto-process polling: when enabled, check every 10s if there's a todo to pick up
  // Also refresh the board periodically to pick up status changes from backend auto-processor
  useEffect(() => {
    if (autoProcessTimerRef.current) {
      clearInterval(autoProcessTimerRef.current)
      autoProcessTimerRef.current = null
    }
    if (autoProcess && projectId) {
      autoProcessTimerRef.current = setInterval(async () => {
        if (!autoProcessRef.current || !projectId) return
        try {
          // Refresh board to pick up any status changes from backend auto-processor
          loadData()
          const result = await RestProjectService.autoProcessNext(projectId)
          if (result.status === 'started') {
            if (result.session_id) {
              setProject(prev => prev ? { ...prev, workspace_session_id: result.session_id! } : prev)
            }
            setWsRefreshKey(k => k + 1)
            loadData() // refresh board again after starting
          }
        } catch (err) {
          console.error('Auto-process error:', err)
        }
      }, 10000)
    }
    return () => {
      if (autoProcessTimerRef.current) clearInterval(autoProcessTimerRef.current)
    }
  }, [autoProcess, projectId, loadData])

  const handleCreateIssue = async () => {
    if (!projectId || !newIssueTitle.trim()) return
    await RestProjectService.createIssue(projectId, {
      title: newIssueTitle.trim(),
      status: newIssueLane,
      priority: newIssuePriority,
    })
    setNewIssueTitle('')
    setShowCreateIssue(false)
    loadData()
  }

  const handleDrop = async (issueId: string, newStatus: string) => {
    if (!projectId) return
    const issue = issues.find(i => i.id === issueId)
    if (!issue) return

    // If dropping into in_progress, show confirmation dialog
    if (newStatus === 'in_progress' && issue.status !== 'in_progress') {
      setShowExecuteConfirm(issue)
      setDragIssueId(null)
      return
    }

    // Otherwise just change status
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: newStatus } : i))
    await RestProjectService.changeStatus(projectId, issueId, newStatus)
    setDragIssueId(null)
  }

  const handleExecuteConfirm = async () => {
    if (!projectId || !showExecuteConfirm) return
    try {
      const result = await RestProjectService.executeIssue(projectId, showExecuteConfirm.id)
      // Update the project's workspace_session_id so the panel shows files
      setProject(prev => prev ? { ...prev, workspace_session_id: result.session_id } : prev)
      setShowExecuteConfirm(null)
      setWsRefreshKey(k => k + 1)
      setShowConsole(true) // auto-open console to show agent activity
      loadData()
    } catch (err) {
      console.error('Execute failed:', err)
      alert(`Agent execution failed: ${err instanceof Error ? err.message : 'Unknown error'}. Make sure the project has a Business Scope configured.`)
    }
  }

  const handleSkipExecute = async () => {
    if (!projectId || !showExecuteConfirm) return
    // Just move to in_progress without agent
    await RestProjectService.changeStatus(projectId, showExecuteConfirm.id, 'in_progress')
    setShowExecuteConfirm(null)
    loadData()
  }

  const handleToggleAutoProcess = async (enabled: boolean) => {
    if (!projectId) return
    setAutoProcess(enabled)
    autoProcessRef.current = enabled
    await RestProjectService.updateSettings(projectId, { auto_process: enabled })
    // If just enabled, immediately try to pick up a todo task
    if (enabled) {
      try {
        const result = await RestProjectService.autoProcessNext(projectId)
        if (result.status === 'started') {
          if (result.session_id) {
            setProject(prev => prev ? { ...prev, workspace_session_id: result.session_id! } : prev)
          }
          setWsRefreshKey(k => k + 1)
          loadData()
        }
      } catch (err) {
        console.error('Initial auto-process failed:', err)
      }
    }
  }

  const handleOpenIssue = (issue: ProjectIssue) => {
    setSelectedIssue(issue)
    setEditTitle(issue.title)
    setEditDesc(issue.description ?? '')
    setEditPriority(issue.priority)
    setEditStatus(issue.status)
    setIssueComments([])
    setNewComment('')
    setRefinedDesc(null)
    setIsRefining(false)
    setShowDiffPanel(false)
    setDiffPatch(null)
    setDiffStat(null)
    // Load comments
    if (projectId) {
      setLoadingComments(true)
      RestProjectService.listComments(projectId, issue.id)
        .then(comments => {
          setIssueComments(comments)
          setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        })
        .catch(() => {})
        .finally(() => setLoadingComments(false))
    }
  }

  const handlePostComment = async () => {
    if (!projectId || !selectedIssue || !newComment.trim()) return
    setPostingComment(true)
    try {
      const comment = await RestProjectService.addComment(projectId, selectedIssue.id, newComment.trim())
      setIssueComments(prev => [...prev, comment])
      setNewComment('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      loadData() // refresh comment counts on cards
    } catch (err) {
      console.error('Failed to post comment:', err)
    } finally {
      setPostingComment(false)
    }
  }

  const handleSaveIssue = async () => {
    if (!projectId || !selectedIssue) return
    setIsSavingIssue(true)
    try {
      await RestProjectService.updateIssue(projectId, selectedIssue.id, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        priority: editPriority,
      })
      if (editStatus !== selectedIssue.status) {
        await RestProjectService.changeStatus(projectId, selectedIssue.id, editStatus)
      }
      setSelectedIssue(null)
      loadData()
    } finally {
      setIsSavingIssue(false)
    }
  }

  const handleDeleteSelectedIssue = async () => {
    if (!projectId || !selectedIssue || !confirm(t('project.deleteIssueConfirm'))) return
    await RestProjectService.deleteIssue(projectId, selectedIssue.id)
    setSelectedIssue(null)
    loadData()
  }

  const _handleDeleteIssue = async (issueId: string) => {
    if (!projectId || !confirm(t('project.deleteIssueConfirm'))) return
    await RestProjectService.deleteIssue(projectId, issueId)
    loadData()
  }

  // --- AI Governance handlers ---

  const handleGenerateTriage = async () => {
    if (!projectId) return
    setIsGeneratingTriage(true)
    try {
      const report = await RestProjectService.generateTriage(projectId)
      setTriageReport(report)
      setShowTriageReport(true)
    } catch (err) {
      console.error('Triage generation failed:', err)
      alert(`Triage failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsGeneratingTriage(false)
    }
  }

  const handleReviewRelation = async (relationId: string, action: 'confirmed' | 'dismissed') => {
    if (!projectId) return
    try {
      await RestProjectService.reviewRelation(projectId, relationId, action)
      // Refresh relations for the selected issue
      if (selectedIssue) {
        const rels = await RestProjectService.getIssueRelations(projectId, selectedIssue.id)
        setIssueRelations(rels)
      }
      // Refresh project-level relations
      const projRels = await RestProjectService.getProjectRelations(projectId)
      setProjectRelations(projRels)
      // Refresh issues to get updated readiness scores
      loadData()
    } catch (err) {
      console.error('Review relation failed:', err)
    }
  }

  const handleReanalyze = async () => {
    if (!projectId || !selectedIssue) return
    try {
      await RestProjectService.reanalyzeIssue(projectId, selectedIssue.id)
      // Update local state to show analyzing status
      setIssues(prev => prev.map(i => i.id === selectedIssue.id ? { ...i, ai_analysis_status: 'analyzing' } : i))
      setSelectedIssue(prev => prev ? { ...prev, ai_analysis_status: 'analyzing' } : prev)
    } catch (err) {
      console.error('Re-analyze failed:', err)
    }
  }

  // Load issue relations when opening issue detail
  const handleOpenIssueWithRelations = (issue: ProjectIssue) => {
    handleOpenIssue(issue)
    // Load relations for this issue
    if (projectId) {
      RestProjectService.getIssueRelations(projectId, issue.id)
        .then(setIssueRelations)
        .catch(() => setIssueRelations([]))
    }
  }

  // Helper: get relations for a specific issue from project-level cache
  const getIssueRelationsFromCache = (issueId: string) => {
    return projectRelations.filter(r => r.source_issue_id === issueId || r.target_issue_id === issueId)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  }
  if (!project) {
    return <div className="flex items-center justify-center h-full text-gray-400">{t('project.notFound')}</div>
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/projects')} className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft size={18} className="text-gray-400" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-white">{project.name}</h1>
            {project.description && <p className="text-xs text-gray-500">{project.description}</p>}
          </div>
          {autoProcess && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-600/20 text-green-400 text-[10px] rounded-full border border-green-500/30">
              <Play size={8} /> Auto
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            <button onClick={() => setViewMode('board')} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${viewMode === 'board' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode('list')} className={`px-2.5 py-1 text-xs rounded-md transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <List size={14} />
            </button>
          </div>
          <button onClick={() => setShowCreateIssue(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors">
            <Plus size={14} /> {t('project.newIssue')}
          </button>
          <button
            onClick={handleGenerateTriage}
            disabled={isGeneratingTriage}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs rounded-lg border border-purple-500/20 transition-colors disabled:opacity-50"
            title={t('project.aiTriageHint')}
          >
            {isGeneratingTriage ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {t('project.aiTriage')}
          </button>
          <button onClick={() => setShowSettings(true)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title={t('project.settings')}>
            <Settings size={18} />
          </button>
          <button
            onClick={async () => {
              if (!projectId) return
              try {
                const result = await RestProjectService.syncWorkspace(projectId)
                setWsRefreshKey(k => k + 1)
                console.log(`Synced ${result.synced} files`)
              } catch (err) {
                console.error('Sync failed:', err)
              }
            }}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title={t('project.syncWorkspace')}
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`p-1.5 rounded-lg transition-colors ${showConsole ? 'text-green-400 bg-green-600/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            title={t('project.agentConsole')}
          >
            <Terminal size={18} />
          </button>
        </div>
      </div>

      {/* Board View */}
      {viewMode === 'board' ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex overflow-x-auto p-4 gap-3">
          {LANES.map(lane => {
            const laneIssues = issues.filter(i => i.status === lane.id).sort((a, b) => a.sort_order - b.sort_order)
            return (
              <div
                key={lane.id}
                className={`flex-1 min-w-[180px] flex flex-col bg-gray-900/50 rounded-xl border-t-2 ${lane.color}`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => dragIssueId && handleDrop(dragIssueId, lane.id)}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-medium text-gray-300">{t(lane.labelKey)}</span>
                  <span className="text-xs text-gray-500">{laneIssues.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                  {laneIssues.map(issue => (
                    <IssueCard key={issue.id} issue={issue} relations={getIssueRelationsFromCache(issue.id)} onDragStart={() => setDragIssueId(issue.id)} onClick={() => handleOpenIssueWithRelations(issue)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

          {/* Workspace Panel */}
          <WorkspaceExplorer
            sessionId={project?.workspace_session_id ?? null}
            refreshKey={wsRefreshKey}
            width={wsPanelWidth}
            onWidthChange={setWsPanelWidth}
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2">#</th><th className="pb-2">{t('project.colTitle')}</th><th className="pb-2">{t('project.colStatus')}</th><th className="pb-2">{t('project.colPriority')}</th><th className="pb-2">{t('project.colCreator')}</th><th className="pb-2">{t('project.colCreated')}</th>
              </tr>
            </thead>
            <tbody>
              {issues.map(issue => (
                <tr key={issue.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => handleOpenIssueWithRelations(issue)}>
                  <td className="py-2 pl-3 text-gray-500">{issue.issue_number}</td>
                  <td className="py-2 text-white">{issue.title}</td>
                  <td className="py-2"><span className={`px-2 py-0.5 rounded text-xs ${issue.status === 'done' ? 'bg-green-600/20 text-green-400' : issue.status === 'in_progress' ? 'bg-yellow-600/20 text-yellow-400' : issue.status === 'in_review' ? 'bg-purple-600/20 text-purple-400' : 'bg-gray-600/20 text-gray-400'}`}>{issue.status.replace('_', ' ')}</span></td>
                  <td className="py-2">{PRIORITY_BADGES[issue.priority]?.label ?? '🟡'}</td>
                  <td className="py-2">{issue.created_by_profile?.avatar_url ? <img src={issue.created_by_profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover inline" /> : <span className="inline-flex w-5 h-5 rounded-full bg-gray-600 text-[9px] text-gray-300 items-center justify-center">{issue.created_by_profile?.full_name?.charAt(0) ?? '?'}</span>}</td>
                  <td className="py-2 text-gray-500 text-xs">{new Date(issue.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Workspace Panel */}
          <WorkspaceExplorer
            sessionId={project?.workspace_session_id ?? null}
            refreshKey={wsRefreshKey}
            width={wsPanelWidth}
            onWidthChange={setWsPanelWidth}
          />
        </div>
      )}

      {/* Agent Console (bottom panel) */}
      {showConsole && (
        <div
          className="border-t border-gray-800 bg-gray-900 flex flex-col flex-shrink-0"
          style={{ height: consoleHeight }}
        >
          {/* Console header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800 bg-gray-900/80">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-green-400" />
              <span className="text-xs font-medium text-gray-300">{t('project.agentConsole')}</span>
              {consoleMessages.length > 0 && (
                <span className="text-[10px] text-gray-500">{consoleMessages.length} {t('project.consoleMessages')}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConsoleHeight(h => h === 200 ? 400 : 200)}
                className="p-1 text-gray-500 hover:text-white rounded transition-colors"
                title={consoleHeight === 200 ? t('project.consoleExpand') : t('project.consoleShrink')}
              >
                {consoleHeight === 200 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <button
                onClick={() => setShowConsole(false)}
                className="p-1 text-gray-500 hover:text-white rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Console messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs space-y-1.5">
            {consoleMessages.length === 0 ? (
              <div className="text-gray-600 text-center py-4">
                {project?.workspace_session_id
                  ? t('project.consoleWaiting')
                  : t('project.consoleNoSession')}
              </div>
            ) : (
              consoleMessages.map(msg => {
                // Parse content: AI messages may be JSON content blocks or plain text
                let displayContent = msg.content
                if (msg.type === 'ai' || msg.type === 'agent') {
                  try {
                    const blocks = JSON.parse(msg.content)
                    if (Array.isArray(blocks)) {
                      displayContent = blocks
                        .filter((b: { type: string }) => b.type === 'text')
                        .map((b: { text: string }) => b.text)
                        .join('\n')
                    }
                  } catch { /* plain text, use as-is */ }
                }
                return (
                  <div key={msg.id} className="flex gap-2">
                    <span className="text-gray-600 flex-shrink-0 w-16">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className={`flex-shrink-0 w-4 ${
                      msg.type === 'user' ? 'text-blue-400' :
                      msg.type === 'agent' || msg.type === 'ai' ? 'text-green-400' :
                      'text-gray-500'
                    }`}>
                      {msg.type === 'user' ? '→' : msg.type === 'agent' || msg.type === 'ai' ? '←' : '•'}
                    </span>
                    <span className={`flex-1 break-words whitespace-pre-wrap ${
                      msg.type === 'user' ? 'text-blue-300' :
                      msg.type === 'agent' || msg.type === 'ai' ? 'text-green-300' :
                      'text-gray-500'
                    }`}>
                      {displayContent.length > 800 ? displayContent.substring(0, 800) + '...' : displayContent}
                    </span>
                  </div>
                )
              })
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>
      )}

      {/* Create Issue Dialog */}
      {showCreateIssue && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreateIssue(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-4">{t('project.newIssue')}</h3>
            <div className="space-y-3">
              <input value={newIssueTitle} onChange={e => setNewIssueTitle(e.target.value)} placeholder={t('project.issueTitlePlaceholder')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500" autoFocus onKeyDown={e => e.key === 'Enter' && handleCreateIssue()} />
              <div className="grid grid-cols-2 gap-2">
                <select value={newIssueLane} onChange={e => setNewIssueLane(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none">
                  {LANES.map(l => <option key={l.id} value={l.id}>{t(l.labelKey)}</option>)}
                </select>
                <select value={newIssuePriority} onChange={e => setNewIssuePriority(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none">
                  <option value="critical">{t('project.criticalPriority')}</option>
                  <option value="high">{t('project.highPriority')}</option>
                  <option value="medium">{t('project.mediumPriority')}</option>
                  <option value="low">{t('project.lowPriority')}</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreateIssue(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">{t('common.cancel')}</button>
                <button onClick={handleCreateIssue} disabled={!newIssueTitle.trim()} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs rounded-lg transition-colors">{t('common.create')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execute Confirmation Dialog */}
      {showExecuteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowExecuteConfirm(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[420px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-2">{t('project.startAgentExecution')}</h3>
            <p className="text-xs text-gray-400 mb-4">
              {t('project.movingToInProgress')} <span className="text-white font-medium">#{showExecuteConfirm.issue_number} {showExecuteConfirm.title}</span> {t('project.toInProgress')}
            </p>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot size={16} className="text-purple-400" />
                <span className="text-xs text-gray-300">
                  {project?.agent_id ? t('project.projectAgent') : t('project.defaultAgent')}
                </span>
              </div>
              <p className="text-[10px] text-gray-500">
                {t('project.agentWillCreateBranch')}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExecuteConfirm(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleSkipExecute} className="px-3 py-1.5 text-xs text-gray-300 hover:text-white border border-gray-600 rounded-lg transition-colors">
                {t('project.justMove')}
              </button>
              <button onClick={() => handleExecuteConfirm()} className="flex items-center gap-1 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded-lg transition-colors">
                <Play size={12} /> {t('project.startAgent')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Detail Panel */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black/60 flex justify-end z-50" onClick={() => setSelectedIssue(null)}>
          <div className="w-[480px] h-full bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">#{selectedIssue.issue_number}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  editStatus === 'done' ? 'bg-green-600/20 text-green-400' :
                  editStatus === 'in_progress' ? 'bg-yellow-600/20 text-yellow-400' :
                  editStatus === 'in_review' ? 'bg-purple-600/20 text-purple-400' :
                  'bg-gray-600/20 text-gray-400'
                }`}>{editStatus.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleDeleteSelectedIssue} className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors" title={t('project.deleteIssue')}>
                  <X size={14} />
                </button>
                <button onClick={() => setSelectedIssue(null)} className="p-1.5 text-gray-500 hover:text-white rounded transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('project.title')}</label>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">{t('project.description')}</label>
                  {refinedDesc === null ? (
                    <button
                      onClick={async () => {
                        if (!projectId || !selectedIssue) return
                        setIsRefining(true)
                        try {
                          const improved = await RestProjectService.beautifyDescription(projectId, selectedIssue.id)
                          setRefinedDesc(improved)
                        } catch (err) {
                          console.error('Refine failed:', err)
                        } finally {
                          setIsRefining(false)
                        }
                      }}
                      disabled={isRefining}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded transition-colors disabled:opacity-50"
                      title={t('project.aiBeautifyHint')}
                    >
                      {isRefining ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      {isRefining ? t('project.refining') : t('project.aiBeautify')}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditDesc(refinedDesc); setRefinedDesc(null) }}
                        className="px-2 py-0.5 text-[10px] text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition-colors"
                      >
                        {t('project.accept')}
                      </button>
                      <button
                        onClick={() => setRefinedDesc(null)}
                        className="px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                      >
                        {t('project.discard')}
                      </button>
                    </div>
                  )}
                </div>

                {refinedDesc !== null ? (
                  /* Diff view: before / after */
                  <div className="space-y-2">
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
                      <div className="flex items-center gap-1 mb-1.5">
                        <span className="text-[10px] font-medium text-red-400">{t('project.before')}</span>
                      </div>
                      <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">
                        {editDesc || t('project.empty')}
                      </p>
                    </div>
                    <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-2.5">
                      <div className="flex items-center gap-1 mb-1.5">
                        <span className="text-[10px] font-medium text-green-400">{t('project.afterRefined')}</span>
                      </div>
                      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {refinedDesc}
                      </p>
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={6}
                    placeholder={t('project.descPlaceholder')}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 resize-none"
                  />
                )}
              </div>

              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('project.status')}</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none focus:border-blue-500">
                    {LANES.map(l => <option key={l.id} value={l.id}>{t(l.labelKey)}</option>)}
                    <option value="cancelled">{t('project.cancelled')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('project.priority')}</label>
                  <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none focus:border-blue-500">
                    <option value="critical">{t('project.criticalPriority')}</option>
                    <option value="high">{t('project.highPriority')}</option>
                    <option value="medium">{t('project.mediumPriority')}</option>
                    <option value="low">{t('project.lowPriority')}</option>
                  </select>
                </div>
              </div>

              {/* Branch info (if agent has worked on it) */}
              {selectedIssue.branch_name && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">{t('project.branch')}</div>
                  <code className="text-xs text-blue-400">{selectedIssue.branch_name}</code>
                </div>
              )}

              {/* Code Changes / Diff */}
              {(selectedIssue.diff_stat || selectedIssue.status === 'in_review' || selectedIssue.status === 'done') && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <FileCode size={12} className="text-blue-400" />
                      <span className="text-xs font-medium text-gray-300">{t('project.changes')}</span>
                      {selectedIssue.diff_stat && (
                        <span className="text-[10px] text-gray-500">
                          {selectedIssue.diff_stat.files_changed} file{selectedIssue.diff_stat.files_changed !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {selectedIssue.diff_stat && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-green-400">+{selectedIssue.diff_stat.insertions}</span>
                        <span className="text-[10px] text-red-400">-{selectedIssue.diff_stat.deletions}</span>
                        <button
                          onClick={async () => {
                            if (showDiffPanel) {
                              setShowDiffPanel(false)
                              return
                            }
                            if (!projectId || !selectedIssue) return
                            if (diffPatch !== null) {
                              setShowDiffPanel(true)
                              return
                            }
                            setLoadingDiff(true)
                            try {
                              const result = await RestProjectService.getIssueDiff(projectId, selectedIssue.id)
                              setDiffPatch(result.diff_patch)
                              setDiffStat(result.diff_stat)
                              setShowDiffPanel(true)
                            } catch (err) {
                              console.error('Failed to load diff:', err)
                            } finally {
                              setLoadingDiff(false)
                            }
                          }}
                          className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {loadingDiff ? <Loader2 size={10} className="animate-spin" /> : showDiffPanel ? t('project.hideDiff') : t('project.viewDiff')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* File list */}
                  {selectedIssue.diff_stat?.files && (
                    <div className="space-y-0.5 mb-2">
                      {selectedIssue.diff_stat.files.map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`flex-shrink-0 w-1 h-1 rounded-full ${
                              f.status === 'added' ? 'bg-green-400' :
                              f.status === 'deleted' ? 'bg-red-400' :
                              'bg-yellow-400'
                            }`} />
                            <span className="text-gray-300 truncate font-mono">{f.path}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            {f.insertions > 0 && <span className="text-green-400">+{f.insertions}</span>}
                            {f.deletions > 0 && <span className="text-red-400">-{f.deletions}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!selectedIssue.diff_stat && (
                    <p className="text-[10px] text-gray-600">{t('project.noDiffYet')}</p>
                  )}

                  {/* Full diff view */}
                  {showDiffPanel && diffPatch && (
                    <div className="mt-2 border-t border-gray-700 pt-2">
                      <pre className="text-[10px] font-mono leading-relaxed overflow-x-auto max-h-80 overflow-y-auto">
                        {diffPatch.split('\n').map((line, i) => {
                          const cls = line.startsWith('+++') || line.startsWith('---') ? 'text-gray-500 font-bold'
                            : line.startsWith('@@') ? 'text-cyan-400'
                            : line.startsWith('+') ? 'text-green-400 bg-green-500/5'
                            : line.startsWith('-') ? 'text-red-400 bg-red-500/5'
                            : line.startsWith('diff ') ? 'text-gray-400 font-bold border-t border-gray-800 pt-1 mt-1'
                            : 'text-gray-500'
                          return <div key={i} className={cls}>{line || ' '}</div>
                        })}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* AI Acceptance Criteria */}
              {selectedIssue.acceptance_criteria && (selectedIssue.acceptance_criteria as Array<{ criterion: string; verified?: boolean }>).length > 0 && (
                <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={12} className="text-purple-400" />
                      <span className="text-xs font-medium text-purple-300">{t('project.acceptanceCriteria')}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{t('project.aiGenerated')}</span>
                  </div>
                  <div className="space-y-1">
                    {(selectedIssue.acceptance_criteria as Array<{ criterion: string; verified?: boolean }>).map((ac, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="mt-0.5 text-purple-400">•</span>
                        <span>{ac.criterion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issue Relations */}
              {issueRelations.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs font-medium text-gray-300">{t('project.relations')}</span>
                    <span className="text-[10px] text-gray-500">({issueRelations.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {issueRelations.map(rel => {
                      const isSource = rel.source_issue_id === selectedIssue.id
                      const otherIssue = isSource ? rel.target_issue : rel.source_issue
                      const typeConfig = RELATION_TYPE_CONFIG[rel.relation_type] ?? { icon: '🔄', labelKey: 'project.relatedTo' }
                      return (
                        <div key={rel.id} className={`flex items-center justify-between p-2 rounded-lg border ${
                          rel.status === 'dismissed' ? 'opacity-40 border-gray-800' :
                          rel.relation_type === 'conflicts_with' ? 'border-red-500/20 bg-red-500/5' :
                          rel.relation_type === 'depends_on' ? 'border-blue-500/20 bg-blue-500/5' :
                          'border-gray-700 bg-gray-800/30'
                        }`}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs">{typeConfig.icon}</span>
                            <span className="text-[10px] text-gray-500">{t(typeConfig.labelKey)}</span>
                            <span className="text-xs text-white truncate">#{otherIssue.issue_number} {otherIssue.title}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-[10px] text-gray-500">{Math.round(rel.confidence * 100)}%</span>
                            {rel.status === 'pending' && (
                              <>
                                <button onClick={() => handleReviewRelation(rel.id, 'confirmed')} className="p-0.5 text-green-500/60 hover:text-green-400 rounded transition-colors" title="Confirm">✓</button>
                                <button onClick={() => handleReviewRelation(rel.id, 'dismissed')} className="p-0.5 text-red-500/60 hover:text-red-400 rounded transition-colors" title="Dismiss">✕</button>
                              </>
                            )}
                            {rel.status === 'confirmed' && <span className="text-[10px] text-green-500">{t('project.confirmed')}</span>}
                            {rel.status === 'dismissed' && <span className="text-[10px] text-gray-600">{t('project.dismissed')}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {issueRelations.some(r => r.reasoning) && (
                    <details className="mt-2">
                      <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-400">{t('project.viewAiReasoning')}</summary>
                      <div className="mt-1 space-y-1">
                        {issueRelations.filter(r => r.reasoning).map(r => {
                          const other = r.source_issue_id === selectedIssue.id ? r.target_issue : r.source_issue
                          return (
                            <p key={r.id} className="text-[10px] text-gray-500 pl-2 border-l border-gray-700">
                              <span className="text-gray-400">#{other.issue_number}:</span> {r.reasoning}
                            </p>
                          )
                        })}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* Readiness Score Breakdown */}
              {['backlog', 'todo'].includes(editStatus) && selectedIssue.readiness_details && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-300">{t('project.readinessScore')}</span>
                    <div className="flex items-center gap-2">
                      {selectedIssue.ai_analysis_status === 'stale' && (
                        <button onClick={handleReanalyze} className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors">
                          <RefreshCw size={10} /> {t('project.reanalyze')}
                        </button>
                      )}
                      <span className={`text-sm font-bold ${
                        (selectedIssue.readiness_score ?? 0) >= 80 ? 'text-green-400' :
                        (selectedIssue.readiness_score ?? 0) >= 50 ? 'text-yellow-400' : 'text-red-400'
                      }`}>{selectedIssue.readiness_score ?? 0}/100</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(selectedIssue.readiness_details as Record<string, { score: number; max: number; reason: string }>).map(([key, detail]) => (
                      <div key={key}>
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-gray-400 capitalize">{key}</span>
                          <span className="text-gray-500">{detail.score}/{detail.max}</span>
                        </div>
                        <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              detail.score / detail.max >= 0.8 ? 'bg-green-500' :
                              detail.score / detail.max >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${(detail.score / detail.max) * 100}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-gray-600 mt-0.5">{detail.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Creator */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">{t('project.createdBy')}</div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium bg-gray-600 text-gray-300 overflow-hidden flex-shrink-0">
                    {selectedIssue.created_by_profile?.avatar_url ? (
                      <img src={selectedIssue.created_by_profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedIssue.created_by_profile?.full_name?.charAt(0) ?? '?'
                    )}
                  </div>
                  <span className="text-sm text-gray-300">
                    {selectedIssue.created_by_profile?.full_name ?? selectedIssue.created_by_profile?.username ?? 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {new Date(selectedIssue.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Project Agent */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">{t('project.projectAgent')}</div>
                <div className="flex items-center gap-2 text-sm">
                  {project?.agent_id ? (
                    <><Bot size={14} className="text-purple-400" /> <span className="text-gray-300">{t('project.customAgent')}</span></>
                  ) : (
                    <><Bot size={14} className="text-gray-500" /> <span className="text-gray-500">{t('project.defaultAgent')}</span></>
                  )}
                </div>
              </div>

              {/* Comments */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <MessageSquare size={12} className="text-gray-400" />
                  <label className="text-xs text-gray-400">
                    {t('project.comments')} {issueComments.length > 0 && `(${issueComments.length})`}
                  </label>
                </div>

                {loadingComments ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={14} className="text-gray-500 animate-spin" />
                  </div>
                ) : issueComments.length === 0 ? (
                  <p className="text-xs text-gray-600 py-2">{t('project.noComments')}</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {issueComments.map(c => (
                      <div key={c.id} className={`rounded-lg p-2.5 text-xs ${
                        c.comment_type === 'status_change'
                          ? 'bg-yellow-500/5 border border-yellow-500/10'
                          : c.author_agent_id
                            ? 'bg-purple-500/5 border border-purple-500/10'
                            : 'bg-gray-800 border border-gray-700'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-gray-500">
                            {c.comment_type === 'status_change' ? '⚡ System' :
                             c.author_agent_id ? '🤖 Agent' : '👤 User'}
                          </span>
                          <span className="text-[10px] text-gray-600">
                            {new Date(c.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                          {c.content.length > 500 ? c.content.substring(0, 500) + '...' : c.content}
                        </p>
                      </div>
                    ))}
                    <div ref={commentsEndRef} />
                  </div>
                )}

                {/* Add comment */}
                <div className="flex gap-2 mt-2">
                  <input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment() } }}
                    placeholder={t('project.addComment')}
                    className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-600 outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handlePostComment}
                    disabled={postingComment || !newComment.trim()}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
                  >
                    {postingComment ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-800">
              <button onClick={() => setSelectedIssue(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleSaveIssue} disabled={isSavingIssue || !editTitle.trim()} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs rounded-lg transition-colors">
                {isSavingIssue ? t('project.saving') : t('project.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Triage Report Slide-over */}
      {showTriageReport && triageReport && (
        <div className="fixed inset-0 bg-black/60 flex justify-end z-50" onClick={() => setShowTriageReport(false)}>
          <div className="w-[520px] h-full bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <span className="text-sm font-semibold text-white">{t('project.aiTriageReport')}</span>
              </div>
              <button onClick={() => setShowTriageReport(false)} className="p-1.5 text-gray-500 hover:text-white rounded transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Summary */}
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-3">
                <p className="text-xs text-gray-300 leading-relaxed">{triageReport.summary}</p>
                <p className="text-[10px] text-gray-500 mt-2">{t('project.sprintCapacity')}: {triageReport.sprint_estimate}</p>
              </div>

              {/* Recommended Order */}
              {triageReport.recommended_order?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-300 mb-2">{t('project.recommendedOrder')}</h4>
                  <div className="space-y-1">
                    {triageReport.recommended_order.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-gray-800/50 rounded-lg">
                        <span className="text-[10px] text-gray-500 font-mono w-4 flex-shrink-0 mt-0.5">{i + 1}.</span>
                        <div>
                          <span className="text-xs text-white">#{item.issue_number}</span>
                          <p className="text-[10px] text-gray-500 mt-0.5">{item.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Merge Suggestions */}
              {triageReport.merge_suggestions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-300 mb-2">{t('project.mergeSuggestions')}</h4>
                  {triageReport.merge_suggestions.map((m, i) => (
                    <div key={i} className="p-2 bg-orange-500/5 border border-orange-500/10 rounded-lg mb-1.5">
                      <div className="flex items-center gap-1 mb-1">
                        {m.issue_numbers.map(n => (
                          <span key={n} className="px-1.5 py-0.5 bg-gray-700 text-[10px] text-white rounded">#{n}</span>
                        ))}
                        <span className="text-[10px] text-gray-500">→</span>
                        <span className="text-[10px] text-orange-300">{m.suggested_title}</span>
                      </div>
                      <p className="text-[10px] text-gray-500">{m.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Missing Info */}
              {triageReport.missing_info?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-300 mb-2">{t('project.infoNeeded')}</h4>
                  {triageReport.missing_info.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-yellow-500/5 border border-yellow-500/10 rounded-lg mb-1.5">
                      <span className="text-xs text-white flex-shrink-0">#{m.issue_number}</span>
                      <p className="text-[10px] text-yellow-300">{m.what_is_missing}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Risk Flags */}
              {triageReport.risk_flags?.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-gray-300 mb-2">{t('project.riskFlags')}</h4>
                  {triageReport.risk_flags.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-red-500/5 border border-red-500/10 rounded-lg mb-1.5">
                      <span className="text-xs text-white flex-shrink-0">#{r.issue_number}</span>
                      <p className="text-[10px] text-red-300">{r.risk}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <ProjectSettingsModal
          project={project}
          autoProcess={autoProcess}
          onToggleAutoProcess={handleToggleAutoProcess}
          onClose={() => setShowSettings(false)}
          onProjectUpdated={(updated) => { setProject(updated); loadData() }}
        />
      )}
    </div>
  )
}

// ============================================================================
// Project Settings Modal
// ============================================================================

function ProjectSettingsModal({ project, autoProcess, onToggleAutoProcess, onClose, onProjectUpdated }: {
  project: Project
  autoProcess: boolean
  onToggleAutoProcess: (enabled: boolean) => void
  onClose: () => void
  onProjectUpdated: (p: Project) => void
}) {
  const [scopes, setScopes] = useState<Array<{ id: string; name: string }>>([])
  const [agents, setAgents] = useState<Array<{ id: string; display_name: string }>>([])
  const [selectedScopeId, setSelectedScopeId] = useState(project.business_scope_id ?? '')
  const [selectedAgentId, setSelectedAgentId] = useState(project.agent_id ?? '')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    // Load scopes
    import('@/services/api/restBusinessScopeService').then(({ RestBusinessScopeService }) => {
      RestBusinessScopeService.getBusinessScopes().then(list => {
        setScopes(list.map(s => ({ id: s.id, name: s.name })))
      }).catch(() => {})
    })
    // Load agents
    import('@/services/api').then(({ AgentService }) => {
      AgentService.getAgents().then((list: Array<{ id: string; displayName: string }>) => {
        setAgents(list.map(a => ({ id: a.id, display_name: a.displayName })))
      }).catch(() => {})
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await RestProjectService.updateProject(project.id, {
        business_scope_id: selectedScopeId || undefined,
        agent_id: selectedAgentId || undefined,
      })
      onProjectUpdated(updated)
      setDirty(false)
    } catch (err) {
      console.error('Failed to update project:', err)
    } finally {
      setSaving(false)
    }
  }

  const noScope = !selectedScopeId

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[420px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">{t('project.settings')}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          {/* Business Scope — required for agent execution */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('project.businessScope')}</label>
            <select
              value={selectedScopeId}
              onChange={e => { setSelectedScopeId(e.target.value); setDirty(true) }}
              className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-sm text-white outline-none focus:border-blue-500 ${
                noScope ? 'border-yellow-500/50' : 'border-gray-700'
              }`}
            >
              <option value="">{t('project.noScopeOption')}</option>
              {scopes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {noScope && (
              <p className="text-[10px] text-yellow-400 mt-1">
                {t('project.noScopeWarning')}
              </p>
            )}
          </div>

          {/* Agent */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('project.agent')}</label>
            <select
              value={selectedAgentId}
              onChange={e => { setSelectedAgentId(e.target.value); setDirty(true) }}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none focus:border-blue-500"
            >
              <option value="">{t('project.defaultScopeAgent')}</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
            </select>
          </div>

          {/* Save button for scope/agent changes */}
          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {saving ? t('project.saving') : t('project.saveScopeAgent')}
            </button>
          )}

          <div className="border-t border-gray-800 pt-4">
            {/* Auto-process toggle */}
            <label className="flex items-center justify-between px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors">
              <div>
                <div className="text-sm text-white">{t('project.autoProcess')}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {t('project.autoProcessDesc')}
                </div>
              </div>
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => onToggleAutoProcess(!autoProcess)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${autoProcess ? 'bg-green-600' : 'bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${autoProcess ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
                </button>
              </div>
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Issue Card
// ============================================================================

function ReadinessRing({ score, size = 28 }: { score: number; size?: number }) {
  const radius = (size - 4) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? '#4ade80' : score >= 50 ? '#facc15' : '#f87171'
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }} title={`Readiness: ${score}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#374151" strokeWidth={2} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={2}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  )
}

function IssueCard({ issue, relations, onDragStart, onClick }: { issue: ProjectIssue; relations?: IssueRelation[]; onDragStart: () => void; onClick: () => void }) {
  const { t } = useTranslation()
  const priority = PRIORITY_BADGES[issue.priority]
  const isWorking = issue.status === 'in_progress' && issue.workspace_session_id
  const isAnalyzing = issue.ai_analysis_status === 'analyzing'
  const profile = issue.created_by_profile
  const creatorInitial = profile?.full_name?.charAt(0) ?? profile?.username?.charAt(0) ?? '?'

  const pendingConflicts = relations?.filter(r => r.relation_type === 'conflicts_with' && r.status === 'pending') ?? []
  const pendingDeps = relations?.filter(r => r.relation_type === 'depends_on' && r.status === 'pending') ?? []
  const duplicates = relations?.filter(r => r.relation_type === 'duplicates' && r.status === 'pending') ?? []
  const readiness = issue.readiness_score ?? null
  const showReadiness = ['backlog', 'todo'].includes(issue.status) && readiness !== null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`bg-gray-800 border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-gray-600 transition-colors group ${
        pendingConflicts.length > 0 ? 'border-red-500/40' :
        isWorking ? 'border-yellow-500/50' : 'border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] text-gray-500">#{issue.issue_number}</span>
            {priority && <span className={`text-xs ${priority.cls}`}>{priority.label}</span>}
            {isWorking && (
              <span className="flex items-center gap-0.5 text-[10px] text-yellow-400">
                <Bot size={10} className="animate-pulse" /> {t('project.issueWorking')}
              </span>
            )}
            {isAnalyzing && (
              <span className="flex items-center gap-0.5 text-[10px] text-purple-400">
                <Sparkles size={10} className="animate-pulse" /> {t('project.issueAnalyzing')}
              </span>
            )}
          </div>
          <p className="text-xs text-white font-medium leading-snug">{issue.title}</p>
        </div>
        {showReadiness ? (
          <ReadinessRing score={readiness} size={28} />
        ) : (
          <GripVertical size={12} className="text-gray-600 flex-shrink-0 mt-0.5" />
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1 flex-wrap">
          {issue.labels.map((label: string, i: number) => (
            <span key={i} className="px-1.5 py-0.5 bg-gray-700 text-[10px] text-gray-400 rounded">{label}</span>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {pendingConflicts.length > 0 && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400" title={`${pendingConflicts.length} conflict(s)`}>
              ⚠️ {pendingConflicts.length}
            </span>
          )}
          {pendingDeps.length > 0 && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400" title={`${pendingDeps.length} dependency(ies)`}>
              🔗 {pendingDeps.length}
            </span>
          )}
          {duplicates.length > 0 && (
            <span className="px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded text-[10px] text-orange-400" title="Possible duplicate">
              📋
            </span>
          )}
          {issue._count?.comments ? (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
              <MessageSquare size={10} /> {issue._count.comments}
            </span>
          ) : null}
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium bg-gray-600 text-gray-300 overflow-hidden flex-shrink-0" title={profile?.full_name ?? 'Creator'}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              creatorInitial
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
