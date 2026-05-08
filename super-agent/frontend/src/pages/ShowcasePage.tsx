/**
 * ShowcasePage — "企业Agent大赏" / Enterprise Agent Showcase.
 *
 * Displays agent capabilities organized by Industry (tabs) → Domain (sections) → Cases (cards).
 * Features:
 *   - Hero banner with aggregate stats
 *   - Industry tabs with icons and gradient accents
 *   - Domain sections with scope-level summary cards (large) and agent cards (compact)
 *   - Deploy/Try actions with status badges
 *   - My Favorites tab
 *   - Admin panel for managing industries and domains
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/i18n'
import {
  Star, Loader2, Play, Settings, Plus, Pencil, Trash2, X,
  ChevronRight, MessageSquare, Clock, Heart, Download, Sparkles,
  Zap, Users, Brain, CheckCircle2, Rocket,
} from 'lucide-react'
import { restClient } from '@/services/api/restClient'

// ============================================================================
// Types
// ============================================================================

interface ShowcaseCase {
  id: string
  title: string
  description: string | null
  initial_prompt: string | null
  session_id: string | null
  agent_id: string | null
  workflow_id: string | null
  scope_id: string | null
  run_config: Record<string, unknown>
  sort_order: number
}

interface ShowcaseDomain {
  id: string
  name: string
  name_en: string | null
  icon: string | null
  sort_order: number
  cases: ShowcaseCase[]
}

interface ShowcaseIndustry {
  id: string
  name: string
  slug: string
  sort_order: number
  domains: ShowcaseDomain[]
}

interface StarredSession {
  id: string
  title: string | null
  status: string
  user_id: string
  starred_at: string | null
  starred_by: string | null
  star_category: string | null
  created_at: string
  updated_at: string
  business_scope?: { id: string; name: string; icon: string | null } | null
}

// ============================================================================
// Main Page
// ============================================================================

export function ShowcasePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [industries, setIndustries] = useState<ShowcaseIndustry[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdmin, setShowAdmin] = useState(false)
  const [deployedScopes, setDeployedScopes] = useState<Set<string>>(new Set())
  const [deploying, setDeploying] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await restClient.get<{ data: ShowcaseIndustry[] }>('/api/showcase')
      const list = res.data || []
      setIndustries(list)
      if (list.length > 0 && !activeTab) {
        setActiveTab(list[0].id)
      }
    } catch (err) {
      console.error('Failed to load showcase data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const activeIndustry = activeTab !== '__favorites__' ? industries.find(i => i.id === activeTab) : null

  // Aggregate stats
  const totalIndustries = industries.length
  const totalDomains = industries.reduce((sum, i) => sum + i.domains.length, 0)
  const totalCases = industries.reduce((sum, i) => sum + i.domains.reduce((s, d) => s + d.cases.length, 0), 0)

  const handleDeploy = async (c: ShowcaseCase) => {
    const config = c.run_config || {}
    const packId = config.pack_id as string
    const scopeDir = config.scope_dir as string || config.twin_dir as string
    if (!packId) return

    setDeploying(c.id)
    let scopeId: string | undefined

    try {
      const res = await restClient.post<{ data: { scopeId: string } }>('/api/packs/deploy', {
        packId,
        scopeDirName: scopeDir,
      })
      scopeId = res.data?.scopeId
      setDeployedScopes(prev => new Set([...prev, `${packId}/${scopeDir}`]))
    } catch (err: any) {
      if (err?.response?.status === 409) {
        scopeId = err?.response?.data?.data?.scopeId
        setDeployedScopes(prev => new Set([...prev, `${packId}/${scopeDir}`]))
      } else {
        console.error('Deploy failed:', err)
      }
    }

    setDeploying(null)

    // Always navigate to chat after deploy attempt
    const params = new URLSearchParams()
    if (scopeId) params.set('scope', scopeId)
    const prompt = c.initial_prompt || c.description
    if (prompt) params.set('prompt', prompt)
    params.set('t', Date.now().toString()) // force remount
    navigate(`/chat?${params.toString()}`)
  }

  const isDeployed = (c: ShowcaseCase) => {
    const config = c.run_config || {}
    const scopeDir = config.scope_dir as string || config.twin_dir as string
    return deployedScopes.has(`${config.pack_id}/${scopeDir}`)
  }

  return (
    <div className="h-full flex">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto bg-gray-950">
        {/* Hero Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-gray-950 border-b border-gray-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-500/5 via-transparent to-transparent" />
          <div className="relative px-8 pt-6 pb-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-wide">{t('showcase.title')}</h1>
                  <p className="text-xs text-gray-400 mt-0.5">发现、体验、部署行业智能体解决方案</p>
                </div>
              </div>
              <button
                onClick={() => setShowAdmin(!showAdmin)}
                className={`p-2 rounded-lg transition-colors ${
                  showAdmin ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-white hover:bg-gray-800'
                }`}
                title={t('showcase.manageCategories')}
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-6 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Rocket className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div>
                  <span className="text-lg font-bold text-white">{totalIndustries}</span>
                  <span className="text-xs text-gray-500 ml-1">个行业</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Brain className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div>
                  <span className="text-lg font-bold text-white">{totalDomains}</span>
                  <span className="text-xs text-gray-500 ml-1">个场景</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-green-400" />
                </div>
                <div>
                  <span className="text-lg font-bold text-white">{totalCases}</span>
                  <span className="text-xs text-gray-500 ml-1">个智能体</span>
                </div>
              </div>
            </div>

            {/* Industry Tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              {industries.map(ind => (
                <button
                  key={ind.id}
                  onClick={() => setActiveTab(ind.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === ind.id
                      ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/20 text-white border border-blue-500/40 shadow-sm shadow-blue-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent'
                  }`}
                >
                  {ind.name}
                </button>
              ))}
              {/* My Favorites tab — always visible */}
              <button
                onClick={() => setActiveTab('__favorites__')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === '__favorites__'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                {t('showcase.myFavorites')}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {loading && activeTab !== '__favorites__' ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">{t('showcase.loading')}</span>
            </div>
          ) : activeTab === '__favorites__' ? (
            <MyFavoritesPanel />
          ) : industries.length === 0 ? (
            <div className="text-center py-20">
              <Star className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{t('showcase.empty')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('showcase.emptyHint')}</p>
            </div>
          ) : activeIndustry ? (
            <div className="space-y-10">
              {activeIndustry.domains.map(domain => (
                <DomainSection
                  key={domain.id}
                  domain={domain}
                  onDeploy={handleDeploy}
                  isDeployed={isDeployed}
                  deploying={deploying}
                />
              ))}
              {activeIndustry.domains.length === 0 && (
                <p className="text-sm text-gray-600 text-center py-10">{t('showcase.noDomains')}</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Admin Panel */}
      {showAdmin && (
        <AdminPanel
          industries={industries}
          activeIndustryId={activeTab !== '__favorites__' ? activeTab : null}
          onClose={() => setShowAdmin(false)}
          onDataChanged={() => { loadData() }}
        />
      )}
    </div>
  )
}

// ============================================================================
// Domain Section — scope-level summary + agent cards
// ============================================================================

function DomainSection({ domain, onDeploy, isDeployed, deploying }: {
  domain: ShowcaseDomain
  onDeploy: (c: ShowcaseCase) => void
  isDeployed: (c: ShowcaseCase) => boolean
  deploying: string | null
}) {
  // First case (sort_order=0) is the "scope overview" card, rest are agent cards
  // But digital_twin cases should never be treated as scope overview
  const scopeCase = domain.cases.find(c => c.sort_order === 0 && (c.run_config?.type as string) !== 'digital_twin')
  const agentCases = scopeCase ? domain.cases.filter(c => c !== scopeCase) : []
  // If no scope case (e.g. twin-only domain), all cases go to the fallback grid
  const fallbackCases = !scopeCase ? domain.cases : []
  const agentCount = agentCases.length || (scopeCase?.run_config?.agent_count as number) || 0
  const hasWorkflow = scopeCase?.run_config?.has_workflow as boolean

  return (
    <section>
      {/* Domain header */}
      <div className="flex items-center gap-3 mb-4">
        {domain.icon && (
          <span className="text-xl w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">{domain.icon}</span>
        )}
        <div>
          <h2 className="text-base font-semibold text-white">{domain.name}</h2>
          {domain.name_en && (
            <span className="text-xs text-gray-500">{domain.name_en}</span>
          )}
        </div>
        {/* Stats badges */}
        <div className="flex items-center gap-2 ml-3">
          {agentCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-3 h-3" />
              {agentCount} Agents
            </span>
          )}
          {hasWorkflow && (
            <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              <Zap className="w-3 h-3" />
              含工作流
            </span>
          )}
        </div>
      </div>

      {/* Scope overview card (large, prominent) */}
      {scopeCase && (
        <ScopeOverviewCard
          caseItem={scopeCase}
          agentCount={agentCount}
          hasWorkflow={!!hasWorkflow}
          onDeploy={() => onDeploy(scopeCase)}
          deployed={isDeployed(scopeCase)}
          deploying={deploying === scopeCase.id}
        />
      )}

      {/* Agent cards (compact grid) */}
      {agentCases.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
          {agentCases.map(c => {
            const isTwin = (c.run_config?.type as string) === 'digital_twin'
            return isTwin
              ? <TwinCard key={c.id} caseItem={c} onDeploy={() => onDeploy(c)} deploying={deploying === c.id} deployed={isDeployed(c)} />
              : <AgentCard key={c.id} caseItem={c} />
          })}
        </div>
      )}

      {/* Fallback: if no scope case, show all as cards (handles twin-only domains) */}
      {fallbackCases.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {fallbackCases.map(c => {
            const isTwin = (c.run_config?.type as string) === 'digital_twin'
            return isTwin
              ? <TwinCard key={c.id} caseItem={c} onDeploy={() => onDeploy(c)} deploying={deploying === c.id} deployed={isDeployed(c)} />
              : <AgentCard key={c.id} caseItem={c} />
          })}
        </div>
      )}
    </section>
  )
}

// ============================================================================
// Scope Overview Card — large, prominent, with deploy button
// ============================================================================

function ScopeOverviewCard({ caseItem, agentCount, hasWorkflow, onDeploy, deployed, deploying }: {
  caseItem: ShowcaseCase
  agentCount: number
  hasWorkflow: boolean
  onDeploy: () => void
  deployed: boolean
  deploying: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-gray-900 via-gray-900 to-gray-900/80 border border-gray-800 p-5 hover:border-gray-700 transition-all group">
      {/* Subtle gradient accent */}
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-60" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-bold text-white">{caseItem.title}</h3>
            {deployed && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                <CheckCircle2 className="w-3 h-3" />
                已部署
              </span>
            )}
          </div>
          {caseItem.description && (
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-3">{caseItem.description}</p>
          )}
          {/* Meta info */}
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            {agentCount > 0 && <span>{agentCount} 个智能体协作</span>}
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!deployed ? (
            <button
              onClick={onDeploy}
              disabled={deploying}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-all disabled:opacity-50 shadow-sm shadow-blue-500/20"
            >
              {deploying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {deploying ? '部署中...' : '运行'}
            </button>
          ) : (
            <button
              onClick={onDeploy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              继续使用
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Agent Card — compact, for individual agents within a scope
// ============================================================================

function AgentCard({ caseItem }: {
  caseItem: ShowcaseCase
}) {
  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 flex flex-col justify-between hover:border-gray-700 hover:bg-gray-900 transition-all group relative">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <h3 className="text-sm font-medium text-white truncate flex-1">{caseItem.title}</h3>
        </div>
        {caseItem.description && (
          <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3">{caseItem.description}</p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Twin Card — Digital Twin (行业专家) with distinct visual style
// ============================================================================

function TwinCard({ caseItem, onDeploy, deploying, deployed }: { caseItem: ShowcaseCase; onDeploy: () => void; deploying: boolean; deployed: boolean }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-950/30 via-gray-900 to-gray-900 border border-amber-500/20 rounded-xl p-4 flex flex-col justify-between hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 transition-all group">
      {/* Accent corner */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full" />

      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-500/20">
            <span className="text-sm">👤</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{caseItem.title}</h3>
            <span className="text-[10px] text-amber-400/80 font-medium">数字孪生 · 行业专家</span>
          </div>
        </div>
        {caseItem.description && (
          <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-3 mt-1">{caseItem.description}</p>
        )}
      </div>

      <div className="mt-3">
        {!deployed ? (
          <button
            onClick={onDeploy}
            disabled={deploying}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-white bg-amber-600 hover:bg-amber-500 transition-colors disabled:opacity-50"
          >
            {deploying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {deploying ? '部署中...' : '运行'}
          </button>
        ) : (
          <button
            onClick={onDeploy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-green-400 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors"
          >
            <Play className="w-3 h-3" />
            继续使用
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// My Favorites Panel — shows current user's starred sessions
// ============================================================================

function MyFavoritesPanel() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<StarredSession[]>([])
  const [loading, setLoading] = useState(true)

  const loadStarred = useCallback(async () => {
    setLoading(true)
    try {
      const res = await restClient.get<{ data: StarredSession[] }>('/api/chat/sessions/starred')
      setSessions(res.data || [])
    } catch (err) {
      console.error('Failed to load starred sessions:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStarred() }, [loadStarred])

  const handleUnstar = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await restClient.put(`/api/chat/sessions/${sessionId}/unstar`, {})
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    } catch (err) {
      console.error('Failed to unstar:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">{t('showcase.loading')}</span>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20">
        <Heart className="w-10 h-10 text-gray-700 mx-auto mb-3" />
        <p className="text-sm text-gray-500">{t('showcase.noFavorites')}</p>
        <p className="text-xs text-gray-600 mt-1">{t('showcase.noFavoritesHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 mb-4">
        {sessions.length} {t('showcase.favoritesCount')}
      </p>
      {sessions.map(session => (
        <div
          key={session.id}
          onClick={() => navigate(`/chat?session=${session.id}`)}
          className="p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <MessageSquare className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-white block truncate">
                  {session.title || 'Untitled chat'}
                </span>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 flex-wrap">
                  {session.business_scope && (
                    <span className="flex items-center gap-1">
                      {session.business_scope.icon || '📁'} {session.business_scope.name}
                    </span>
                  )}
                  {session.star_category && (
                    <span className="px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-[10px] font-medium">
                      {session.star_category}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(session.starred_at || session.created_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={(e) => handleUnstar(session.id, e)}
              className="p-1.5 rounded-lg text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
              title={t('showcase.removeFavorite')}
            >
              <Star className="w-4 h-4" fill="currentColor" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Admin Panel — manage industries & domains
// ============================================================================

function AdminPanel({ industries, activeIndustryId, onClose, onDataChanged }: {
  industries: ShowcaseIndustry[]
  activeIndustryId: string | null
  onClose: () => void
  onDataChanged: () => void
}) {
  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(activeIndustryId)
  const { t } = useTranslation()
  const selectedIndustry = industries.find(i => i.id === selectedIndustryId)

  return (
    <div className="w-96 border-l border-gray-800 bg-gray-900 flex flex-col overflow-hidden flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">{t('showcase.categoryManagement')}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('showcase.industries')}</span>
            <AddIndustryButton onCreated={onDataChanged} />
          </div>
          <div className="space-y-1">
            {industries.map(ind => (
              <IndustryRow
                key={ind.id}
                industry={ind}
                isSelected={selectedIndustryId === ind.id}
                onSelect={() => setSelectedIndustryId(ind.id)}
                onUpdated={onDataChanged}
                onDeleted={onDataChanged}
              />
            ))}
            {industries.length === 0 && (
              <p className="text-xs text-gray-600 py-2">{t('showcase.noIndustries')}</p>
            )}
          </div>
        </div>

        {selectedIndustry && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {selectedIndustry.name} — {t('showcase.domains')}
              </span>
              <AddDomainButton industryId={selectedIndustry.id} onCreated={onDataChanged} />
            </div>
            <div className="space-y-1">
              {selectedIndustry.domains.map(domain => (
                <DomainRow key={domain.id} domain={domain} onUpdated={onDataChanged} onDeleted={onDataChanged} />
              ))}
              {selectedIndustry.domains.length === 0 && (
                <p className="text-xs text-gray-600 py-2">{t('showcase.noDomains2')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Admin CRUD components (Industry + Domain)
// ============================================================================

function AddIndustryButton({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) return
    setSaving(true)
    try {
      await restClient.post('/api/showcase/industries', { name: name.trim(), slug: slug.trim() })
      setName(''); setSlug(''); setOpen(false); onCreated()
    } catch (err) { console.error('Failed to create industry:', err) }
    finally { setSaving(false) }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition-colors" title={t('showcase.addIndustry')}>
        <Plus className="w-3.5 h-3.5" />
      </button>
    )
  }

  return (
    <div className="mt-2 p-3 bg-gray-800 rounded-lg border border-gray-700 space-y-2">
      <input type="text" value={name} onChange={e => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')) }} placeholder={t('showcase.industryNamePlaceholder')} className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" autoFocus />
      <input type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder={t('showcase.slugPlaceholder')} className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
      <div className="flex justify-end gap-2">
        <button onClick={() => { setOpen(false); setName(''); setSlug('') }} className="px-2 py-1 text-xs text-gray-400 hover:text-white">{t('common.cancel')}</button>
        <button onClick={handleSave} disabled={saving || !name.trim() || !slug.trim()} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50">{saving ? '...' : t('showcase.add')}</button>
      </div>
    </div>
  )
}

function IndustryRow({ industry, isSelected, onSelect, onUpdated, onDeleted }: {
  industry: ShowcaseIndustry; isSelected: boolean; onSelect: () => void; onUpdated: () => void; onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(industry.name)
  const [deleting, setDeleting] = useState(false)
  const { t } = useTranslation()

  const handleSave = async () => {
    if (!name.trim()) return
    try { await restClient.put(`/api/showcase/industries/${industry.id}`, { name: name.trim() }); setEditing(false); onUpdated() }
    catch (err) { console.error('Failed to update industry:', err) }
  }

  const handleDelete = async () => {
    if (!confirm(t('showcase.deleteIndustryConfirm').replace('{name}', industry.name))) return
    setDeleting(true)
    try { await restClient.delete(`/api/showcase/industries/${industry.id}`); onDeleted() }
    catch (err) { console.error('Failed to delete industry:', err) }
    finally { setDeleting(false) }
  }

  return (
    <div onClick={onSelect} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-colors ${isSelected ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800/50'}`}>
      <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isSelected ? 'rotate-90 text-blue-400' : 'text-gray-600'}`} />
      {editing ? (
        <input type="text" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setName(industry.name) } }} onBlur={handleSave} onClick={e => e.stopPropagation()} className="flex-1 px-1.5 py-0.5 bg-gray-900 border border-blue-500 rounded text-sm text-white focus:outline-none" autoFocus />
      ) : (
        <span className="flex-1 text-sm truncate">{industry.name}</span>
      )}
      <span className="text-xs text-gray-600">{industry.domains.length}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); setEditing(true); setName(industry.name) }} className="p-0.5 rounded text-gray-500 hover:text-white"><Pencil className="w-3 h-3" /></button>
        <button onClick={e => { e.stopPropagation(); handleDelete() }} disabled={deleting} className="p-0.5 rounded text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
      </div>
    </div>
  )
}

function AddDomainButton({ industryId, onCreated }: { industryId: string; onCreated: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [icon, setIcon] = useState('')
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerSuggest = useCallback((chineseName: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (!chineseName.trim()) return
    suggestTimer.current = setTimeout(async () => {
      setSuggesting(true)
      try {
        const res = await restClient.post<{ data: { name_en: string; icon: string } }>('/api/showcase/suggest', { name: chineseName.trim() })
        const { name_en, icon: suggestedIcon } = res.data || {}
        setNameEn(prev => prev ? prev : (name_en || ''))
        setIcon(prev => prev ? prev : (suggestedIcon || ''))
      } catch { /* silent */ }
      finally { setSuggesting(false) }
    }, 600)
  }, [])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await restClient.post('/api/showcase/domains', { industry_id: industryId, name: name.trim(), name_en: nameEn.trim() || undefined, icon: icon.trim() || undefined })
      setName(''); setNameEn(''); setIcon(''); setOpen(false); onCreated()
    } catch (err) { console.error('Failed to create domain:', err) }
    finally { setSaving(false) }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition-colors" title={t('showcase.addDomain')}><Plus className="w-3.5 h-3.5" /></button>
  }

  return (
    <div className="mt-2 p-3 bg-gray-800 rounded-lg border border-gray-700 space-y-2">
      <div className="flex gap-2">
        <input type="text" value={icon} onChange={e => setIcon(e.target.value)} placeholder={t('showcase.iconPlaceholder')} className="w-12 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-center text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
        <input type="text" value={name} onChange={e => { setName(e.target.value); triggerSuggest(e.target.value) }} placeholder={t('showcase.domainNamePlaceholder')} className="flex-1 px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" autoFocus />
      </div>
      <div className="relative">
        <input type="text" value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder={suggesting ? t('showcase.aiSuggesting') : t('showcase.enNameOptionalPlaceholder')} className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
        {suggesting && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400 animate-spin" />}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => { setOpen(false); setName(''); setNameEn(''); setIcon('') }} className="px-2 py-1 text-xs text-gray-400 hover:text-white">{t('common.cancel')}</button>
        <button onClick={handleSave} disabled={saving || !name.trim()} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50">{saving ? '...' : t('showcase.add')}</button>
      </div>
    </div>
  )
}

function DomainRow({ domain, onUpdated, onDeleted }: { domain: ShowcaseDomain; onUpdated: () => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(domain.name)
  const [nameEn, setNameEn] = useState(domain.name_en || '')
  const [icon, setIcon] = useState(domain.icon || '')
  const [deleting, setDeleting] = useState(false)
  const { t } = useTranslation()

  const handleSave = async () => {
    if (!name.trim()) return
    try { await restClient.put(`/api/showcase/domains/${domain.id}`, { name: name.trim(), name_en: nameEn.trim() || null, icon: icon.trim() || null }); setEditing(false); onUpdated() }
    catch (err) { console.error('Failed to update domain:', err) }
  }

  const handleDelete = async () => {
    if (!confirm(t('showcase.deleteDomainConfirm').replace('{name}', domain.name))) return
    setDeleting(true)
    try { await restClient.delete(`/api/showcase/domains/${domain.id}`); onDeleted() }
    catch (err) { console.error('Failed to delete domain:', err) }
    finally { setDeleting(false) }
  }

  if (editing) {
    return (
      <div className="p-3 bg-gray-800 rounded-lg border border-blue-500/30 space-y-2">
        <div className="flex gap-2">
          <input type="text" value={icon} onChange={e => setIcon(e.target.value)} placeholder={t('showcase.iconPlaceholder')} className="w-12 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-center text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('showcase.domainNamePlaceholder')} className="flex-1 px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" autoFocus />
        </div>
        <input type="text" value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder={t('showcase.enNamePlaceholder')} className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
        <div className="flex justify-end gap-2">
          <button onClick={() => { setEditing(false); setName(domain.name); setNameEn(domain.name_en || ''); setIcon(domain.icon || '') }} className="px-2 py-1 text-xs text-gray-400 hover:text-white">{t('common.cancel')}</button>
          <button onClick={handleSave} disabled={!name.trim()} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50">{t('showcase.save')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800/50 group transition-colors">
      <span className="text-sm flex-shrink-0">{domain.icon || '📁'}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-200 truncate block">{domain.name}</span>
        {domain.name_en && <span className="text-xs text-gray-600">{domain.name_en}</span>}
      </div>
      <span className="text-xs text-gray-600">{domain.cases.length} {t('showcase.cases')}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => { setEditing(true); setName(domain.name); setNameEn(domain.name_en || ''); setIcon(domain.icon || '') }} className="p-0.5 rounded text-gray-500 hover:text-white"><Pencil className="w-3 h-3" /></button>
        <button onClick={handleDelete} disabled={deleting} className="p-0.5 rounded text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
      </div>
    </div>
  )
}
