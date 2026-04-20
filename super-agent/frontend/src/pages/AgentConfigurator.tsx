import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, CheckCircle, AlertCircle, Plus, X, Pencil, Zap, Upload } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAgents } from '@/services'
import { useBusinessScopes } from '@/services/useBusinessScopes'
import { restClient } from '@/services/api/restClient'
import { getAvatarDisplayUrl, shouldShowAvatarImage } from '@/utils/avatarUtils'
import type { Agent, AgentStatus, Tool } from '@/types'

interface FormState {
  internalName: string
  displayName: string
  role: string
  avatar: string
  status: AgentStatus
  systemPrompt: string
  scope: string[]
  tools: Tool[]
}

interface ToastState {
  show: boolean
  type: 'success' | 'error'
  message: string
}

// Simplified status options: Active & Disabled
const SIMPLE_STATUSES: Array<{ value: AgentStatus; labelKey: string }> = [
  { value: 'active', labelKey: 'agentConfig.statusActive' },
  { value: 'offline', labelKey: 'agentConfig.statusDisabled' },
]

export function AgentConfigurator() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { agentId } = useParams<{ agentId: string }>()
  const { getAgentById, updateAgent } = useAgents()
  const { businessScopes } = useBusinessScopes()

  const [agent, setAgent] = useState<Agent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>({ show: false, type: 'success', message: '' })
  const [newScopeItem, setNewScopeItem] = useState('')
  const [newToolName, setNewToolName] = useState('')
  const [newToolSkillMd, setNewToolSkillMd] = useState('')
  const [editingToolId, setEditingToolId] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    internalName: '',
    displayName: '',
    role: '',
    avatar: '',
    status: 'active',
    systemPrompt: '',
    scope: [],
    tools: [],
  })

  // Load agent data
  useEffect(() => {
    let isMounted = true

    async function loadAgent() {
      if (!agentId) {
        setError('No agent ID provided')
        setIsLoading(false)
        return
      }

      // "new" means create mode — skip loading
      if (agentId === 'new') {
        setAgent(null)
        setForm({
          internalName: '',
          displayName: '',
          role: '',
          avatar: '',
          status: 'active',
          systemPrompt: '',
          scope: [],
          tools: [],
        })
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      const loadedAgent = await getAgentById(agentId)
      
      if (!isMounted) return

      if (loadedAgent) {
        setAgent(loadedAgent)
        setForm({
          internalName: loadedAgent.name,
          displayName: loadedAgent.displayName,
          role: loadedAgent.role || '',
          avatar: loadedAgent.avatar || '',
          status: loadedAgent.status,
          systemPrompt: loadedAgent.systemPrompt || '',
          scope: loadedAgent.scope || [],
          tools: loadedAgent.tools || [],
        })
      } else {
        setError('Agent not found')
      }
      setIsLoading(false)
    }

    loadAgent()

    return () => {
      isMounted = false
    }
  }, [agentId, getAgentById])

  const handleInputChange = (field: keyof FormState, value: string | string[] | Tool[] | AgentStatus) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }

  const handleAddScopeItem = () => {
    if (newScopeItem.trim() && !form.scope.includes(newScopeItem.trim())) {
      handleInputChange('scope', [...form.scope, newScopeItem.trim()])
      setNewScopeItem('')
    }
  }

  const handleRemoveScopeItem = (item: string) => {
    handleInputChange('scope', form.scope.filter(s => s !== item))
  }

  const handleAddTool = () => {
    if (newToolName.trim()) {
      const newTool: Tool = {
        id: `tool-${Date.now()}`,
        name: newToolName.trim(),
        skillMd: newToolSkillMd.trim(),
      }
      handleInputChange('tools', [...form.tools, newTool])
      setNewToolName('')
      setNewToolSkillMd('')
    }
  }

  const handleEditTool = (tool: Tool) => {
    setEditingToolId(tool.id)
    setNewToolName(tool.name)
    setNewToolSkillMd(tool.skillMd)
  }

  const handleUpdateTool = async () => {
    if (editingToolId && newToolName.trim()) {
      // Update SKILL.md content on the backend
      try {
        await restClient.put(`/api/skills/${editingToolId}/content`, {
          content: newToolSkillMd.trim(),
        })
        
        // Update local state
        const updatedTools = form.tools.map(tool => 
          tool.id === editingToolId 
            ? { ...tool, name: newToolName.trim(), skillMd: newToolSkillMd.trim() }
            : tool
        )
        handleInputChange('tools', updatedTools)
        showToast('success', t('agentConfig.skillUpdated'))
      } catch (err) {
        showToast('error', 'Failed to update skill')
        console.error('Failed to update skill:', err)
      }
      
      setEditingToolId(null)
      setNewToolName('')
      setNewToolSkillMd('')
    }
  }

  const handleCancelEdit = () => {
    setEditingToolId(null)
    setNewToolName('')
    setNewToolSkillMd('')
  }

  const handleRemoveTool = (toolId: string) => {
    handleInputChange('tools', form.tools.filter(t => t.id !== toolId))
  }

  const isCreateMode = agentId === 'new'

  const handleSave = async () => {
    if (!form.internalName.trim() || !form.displayName.trim()) {
      showToast('error', t('agentConfig.nameRequired'))
      return
    }

    setIsSaving(true)

    if (isCreateMode) {
      // Create new agent via REST API
      try {
        const created = await restClient.post<{ id: string }>('/api/agents', {
          name: form.internalName,
          display_name: form.displayName,
          role: form.role || null,
          avatar: form.avatar || null,
          status: form.status,
          system_prompt: form.systemPrompt || null,
          scope: form.scope,
          tools: form.tools,
          origin: 'manual',
        })
        setIsSaving(false)
        showToast('success', t('agentConfig.agentCreated'))
        // Navigate to the new agent's page
        setTimeout(() => navigate(`/agents?id=${created.id}`), 500)
      } catch (err) {
        setIsSaving(false)
        showToast('error', err instanceof Error ? err.message : 'Failed to create agent')
      }
      return
    }

    if (!agent || !agentId) return

    const updatedAgent = await updateAgent(agentId, {
      name: form.internalName,
      displayName: form.displayName,
      role: form.role,
      avatar: form.avatar,
      status: form.status,
      systemPrompt: form.systemPrompt,
      scope: form.scope,
      tools: form.tools,
    })

    setIsSaving(false)

    if (updatedAgent) {
      setAgent(updatedAgent)
      showToast('success', t('toast.saveSuccess'))
    } else {
      showToast('error', t('toast.saveError'))
    }
  }

  const handleBack = () => {
    if (isCreateMode) {
      navigate('/agents')
    } else {
      navigate(`/agents?id=${agentId}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (error || (!agent && !isCreateMode)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-red-400 mb-4">{error || 'Agent not found'}</p>
        <button
          onClick={() => navigate('/agents')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
        >
          {t('common.close')}
        </button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-950">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg transition-all ${
          toast.type === 'success' 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white">{isCreateMode ? 'Create New Agent' : (agent?.displayName ?? '')}</h1>
                {!isCreateMode && (() => {
                  const scope = businessScopes.find(s => s.id === (agent?.businessScopeId || agent?.department))
                  return scope ? (
                    <span className="text-sm text-gray-400 border-l border-gray-700 pl-3">
                      {scope.icon} {scope.name}
                    </span>
                  ) : null
                })()}
              </div>
              <p className="text-sm text-gray-500">{isCreateMode ? 'Configure your new agent' : t('agentConfig.title')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCreateMode && (
              <button
                onClick={() => navigate(`/agents/config/${agentId}/workshop`)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/40 rounded-lg text-yellow-400 transition-colors"
              >
                <Zap className="w-4 h-4" />
                <span>{t('agentConfig.skillWorkshop')}</span>
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
            >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{t('common.save')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6 max-w-3xl">
        <div className="space-y-6">
          {/* Basic Information Section */}
          <SectionHeader title={t('agentConfig.basicInfo')} />
          
          {/* Agent ID (Read-only, hidden in create mode) */}
          {!isCreateMode && (
            <FormField label={t('agentConfig.agentId')}>
              <input
                type="text"
                value={agent?.id ?? ''}
                readOnly
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 cursor-not-allowed"
              />
            </FormField>
          )}

          {/* Internal Name */}
          <FormField label={t('agentConfig.internalName')}>
            <input
              type="text"
              value={form.internalName}
              onChange={(e) => handleInputChange('internalName', e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              placeholder="e.g., hr-assistant"
            />
          </FormField>

          {/* Display Name */}
          <FormField label="Display Name">
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              placeholder="e.g., HR Assistant"
            />
          </FormField>

          {/* Role */}
          <FormField label="Role">
            <input
              type="text"
              value={form.role}
              onChange={(e) => handleInputChange('role', e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              placeholder="e.g., Human Resources Specialist"
            />
          </FormField>

          {/* Avatar */}
          <FormField label={t('agentConfig.avatar')}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-xl overflow-hidden">
                {(() => {
                  const avatarUrl = getAvatarDisplayUrl(form.avatar)
                  const showImage = shouldShowAvatarImage(form.avatar) || form.avatar?.startsWith('data:image/') || form.avatar?.startsWith('http')
                  if (showImage && avatarUrl) {
                    return (
                      <img 
                        src={avatarUrl} 
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.parentElement!.textContent = form.displayName.charAt(0) || '?'
                        }}
                      />
                    )
                  }
                  return form.avatar || form.displayName.charAt(0) || '?'
                })()}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={form.avatar}
                  onChange={(e) => handleInputChange('avatar', e.target.value)}
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors text-sm"
                  placeholder="avatars/key.png, URL, or character"
                />
                <label className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg cursor-pointer transition-colors text-sm">
                  <Upload size={14} />
                  <span>{t('agentConfig.upload')}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const formData = new FormData()
                      formData.append('file', file)
                      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
                      const token = localStorage.getItem('local_auth_token') || localStorage.getItem('cognito_id_token')
                      try {
                        const res = await fetch(`${baseUrl}/api/avatars/upload`, {
                          method: 'POST',
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                          body: formData,
                        })
                        if (!res.ok) throw new Error('Upload failed')
                        const data = await res.json()
                        if (data.avatarKey) {
                          handleInputChange('avatar', data.avatarKey)
                        }
                      } catch (err) {
                        console.error('Avatar upload failed:', err)
                      }
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </div>
          </FormField>

          {/* Status */}
          <FormField label={t('agentConfig.status')}>
            <div className="grid grid-cols-2 gap-3">
              {SIMPLE_STATUSES.map(({ value, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleInputChange('status', value)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    form.status === value
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </FormField>

          {/* AI Configuration Section */}
          <SectionHeader title={t('agentConfig.aiConfig')} />

          {/* System Prompt */}
          <FormField label={t('agentConfig.systemPrompt')}>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
              rows={6}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none"
              placeholder="Define the agent's personality, expertise, and behavior..."
            />
          </FormField>

          {/* Capabilities Section */}
          <SectionHeader title={t('agentConfig.capabilities')} />

          {/* Operational Scope */}
          <FormField label={t('agentConfig.operationalScope')}>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {form.scope.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full text-sm text-blue-400"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => handleRemoveScopeItem(item)}
                      className="hover:text-blue-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newScopeItem}
                  onChange={(e) => setNewScopeItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddScopeItem())}
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                  placeholder="Add scope area (e.g., Recruitment, Onboarding)"
                />
                <button
                  type="button"
                  onClick={handleAddScopeItem}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </FormField>

          {/* Sub-agent Skills */}
          <FormField label={t('agentConfig.assignedTools')}>
            <div className="space-y-3">
              {form.tools.length > 0 && (
                <div className="space-y-2">
                  {form.tools.map((tool) => (
                    <div
                      key={tool.id}
                      className={`flex items-start gap-3 p-3 border rounded-lg ${
                        editingToolId === tool.id 
                          ? 'bg-blue-900/20 border-blue-500/50' 
                          : 'bg-gray-800/50 border-gray-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white">{tool.name}</div>
                        {tool.skillMd && (
                          <pre className="text-sm text-gray-400 mt-2 whitespace-pre-wrap font-mono bg-gray-900/50 p-2 rounded max-h-32 overflow-y-auto">{tool.skillMd}</pre>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditTool(tool)}
                          className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400"
                          title={t('agentConfig.editSkill')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTool(tool.id)}
                          className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                          title={t('agentConfig.removeSkill')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className={`space-y-2 p-3 border border-dashed rounded-lg ${
                editingToolId ? 'bg-blue-900/10 border-blue-500/30' : 'bg-gray-800/30 border-gray-700'
              }`}>
                {editingToolId && (
                  <div className="text-xs text-blue-400 mb-1">Editing skill...</div>
                )}
                <input
                  type="text"
                  value={newToolName}
                  onChange={(e) => setNewToolName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none transition-colors text-sm"
                  placeholder="Skill name (e.g., resume-parser)"
                />
                <textarea
                  value={newToolSkillMd}
                  onChange={(e) => setNewToolSkillMd(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none transition-colors text-sm font-mono resize-none"
                  placeholder="skill.md content - instructions for this skill..."
                />
                {editingToolId ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateTool}
                      disabled={!newToolName.trim()}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg text-white transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Update Skill
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddTool}
                    disabled={!newToolName.trim()}
                    className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg text-white transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Skill
                  </button>
                )}
              </div>
            </div>
          </FormField>
        </div>
      </div>
    </div>
  )
}

interface FormFieldProps {
  label: string
  children: React.ReactNode
}

function FormField({ label, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      {children}
    </div>
  )
}

interface SectionHeaderProps {
  title: string
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="pt-4 pb-2 border-b border-gray-800">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
    </div>
  )
}
