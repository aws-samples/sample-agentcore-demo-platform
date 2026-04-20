import { useState, useEffect } from 'react'
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  Wrench, 
  Target, 
  FileText,
  Settings,
  Trash2,
  Power,
  Users,
  Zap,
  Terminal,
  AlertCircle,
  ArrowRight,
  ChevronDown,
} from 'lucide-react'
import type { Agent, AgentStatus } from '@/types'
import { useTranslation } from '@/i18n'
import { getAvatarDisplayUrl, getAvatarFallback, shouldShowAvatarImage } from '@/utils/avatarUtils'
import { restClient } from '@/services/api/restClient'
import { DocGroupsPanel } from './DocGroupsPanel'
import { IMChannelsPanel } from './IMChannelsPanel'
import { ScopeMemoryPanel } from './ScopeMemoryPanel'
import { MCPServersPanel } from './MCPServersPanel'

interface AgentProfileProps {
  agent: Agent
  onConfigure?: (agentId: string) => void
  onRemove?: (agentId: string) => void
  onToggleStatus?: (agentId: string, newStatus: AgentStatus) => void
}

/** Shape returned by GET /api/agents/:id/events */
interface AgentEvent {
  id: string
  sessionId: string | null
  agentId: string | null
  agentName: string | null
  targetAgentId: string | null
  targetAgentName: string | null
  eventType: string
  eventName: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

const statusColors: Record<AgentStatus, { bg: string; dot: string; text: string }> = {
  active: { bg: 'bg-green-500/10', dot: 'bg-green-500', text: 'text-green-400' },
  busy: { bg: 'bg-blue-500/10', dot: 'bg-blue-500', text: 'text-blue-400' },
  offline: { bg: 'bg-gray-500/10', dot: 'bg-gray-500', text: 'text-gray-400' },
}


export function AgentProfile({ agent, onConfigure, onRemove, onToggleStatus }: AgentProfileProps) {
  const { t } = useTranslation()
  const statusStyle = statusColors[agent.status] || statusColors.active
  const isDisabled = agent.status === 'offline'

  const avatarUrl = getAvatarDisplayUrl(agent.avatar)
  const avatarFallback = getAvatarFallback(agent.displayName, agent.avatar)
  const showImage = shouldShowAvatarImage(agent.avatar)

  // Fetch execution events
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setEventsLoading(true)
    restClient.get<{ data: AgentEvent[] }>(`/api/agents/${agent.id}/events?limit=50`)
      .then(res => { if (!cancelled) setEvents(res.data) })
      .catch(() => { if (!cancelled) setEvents([]) })
      .finally(() => { if (!cancelled) setEventsLoading(false) })
    return () => { cancelled = true }
  }, [agent.id])

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header Section */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold overflow-hidden">
            {showImage && avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={agent.displayName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.parentElement!.textContent = avatarFallback
                }}
              />
            ) : (
              avatarFallback
            )}
          </div>
          
          {/* Name and Role */}
          <div>
            <h2 className="text-xl font-bold text-white">{agent.displayName}</h2>
            <p className="text-gray-400">{agent.role}</p>
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full mt-2 ${statusStyle.bg}`}>
              <div className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
              <span className={`text-xs ${statusStyle.text}`}>
                {t(`status.${agent.status}`)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onToggleStatus && (
            <button
              onClick={() => onToggleStatus(agent.id, isDisabled ? 'active' : 'offline')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isDisabled
                  ? 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
                  : 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400'
              }`}
              title={isDisabled ? t('agentProfile.enableAgent') : t('agentProfile.disableAgent')}
            >
              <Power className="w-4 h-4" />
              <span className="text-sm">{isDisabled ? t('common.enable') : t('common.disable')}</span>
            </button>
          )}
          {onConfigure && (
            <button
              onClick={() => onConfigure(agent.id)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">{t('common.edit')}</span>
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(agent.id)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg text-red-400 transition-colors"
              title={t('agentProfile.removeAgent')}
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">{t('common.remove')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {t('agents.metrics')}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard
            icon={<CheckCircle className="w-5 h-5 text-blue-400" />}
            label={t('agents.taskCount')}
            value={agent.metrics.taskCount.toString()}
          />
          <MetricCard
            icon={<Activity className="w-5 h-5 text-green-400" />}
            label={t('agents.responseRate')}
            value={`${agent.metrics.responseRate}%`}
          />
          <MetricCard
            icon={<Clock className="w-5 h-5 text-purple-400" />}
            label={t('agents.avgResponseTime')}
            value={agent.metrics.avgResponseTime}
          />
          {(agent.metrics.subagentInvocations ?? 0) > 0 && (
            <MetricCard
              icon={<Users className="w-5 h-5 text-orange-400" />}
              label="Sub-agent Calls"
              value={agent.metrics.subagentInvocations!.toString()}
            />
          )}
          {(agent.metrics.toolCalls ?? 0) > 0 && (
            <MetricCard
              icon={<Zap className="w-5 h-5 text-yellow-400" />}
              label="Tool Calls"
              value={agent.metrics.toolCalls!.toString()}
            />
          )}
        </div>
      </div>

      {/* Operational Scope */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          {t('agents.scope')}
        </h3>
        <div className="flex flex-wrap gap-2">
          {agent.scope.map((item, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300 border border-gray-700"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Sub-agent Skills */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          {t('agents.tools')}
        </h3>
        <div className="space-y-2">
          {agent.tools.map((tool) => (
            <div
              key={tool.id}
              className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700"
            >
              <div className="w-8 h-8 rounded bg-blue-600/20 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{tool.name}</p>
                <p className="text-xs text-gray-400 truncate" title={tool.skillMd}>
                  {tool.skillMd ? tool.skillMd.split('\n')[0].replace(/^#\s*/, '') : t('agentProfile.noDescription')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Prompt */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {t('agents.systemPrompt')}
        </h3>
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
            {agent.systemPrompt}
          </p>
        </div>
      </div>

      {/* Execution Logs */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          {t('agentProfile.executionLogs')}
        </h3>
        {eventsLoading ? (
          <div className="text-gray-500 text-sm py-4 text-center">{t('common.loading')}</div>
        ) : events.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 text-center border border-gray-700 rounded-lg bg-gray-800/30">
            {t('agentProfile.noHistory')}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {events.map(ev => (
              <EventRow key={ev.id} event={ev} currentAgentId={agent.id} />
            ))}
          </div>
        )}
      </div>

      {/* Configuration Panels — same layout as ScopeProfile */}
      <AgentConfigSections agentId={agent.id} agentName={agent.displayName} scopeId={agent.businessScopeId || undefined} />


    </div>
  )
}

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
}

function MetricCard({ icon, label, value }: MetricCardProps) {
  return (
    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Event type styling                                                 */
/* ------------------------------------------------------------------ */
const EVENT_STYLE: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  subagent_invocation: { icon: <Users className="w-3.5 h-3.5" />, color: 'text-orange-400', label: 'agentProfile.eventSubAgent' },
  tool_call:           { icon: <Zap className="w-3.5 h-3.5" />, color: 'text-yellow-400', label: 'agentProfile.eventTool' },
  skill_usage:         { icon: <Wrench className="w-3.5 h-3.5" />, color: 'text-blue-400', label: 'agentProfile.eventSkill' },
  turn_complete:       { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-green-400', label: 'agentProfile.eventComplete' },
  error:               { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'text-red-400', label: 'common.error' },
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

function EventRow({ event, currentAgentId }: { event: AgentEvent; currentAgentId: string }) {
  const [expanded, setExpanded] = useState(false)
  const { t } = useTranslation()
  const style = EVENT_STYLE[event.eventType] ?? { icon: <Activity className="w-3.5 h-3.5" />, color: 'text-gray-400', label: event.eventType }

  // Build description
  let description = event.eventName ?? event.eventType
  if (event.eventType === 'subagent_invocation') {
    const isTarget = event.targetAgentId === currentAgentId
    if (isTarget && event.agentName) {
      description = `Invoked by ${event.agentName}`
    } else if (event.targetAgentName) {
      description = `Delegated to ${event.targetAgentName}`
    } else {
      description = event.eventName ?? 'Sub-agent call'
    }
  } else if (event.eventType === 'turn_complete') {
    const ms = (event.metadata as Record<string, unknown>)?.durationMs
    description = ms ? `Completed in ${Number(ms) < 1000 ? `${Math.round(Number(ms))}ms` : `${(Number(ms) / 1000).toFixed(1)}s`}` : 'Turn completed'
  } else if (event.eventType === 'error') {
    description = (event.metadata as Record<string, unknown>)?.message as string ?? event.eventName ?? 'Error'
  }

  const meta = event.metadata as Record<string, unknown> | null
  const detailEntries = buildDetailEntries(event, meta)

  return (
    <div className="rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-colors bg-gray-800/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-3 px-3 py-2 w-full text-left"
      >
        <div className={`flex-shrink-0 ${style.color}`}>{style.icon}</div>
        <span className={`text-[10px] font-semibold uppercase tracking-wider flex-shrink-0 w-16 ${style.color}`}>
          {t(style.label)}
        </span>
        {event.eventType === 'subagent_invocation' && (
          <ArrowRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
        )}
        <span className="text-sm text-gray-300 truncate flex-1" title={description}>
          {description}
        </span>
        <span className="text-[10px] text-gray-500 flex-shrink-0 tabular-nums">
          {formatRelativeTime(event.createdAt)}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && detailEntries.length > 0 && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-700/40 space-y-1.5">
          {detailEntries.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider flex-shrink-0 w-24 pt-0.5">{label}</span>
              <span className="text-xs text-gray-300 break-all whitespace-pre-wrap">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Extract human-readable detail entries from an event. */
function buildDetailEntries(event: AgentEvent, meta: Record<string, unknown> | null): [string, string][] {
  const entries: [string, string][] = []

  // Timestamp
  entries.push(['Time', new Date(event.createdAt).toLocaleString()])

  // Session
  if (event.sessionId) entries.push(['Session', event.sessionId])

  // Agent context
  if (event.agentName) entries.push(['Source Agent', event.agentName])
  if (event.targetAgentName) entries.push(['Target Agent', event.targetAgentName])

  if (!meta) return entries

  // Event-type-specific fields
  if (meta.prompt && typeof meta.prompt === 'string') {
    entries.push(['Prompt', meta.prompt.length > 500 ? meta.prompt.slice(0, 500) + '…' : meta.prompt])
  }
  if (meta.description && typeof meta.description === 'string') {
    entries.push(['Description', meta.description])
  }
  if (meta.durationMs != null) {
    const ms = Number(meta.durationMs)
    entries.push(['Duration', ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`])
  }
  if (meta.numTurns != null) {
    entries.push(['Turns', String(meta.numTurns)])
  }
  if (meta.message && typeof meta.message === 'string') {
    entries.push(['Message', meta.message])
  }
  if (meta.toolUseId && typeof meta.toolUseId === 'string') {
    entries.push(['Tool Use ID', meta.toolUseId])
  }

  return entries
}


// ============================================================================
// Agent Configuration Sections — same layout as ScopeProfile
// ============================================================================

function AgentConfigSections({ agentId, agentName, scopeId }: { agentId: string; agentName: string; scopeId?: string }) {
  // Use the scopeId if available, otherwise use agentId as the identifier for panels
  const effectiveId = scopeId || agentId
  const effectiveName = agentName
  const [mcpPanelOpen, setMcpPanelOpen] = useState(false)
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {/* MCP Servers */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            {t('agentProfile.mcpServers')}
          </h3>
          <button
            onClick={() => setMcpPanelOpen(true)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {t('agentProfile.manage')}
          </button>
        </div>
        <MCPServersPanel open={mcpPanelOpen} onClose={() => setMcpPanelOpen(false)} sessionId={null} />
      </div>

      {/* Knowledge Base */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden p-4">
        <DocGroupsPanel scopeId={effectiveId} scopeName={effectiveName} />
      </div>

      {/* IM Channels */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden p-4">
        <IMChannelsPanel scopeId={effectiveId} scopeName={effectiveName} />
      </div>

      {/* Memory */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden p-4">
        <ScopeMemoryPanel scopeId={effectiveId} scopeName={effectiveName} />
      </div>
    </div>
  )
}
