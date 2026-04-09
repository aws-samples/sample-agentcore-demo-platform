import { useMemo, useState } from 'react'
import { Briefcase, LayoutGrid, Spade, Plus, Shield, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/i18n'
import { DepartmentSection, CommandCenter } from '@/components'
import { AgentCard } from '@/components/AgentCard'
import { ScopeAccessPanel } from '@/components/ScopeAccessPanel'
import { useAgents } from '@/services/useAgents'
import { useBusinessScopes } from '@/services/useBusinessScopes'
import { useAuth } from '@/services/AuthContext'
import { getAvatarDisplayUrl, getAvatarFallback, shouldShowAvatarImage } from '@/utils/avatarUtils'
import type { Agent, SystemStats } from '@/types'
import type { BusinessScope } from '@/services/businessScopeService'

type DashboardView = 'classic' | 'casino'

// Default icon colors for business scopes that don't have a color set
const DEFAULT_COLORS = [
  'bg-purple-500/20',
  'bg-blue-500/20',
  'bg-pink-500/20',
  'bg-green-500/20',
  'bg-orange-500/20',
  'bg-cyan-500/20',
  'bg-yellow-500/20',
]

function calculateStats(agents: Agent[]): SystemStats {
  const activeAgents = agents.filter(a => a.status === 'active').length
  const totalTasks = agents.reduce((sum, a) => sum + (a.metrics?.taskCount || 0), 0)
  const avgCompliance = agents.length > 0 
    ? Math.round(agents.reduce((sum, a) => sum + (a.metrics?.responseRate || 0), 0) / agents.length) 
    : 0
  const activeTasks = agents.filter(a => a.status === 'busy').length * 2 + agents.filter(a => a.status === 'active').length
  return { 
    totalActiveAgents: activeAgents, 
    tasksAutomated: totalTasks, 
    slaCompliance: avgCompliance, 
    activeTaskCount: activeTasks 
  }
}

// Maps legacy department names to business scope names for backward compatibility
function findScopeForAgent(
  agent: Agent, 
  businessScopes: { id: string; name: string }[]
): { id: string; name: string } | null {
  const dept = agent.department
  
  // First try to match by ID (UUID from Supabase)
  const byId = businessScopes.find(s => s.id === dept)
  if (byId) return byId
  
  // Fall back to matching by name (legacy department names)
  const legacyNameMap: Record<string, string> = {
    'hr': 'HR',
    'it': 'IT',
    'marketing': 'Marketing',
    'sales': 'Sales',
    'support': 'Customer Support',
  }
  const scopeName = legacyNameMap[dept] || dept
  return businessScopes.find(s => s.name.toLowerCase() === scopeName.toLowerCase()) || null
}

function DigitalTwinCard({ scope }: { scope: BusinessScope }) {
  const navigate = useNavigate()
  const avatarUrl = getAvatarDisplayUrl(scope.avatar ?? null)
  const avatarFallback = getAvatarFallback(scope.name, scope.avatar)
  const showImage = shouldShowAvatarImage(scope.avatar ?? null)

  return (
    <button
      onClick={() => navigate(`/agents?scope=${scope.id}`)}
      className="w-full bg-gray-800/50 hover:bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all text-left group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden">
          {showImage && avatarUrl ? (
            <img
              src={avatarUrl}
              alt={scope.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.parentElement!.textContent = avatarFallback
              }}
            />
          ) : avatarFallback}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate group-hover:text-blue-400 transition-colors">
            {scope.name}
          </p>
          <p className="text-gray-400 text-sm truncate">{scope.role || 'Digital Twin'}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-green-400">Active</span>
        </div>
      </div>
    </button>
  )
}

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [view, setView] = useState<DashboardView>('classic')
  const { agents, isLoading: agentsLoading } = useAgents({ pollInterval: 5000 })
  const { businessScopes, isLoading: scopesLoading } = useBusinessScopes()
  const { user } = useAuth()
  const [accessScope, setAccessScope] = useState<BusinessScope | null>(null)

  const isAdmin = user?.role === 'owner' || user?.role === 'admin'

  const stats = useMemo(() => calculateStats(agents), [agents])
  
  // Group agents by their business scope
  const agentsByScopeId = useMemo(() => {
    const grouped: Record<string, Agent[]> = {}
    
    for (const agent of agents) {
      const scope = findScopeForAgent(agent, businessScopes)
      const key = scope?.id || 'unassigned'
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(agent)
    }
    
    return grouped
  }, [agents, businessScopes])

  const isLoading = agentsLoading || scopesLoading

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-gray-400">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with view toggle and create button */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/create-business-scope')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:shadow-lg hover:shadow-purple-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Team
          </button>
          <button
            onClick={() => navigate('/create-digital-twin')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:shadow-lg hover:shadow-blue-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Agent
          </button>
          <div className="flex items-center gap-1 bg-gray-800/60 rounded-lg p-1 border border-white/[0.06]">
            <button
              onClick={() => setView('classic')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'classic' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              aria-label="Classic dashboard view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Classic
            </button>
            <button
              onClick={() => setView('casino')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'casino' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              aria-label="Casino dashboard view"
            >
              <Spade className="w-3.5 h-3.5" />
              Casino
            </button>
          </div>
        </div>
      </div>

      {view === 'casino' ? (
        <CommandCenter
          stats={stats}
          businessScopes={businessScopes}
          agentsByScopeId={agentsByScopeId}
        />
      ) : (
        <div className="space-y-6">
            {businessScopes.filter(s => s.scopeType !== 'digital_twin').map((scope, index) => {
              const scopeAgents = agentsByScopeId[scope.id] || []
              const bgColor = scope.color 
                ? `bg-[${scope.color}]/20` 
                : DEFAULT_COLORS[index % DEFAULT_COLORS.length]
              
              return (
                <div key={scope.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center`}>
                      {scope.icon ? <span>{scope.icon}</span> : <Briefcase className="w-4 h-4 text-white" />}
                    </div>
                    <h3 className="text-white font-semibold">{scope.name}</h3>
                    <span className="text-gray-500 text-sm">({scopeAgents.length})</span>
                    {scope.visibility === 'restricted' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/20 text-yellow-400 rounded">Restricted</span>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => setAccessScope(scope)}
                        className="ml-auto p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                        title="Manage scope access"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
                    {scopeAgents.map((agent) => (
                      <AgentCard key={agent.id} agent={agent} />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Digital Twin agents — rendered as agent-style cards */}
            {businessScopes.some(s => s.scopeType === 'digital_twin') && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-indigo-400" />
                  </div>
                  <h3 className="text-white font-semibold">Standalone Agents</h3>
                  <span className="text-gray-500 text-sm">({businessScopes.filter(s => s.scopeType === 'digital_twin').length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
                  {businessScopes.filter(s => s.scopeType === 'digital_twin').map((scope) => (
                    <DigitalTwinCard key={scope.id} scope={scope} />
                  ))}
                </div>
              </div>
            )}
            
            {/* Show unassigned agents if any */}
            {agentsByScopeId['unassigned']?.length > 0 && (
              <DepartmentSection
                name={t('dashboard.unassigned') || 'Unassigned'}
                icon={<Briefcase className="w-4 h-4 text-white" />}
                color="bg-gray-500/20"
                agents={agentsByScopeId['unassigned']}
              />
            )}
          </div>
      )}

      {/* Scope Access Control Modal */}
      {accessScope && (
        <ScopeAccessPanel
          scopeId={accessScope.id}
          scopeName={accessScope.name}
          visibility={accessScope.visibility}
          isAdmin={isAdmin}
          onClose={() => setAccessScope(null)}
          onVisibilityChange={(v) => {
            setAccessScope((prev) => prev ? { ...prev, visibility: v } : null)
          }}
        />
      )}
    </div>
  )
}
