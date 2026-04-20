/**
 * Projects List Page
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderKanban, Loader2, Trash2, ChevronDown, Layers, Bot, Search } from 'lucide-react'
import { RestProjectService, type Project } from '@/services/api/restProjectService'
import type { BusinessScope } from '@/services/api/restBusinessScopeService'
import type { Agent } from '@/types'
import { getAvatarDisplayUrl, getAvatarFallback, shouldShowAvatarImage } from '@/utils/avatarUtils'
import { useTranslation } from '@/i18n/useTranslation'

export function Projects() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newRepo, setNewRepo] = useState('')
  // Selection can be a business scope or a digital twin scope or an independent agent
  const [selectedScopeId, setSelectedScopeId] = useState<string>('')
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')

  useEffect(() => {
    RestProjectService.listProjects().then(setProjects).finally(() => setIsLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const project = await RestProjectService.createProject({
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      repo_url: newRepo.trim() || undefined,
      agent_id: selectedAgentId || undefined,
    })
    // If a business scope was selected, update the project with it
    if (selectedScopeId) {
      await RestProjectService.updateProject(project.id, { business_scope_id: selectedScopeId })
    }
    setProjects(prev => [project, ...prev])
    setShowCreate(false)
    setNewName('')
    setNewDesc('')
    setNewRepo('')
    setSelectedScopeId('')
    setSelectedAgentId('')
    navigate(`/projects/${project.id}`)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(t('projects.deleteConfirm'))) return
    await RestProjectService.deleteProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white">{t('projects.title')}</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors">
          <Plus size={14} /> {t('projects.newProject')}
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban size={48} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 mb-2">{t('projects.noProjects')}</p>
          <p className="text-xs text-gray-500">{t('projects.noProjectsHint')}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="flex items-center gap-4 px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors text-left group"
            >
              <FolderKanban size={20} className="text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{p.name}</div>
                {p.description && <div className="text-xs text-gray-500 truncate">{p.description}</div>}
              </div>
              <span className="text-xs text-gray-500">{p._count?.issues ?? 0} {t('projects.issues')}</span>
              <button onClick={e => handleDelete(p.id, e)} className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 size={14} />
              </button>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-4">{t('projects.newProject')}</h3>
            <div className="space-y-3">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('projects.projectName')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500" autoFocus />
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={t('projects.descOptional')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500" />
              <input value={newRepo} onChange={e => setNewRepo(e.target.value)} placeholder={t('projects.repoOptional')} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500" />
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('projects.agentInCharge')}</label>
                <AgentScopeSelector
                  selectedScopeId={selectedScopeId}
                  selectedAgentId={selectedAgentId}
                  onSelectScope={(scopeId) => { setSelectedScopeId(scopeId); setSelectedAgentId('') }}
                  onSelectAgent={(agentId) => { setSelectedAgentId(agentId); setSelectedScopeId('') }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">{t('common.cancel')}</button>
                <button onClick={handleCreate} disabled={!newName.trim()} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-xs rounded-lg transition-colors">{t('common.create')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// AgentScopeSelector — Unified dropdown matching Chat module UX
// ============================================================================

interface AgentScopeSelectorProps {
  selectedScopeId: string
  selectedAgentId: string
  onSelectScope: (scopeId: string) => void
  onSelectAgent: (agentId: string) => void
}

function AgentScopeSelector({ selectedScopeId, selectedAgentId, onSelectScope, onSelectAgent }: AgentScopeSelectorProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [scopes, setScopes] = useState<BusinessScope[]>([])
  const [independentAgents, setIndependentAgents] = useState<Agent[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const { BusinessScopeService, AgentService } = await import('@/services/api')
        const [scopeList, allAgents] = await Promise.all([
          BusinessScopeService.getBusinessScopes(),
          AgentService.getAgents(),
        ])
        setScopes(scopeList)
        setIndependentAgents(allAgents.filter((a: Agent) => !a.businessScopeId))
      } catch (err) {
        console.error('Failed to load scopes/agents:', err)
      } finally {
        setIsLoadingData(false)
      }
    }
    void load()
  }, [])

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

  // Separate business scopes and digital twins
  const businessScopes = scopes.filter(s => s.scopeType !== 'digital_twin')
  const digitalTwins = scopes.filter(s => s.scopeType === 'digital_twin')

  // Determine display label
  const selectedScope = scopes.find(s => s.id === selectedScopeId)
  const selectedAgent = independentAgents.find(a => a.id === selectedAgentId)

  let displayLabel = t('project.defaultAgent')
  let displayIcon: React.ReactNode = <Bot className="w-4 h-4 text-gray-400" />
  if (selectedScope) {
    displayLabel = selectedScope.name
    displayIcon = selectedScope.scopeType === 'digital_twin'
      ? <Bot className="w-4 h-4 text-purple-400" />
      : <Layers className="w-4 h-4 text-blue-400" />
  } else if (selectedAgent) {
    displayLabel = selectedAgent.displayName
    displayIcon = <Bot className="w-4 h-4 text-green-400" />
  }

  const lowerSearch = search.toLowerCase()
  const filteredBusinessScopes = businessScopes.filter(s =>
    s.name.toLowerCase().includes(lowerSearch) ||
    (s.description || '').toLowerCase().includes(lowerSearch)
  )
  const filteredDigitalTwins = digitalTwins.filter(s =>
    s.name.toLowerCase().includes(lowerSearch) ||
    (s.description || '').toLowerCase().includes(lowerSearch)
  )
  const filteredAgents = independentAgents.filter(a =>
    a.displayName.toLowerCase().includes(lowerSearch) ||
    (a.role || '').toLowerCase().includes(lowerSearch) ||
    a.name.toLowerCase().includes(lowerSearch)
  )

  if (isLoadingData) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm">
        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
        <span className="text-gray-400">{t('common.loading')}</span>
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors text-sm"
      >
        {displayIcon}
        <span className="text-white font-medium truncate flex-1 text-left">{displayLabel}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[60] overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('chat.searchScopesAgents')}
                className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {/* Default option */}
            {(!search || 'default claude code agent'.includes(lowerSearch)) && (
              <button
                type="button"
                onClick={() => { onSelectScope(''); onSelectAgent(''); setIsOpen(false); setSearch('') }}
                className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors ${
                  !selectedScopeId && !selectedAgentId ? 'bg-blue-600/20' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${!selectedScopeId && !selectedAgentId ? 'text-blue-400' : 'text-white'}`}>
                      {t('project.defaultAgent')}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{t('project.defaultScopeAgent')}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Business Scopes */}
            {filteredBusinessScopes.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs text-gray-500 font-medium uppercase tracking-wider border-t border-gray-700">
                  {t('chat.businessScopes')}
                </div>
                {filteredBusinessScopes.map(scope => (
                  <button
                    type="button"
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

            {/* Digital Twins */}
            {filteredDigitalTwins.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs text-gray-500 font-medium uppercase tracking-wider border-t border-gray-700">
                  {t('agentList.digitalTwin')}
                </div>
                {filteredDigitalTwins.map(scope => {
                  const avatarUrl = getAvatarDisplayUrl(scope.avatar ?? null)
                  const fallbackChar = getAvatarFallback(scope.name, scope.avatar)
                  const showImage = shouldShowAvatarImage(scope.avatar ?? null)
                  return (
                    <button
                      type="button"
                      key={scope.id}
                      onClick={() => { onSelectScope(scope.id); setIsOpen(false); setSearch('') }}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors ${
                        scope.id === selectedScopeId ? 'bg-blue-600/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden flex-shrink-0 bg-purple-600">
                          {showImage && avatarUrl ? (
                            <img src={avatarUrl} alt={scope.name} className="w-full h-full object-cover" />
                          ) : (
                            fallbackChar
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate ${scope.id === selectedScopeId ? 'text-blue-400' : 'text-white'}`}>
                            {scope.name}
                          </div>
                          {scope.role && (
                            <div className="text-xs text-gray-400 truncate">{scope.role}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </>
            )}

            {/* Independent Agents */}
            {filteredAgents.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs text-gray-500 font-medium uppercase tracking-wider border-t border-gray-700">
                  {t('chat.independentAgents')}
                </div>
                {filteredAgents.map(agent => {
                  const avatarUrl = getAvatarDisplayUrl(agent.avatar)
                  const fallbackChar = getAvatarFallback(agent.displayName, agent.avatar)
                  const showImage = shouldShowAvatarImage(agent.avatar)
                  return (
                    <button
                      type="button"
                      key={agent.id}
                      onClick={() => { onSelectAgent(agent.id); setIsOpen(false); setSearch('') }}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors ${
                        agent.id === selectedAgentId ? 'bg-blue-600/20' : ''
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
                          <div className={`text-sm font-medium truncate ${agent.id === selectedAgentId ? 'text-blue-400' : 'text-white'}`}>
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

            {filteredBusinessScopes.length === 0 && filteredDigitalTwins.length === 0 && filteredAgents.length === 0 && search && (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">{t('chat.noResultsFound')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}