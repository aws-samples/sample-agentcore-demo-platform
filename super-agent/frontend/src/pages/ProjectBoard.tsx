/**
 * ProjectBoard Page
 * Kanban board + list view with agent execution and auto-process.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, LayoutGrid, List, Loader2, GripVertical, Bot, User, MessageSquare, Settings, Play, X, Sparkles, Terminal, ChevronDown, ChevronUp } from 'lucide-react'
import { RestProjectService, type Project, type ProjectIssue } from '@/services/api/restProjectService'
import { WorkspaceExplorer } from '@/components'

const LANES = [
  { id: 'backlog', label: 'Backlog', color: 'border-gray-600' },
  { id: 'todo', label: 'Todo', color: 'border-blue-600' },
  { id: 'in_progress', label: 'In Progress', color: 'border-yellow-600' },
  { id: 'in_review', label: 'In Review', color: 'border-purple-600' },
  { id: 'done', label: 'Done', color: 'border-green-600' },
]

const PRIORITY_BADGES: Record<string, { label: string; cls: string }> = {
  critical: { label: '🔴', cls: 'text-red-400' },
  high: { label: '🟠', cls: 'text-orange-400' },
  medium: { label: '🟡', cls: 'text-yellow-400' },
  low: { label: '🟢', cls: 'text-green-400' },
}

type ViewMode = 'board' | 'list'

export function ProjectBoard() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
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

  // Create issue form
  const [newIssueTitle, setNewIssueTitle] = useState('')
  const [newIssueLane, setNewIssueLane] = useState('backlog')
  const [newIssuePriority, setNewIssuePriority] = useState('medium')

  // Settings
  const [autoProcess, setAutoProcess] = useState(false)
  const autoProcessRef = useRef(false)
  const autoProcessTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
        const res = await restClient.get<{ data: Array<{ id: string; type: string; content: string; created_at: string }> }>(
          `/api/chat/sessions/${sessionId}/messages?limit=50`
        )
        setConsoleMessages(res.data ?? [])
        setTimeout(() => consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      } catch { /* ignore */ }
    }

    loadMessages()
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [showConsole, project?.workspace_session_id])

  // Auto-process polling: when enabled, check every 10s if there's a todo to pick up
  useEffect(() => {
    if (autoProcessTimerRef.current) {
      clearInterval(autoProcessTimerRef.current)
      autoProcessTimerRef.current = null
    }
    if (autoProcess && projectId) {
      autoProcessTimerRef.current = setInterval(async () => {
        if (!autoProcessRef.current || !projectId) return
        try {
          const result = await RestProjectService.autoProcessNext(projectId)
          if (result.status === 'started') {
            if (result.session_id) {
              setProject(prev => prev ? { ...prev, workspace_session_id: result.session_id! } : prev)
            }
            setWsRefreshKey(k => k + 1)
            loadData() // refresh board
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
      loadData()
    } catch (err) {
      console.error('Execute failed:', err)
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
    if (!projectId || !selectedIssue || !confirm('Delete this issue?')) return
    await RestProjectService.deleteIssue(projectId, selectedIssue.id)
    setSelectedIssue(null)
    loadData()
  }

  const _handleDeleteIssue = async (issueId: string) => {
    if (!projectId || !confirm('Delete this issue?')) return
    await RestProjectService.deleteIssue(projectId, issueId)
    loadData()
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  }
  if (!project) {
    return <div className="flex items-center justify-center h-full text-gray-400">Project not found</div>
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
            <Plus size={14} /> New Issue
          </button>
          <button onClick={() => setShowSettings(true)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" title="Project Settings">
            <Settings size={18} />
          </button>
          <button
            onClick={() => setShowConsole(!showConsole)}
            className={`p-1.5 rounded-lg transition-colors ${showConsole ? 'text-green-400 bg-green-600/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            title="Agent Console"
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
                  <span className="text-xs font-medium text-gray-300">{lane.label}</span>
                  <span className="text-xs text-gray-500">{laneIssues.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
                  {laneIssues.map(issue => (
                    <IssueCard key={issue.id} issue={issue} onDragStart={() => setDragIssueId(issue.id)} onClick={() => handleOpenIssue(issue)} />
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
                <th className="pb-2">#</th><th className="pb-2">Title</th><th className="pb-2">Status</th><th className="pb-2">Priority</th><th className="pb-2">Creator</th><th className="pb-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {issues.map(issue => (
                <tr key={issue.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => handleOpenIssue(issue)}>
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
              <span className="text-xs font-medium text-gray-300">Agent Console</span>
              {consoleMessages.length > 0 && (
                <span className="text-[10px] text-gray-500">{consoleMessages.length} messages</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConsoleHeight(h => h === 200 ? 400 : 200)}
                className="p-1 text-gray-500 hover:text-white rounded transition-colors"
                title={consoleHeight === 200 ? 'Expand' : 'Shrink'}
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
                  ? 'Waiting for agent activity...'
                  : 'No workspace session yet. Start a task to see agent output.'}
              </div>
            ) : (
              consoleMessages.map(msg => (
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
                  <span className={`flex-1 break-words ${
                    msg.type === 'user' ? 'text-blue-300' :
                    msg.type === 'agent' || msg.type === 'ai' ? 'text-green-300' :
                    'text-gray-500'
                  }`}>
                    {msg.content.length > 500 ? msg.content.substring(0, 500) + '...' : msg.content}
                  </span>
                </div>
              ))
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>
      )}

      {/* Create Issue Dialog */}
      {showCreateIssue && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreateIssue(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-4">New Issue</h3>
            <div className="space-y-3">
              <input value={newIssueTitle} onChange={e => setNewIssueTitle(e.target.value)} placeholder="Issue title..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500" autoFocus onKeyDown={e => e.key === 'Enter' && handleCreateIssue()} />
              <div className="grid grid-cols-2 gap-2">
                <select value={newIssueLane} onChange={e => setNewIssueLane(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none">
                  {LANES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
                <select value={newIssuePriority} onChange={e => setNewIssuePriority(e.target.value)} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none">
                  <option value="critical">🔴 Critical</option>
                  <option value="high">🟠 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreateIssue(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
                <button onClick={handleCreateIssue} disabled={!newIssueTitle.trim()} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs rounded-lg transition-colors">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execute Confirmation Dialog */}
      {showExecuteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowExecuteConfirm(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[420px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-2">Start Agent Execution?</h3>
            <p className="text-xs text-gray-400 mb-4">
              Moving <span className="text-white font-medium">#{showExecuteConfirm.issue_number} {showExecuteConfirm.title}</span> to In Progress.
            </p>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot size={16} className="text-purple-400" />
                <span className="text-xs text-gray-300">
                  {project?.agent_id ? 'Project Agent' : 'Default Claude Code Agent'}
                </span>
              </div>
              <p className="text-[10px] text-gray-500">
                The agent will create a branch, receive the issue description, and start coding.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExecuteConfirm(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSkipExecute} className="px-3 py-1.5 text-xs text-gray-300 hover:text-white border border-gray-600 rounded-lg transition-colors">
                Just Move (no agent)
              </button>
              <button onClick={() => handleExecuteConfirm()} className="flex items-center gap-1 px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded-lg transition-colors">
                <Play size={12} /> Start Agent
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
                <button onClick={handleDeleteSelectedIssue} className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors" title="Delete issue">
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
                <label className="block text-xs text-gray-400 mb-1">Title</label>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">Description</label>
                  <button
                    onClick={async () => {
                      if (!projectId || !selectedIssue) return
                      setEditDesc('✨ Beautifying...')
                      try {
                        const improved = await RestProjectService.beautifyDescription(projectId, selectedIssue.id)
                        setEditDesc(improved)
                      } catch { setEditDesc(editDesc === '✨ Beautifying...' ? (selectedIssue.description ?? '') : editDesc) }
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded transition-colors"
                    title="Use AI to improve this description"
                  >
                    <Sparkles size={10} /> AI Beautify
                  </button>
                </div>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={6}
                  placeholder="Describe the task in detail..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none focus:border-blue-500">
                    {LANES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Priority</label>
                  <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none focus:border-blue-500">
                    <option value="critical">🔴 Critical</option>
                    <option value="high">🟠 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>
              </div>

              {/* Branch info (if agent has worked on it) */}
              {selectedIssue.branch_name && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Branch</div>
                  <code className="text-xs text-blue-400">{selectedIssue.branch_name}</code>
                </div>
              )}

              {/* Creator */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Created by</div>
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
                <div className="text-xs text-gray-400 mb-1">Project Agent</div>
                <div className="flex items-center gap-2 text-sm">
                  {project?.agent_id ? (
                    <><Bot size={14} className="text-purple-400" /> <span className="text-gray-300">Custom Agent</span></>
                  ) : (
                    <><Bot size={14} className="text-gray-500" /> <span className="text-gray-500">Default Claude Code Agent</span></>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-800">
              <button onClick={() => setSelectedIssue(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSaveIssue} disabled={isSavingIssue || !editTitle.trim()} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs rounded-lg transition-colors">
                {isSavingIssue ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowSettings(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Project Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white"><X size={16} /></button>
            </div>

            <div className="space-y-4">
              <label className="flex items-center justify-between px-3 py-3 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors">
                <div>
                  <div className="text-sm text-white">Auto-process Todo items</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    When enabled, the system automatically picks up Todo items one by one and assigns them to an agent. The current item moves to In Progress.
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={() => handleToggleAutoProcess(!autoProcess)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${autoProcess ? 'bg-green-600' : 'bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${autoProcess ? 'left-5.5 translate-x-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowSettings(false)} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Issue Card
// ============================================================================

function IssueCard({ issue, onDragStart, onClick }: { issue: ProjectIssue; onDragStart: () => void; onClick: () => void }) {
  const priority = PRIORITY_BADGES[issue.priority]
  const isWorking = issue.status === 'in_progress' && issue.workspace_session_id
  const profile = issue.created_by_profile
  const creatorInitial = profile?.full_name?.charAt(0) ?? profile?.username?.charAt(0) ?? '?'
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`bg-gray-800 border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-gray-600 transition-colors group ${
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
                <Bot size={10} className="animate-pulse" /> Working...
              </span>
            )}
          </div>
          <p className="text-xs text-white font-medium leading-snug">{issue.title}</p>
        </div>
        <GripVertical size={12} className="text-gray-600 flex-shrink-0 mt-0.5" />
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          {issue.labels.map((label: string, i: number) => (
            <span key={i} className="px-1.5 py-0.5 bg-gray-700 text-[10px] text-gray-400 rounded">{label}</span>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {issue._count?.comments ? (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
              <MessageSquare size={10} /> {issue._count.comments}
            </span>
          ) : null}
          {/* Creator avatar */}
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
