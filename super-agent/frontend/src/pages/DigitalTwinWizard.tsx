/**
 * Digital Twin Creation Wizard
 * 4-step guided flow: Identity → Knowledge → Skills → Publish
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, User, BookOpen, Zap, Share2, Upload, Check, Loader2, Sparkles, FileText, Bot } from 'lucide-react'
import { restClient } from '@/services/api/restClient'
import { getValidToken } from '@/services/auth'
import { ChatMessage } from '@/components/chat/ChatMessage'
import type { ContentBlock } from '@/services/chatStreamService'
import {
  generateScope, generateScopeWithDocument, parseScopeConfig,
  type SSEEvent,
} from '@/services/scopeGeneratorService'

const STEPS = [
  { id: 'identity', label: 'Identity', icon: User, desc: 'Who are you?' },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, desc: 'What do you know?' },
  { id: 'skills', label: 'Skills', icon: Zap, desc: 'What can you do?' },
  { id: 'publish', label: 'Publish', icon: Share2, desc: 'Where do you live?' },
] as const

type StepId = typeof STEPS[number]['id']

interface WizardState {
  // Step 1: Identity
  displayName: string
  name: string
  role: string
  description: string
  avatarFile: File | null
  avatarPreview: string | null
  avatarKey: string | null
  systemPrompt: string
  // Step 2: Knowledge
  documentGroupId: string | null
  documentGroupName: string
  uploadedFiles: Array<{ name: string; size: number }>
  // Step 3: Skills (simplified for now)
  selectedSkillIds: string[]
  // Step 4: Publish
  publishPlatform: boolean
  publishIM: boolean
  imChannelType: string
  imChannelId: string
  // Meta
  createdAgentId: string | null
}

export function DigitalTwinWizard() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<StepId>('identity')
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)
  const [isGeneratingTwin, setIsGeneratingTwin] = useState(false)
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([])
  const [generatedConfig, setGeneratedConfig] = useState<{ config: any; avatarKey: string | null } | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  const [state, setState] = useState<WizardState>({
    displayName: '', name: '', role: '', description: '',
    avatarFile: null, avatarPreview: null, avatarKey: null,
    systemPrompt: '',
    documentGroupId: null, documentGroupName: '', uploadedFiles: [],
    selectedSkillIds: [],
    publishPlatform: true, publishIM: false, imChannelType: 'slack', imChannelId: '',
    createdAgentId: null,
  })

  const update = useCallback((patch: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...patch }))
  }, [])

  const stepIndex = STEPS.findIndex(s => s.id === currentStep)
  const canGoBack = stepIndex > 0
  const canGoNext = stepIndex < STEPS.length - 1
  const isLastStep = stepIndex === STEPS.length - 1

  // Auto-scroll chat during generation
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [contentBlocks])

  const goBack = () => { if (canGoBack) setCurrentStep(STEPS[stepIndex - 1].id) }
  const goNext = () => { if (canGoNext) setCurrentStep(STEPS[stepIndex + 1].id) }

  // Auto-generate name from displayName
  const handleNameChange = (displayName: string) => {
    const autoName = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ''
    update({ displayName, name: autoName })
  }

  // Handle photo upload
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    update({ avatarFile: file, avatarPreview: preview })
  }

  // AI-generate system prompt from description
  const generateSystemPrompt = async () => {
    if (!state.description.trim()) return
    setIsGeneratingPrompt(true)
    try {
      const result = await restClient.post<{ suggested_agent: { system_prompt: string } }>(
        '/api/agents/suggest-from-conversation',
        {
          description: `Create a digital twin agent for a person named "${state.displayName}" with role "${state.role}". Their self-description: ${state.description}. Generate a system prompt that makes the AI behave as this person's digital twin - matching their expertise, communication style, and personality.`,
        }
      )
      if (result?.suggested_agent?.system_prompt) {
        update({ systemPrompt: result.suggested_agent.system_prompt })
      } else {
        throw new Error('No prompt returned')
      }
    } catch {
      // Fallback: generate a basic prompt locally
      const name = state.displayName || 'the user'
      const role = state.role ? ` Your role is ${state.role}.` : ''
      update({
        systemPrompt: `You are ${name}'s digital twin — an AI that represents them and responds as they would.${role}\n\nAbout ${name}:\n${state.description}\n\nBehavior guidelines:\n- Match ${name}'s expertise, tone, and communication style\n- Draw on the knowledge and experience described above\n- When you don't know something ${name} would know, say so honestly\n- Be helpful, professional, and authentic to ${name}'s personality`
      })
    } finally {
      setIsGeneratingPrompt(false)
    }
  }

  // Upload photo to S3 via backend API
  const uploadPhoto = async (): Promise<string | null> => {
    if (!state.avatarFile) return null
    const formData = new FormData()
    formData.append('file', state.avatarFile)
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
    const token = await getValidToken()
    const res = await fetch(`${baseUrl}/api/avatars/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Photo upload failed (${res.status}): ${errBody}`)
    }
    const data = await res.json()
    return data.avatarKey
  }

  // Upload documents
  const handleFileUpload = async (files: FileList) => {
    let groupId = state.documentGroupId
    // Create document group if needed
    if (!groupId) {
      const groupName = `${state.displayName || 'Digital Twin'} Knowledge`
      try {
        const group = await restClient.post<{ data: { id: string } }>('/api/document-groups', { name: groupName })
        groupId = group.data.id
        update({ documentGroupId: groupId, documentGroupName: groupName })
      } catch (err) {
        console.error('Failed to create document group:', err)
        return
      }
    }
    // Upload each file
    const newFiles: Array<{ name: string; size: number }> = []
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
        const token = await getValidToken()
        await fetch(`${baseUrl}/api/document-groups/${groupId}/files`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })
        newFiles.push({ name: file.name, size: file.size })
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err)
      }
    }
    if (newFiles.length > 0) {
      setState(prev => ({ ...prev, uploadedFiles: [...prev.uploadedFiles, ...newFiles] }))
    }
  }

  // Final save: create the agent using agentic twin generation
  const handleFinish = async () => {
      setIsGeneratingTwin(true)
      setContentBlocks([])
      setError(null)
      try {
        // 1. Upload photo
        let avatarKey: string | null = null
        if (state.avatarFile) {
          try { avatarKey = await uploadPhoto() } catch { /* continue */ }
        }

        // 2. Build the description prompt for the scope generator
        const twinDescription = [
          `Create a DIGITAL TWIN configuration (not a business team) for a single person:`,
          `Name: ${state.displayName}`,
          `Role: ${state.role || 'General professional'}`,
          `Description: ${state.description || 'A professional in their field.'}`,
          '',
          `IMPORTANT: This is a digital twin of ONE person, not a team.`,
          `- Generate a scope with scope.name = "${state.displayName}"`,
          `- Generate 1 agent that represents this person (not multiple agents)`,
          `- The agent's systemPrompt must capture this person's specific expertise in ${state.role}`,
          `- Generate 3-6 skills specific to ${state.role} domain (NOT generic skills)`,
          `- If a document is provided, extract domain knowledge from it for the skills`,
        ].join('\n')

        setContentBlocks([{
          type: 'text',
          text: state.uploadedFiles.length > 0
            ? `📄 Uploading document and analyzing to build ${state.displayName}'s digital twin...\n\n`
            : `🤖 Generating ${state.displayName}'s digital twin configuration...\n\n`,
        }])

        // 3. Reuse the scope generator SSE flow (same as Business Scope creation)
        // This puts the file in the workspace and lets AI read it with tools
        const sseHandler = (event: SSEEvent) => {
          if (event.type === 'session_start') {
            setContentBlocks(prev => [...prev, { type: 'text', text: 'Session started. Analyzing...\n\n' }])
          } else if (event.type === 'assistant' && event.content) {
            setContentBlocks(prev => {
              const next = [...prev]
              const blocks = Array.isArray(event.content) ? event.content : []
              for (const block of blocks) {
                if (typeof block === 'string') continue
                if (block.type === 'text' && block.text) {
                  const lastIdx = next.length - 1
                  if (lastIdx >= 0 && next[lastIdx].type === 'text') {
                    next[lastIdx] = { type: 'text', text: (next[lastIdx] as { type: 'text'; text: string }).text + block.text }
                  } else {
                    next.push({ type: 'text', text: block.text })
                  }
                } else if (block.type === 'tool_use' && block.name) {
                  next.push({ type: 'tool_use', id: block.id || `tool-${Date.now()}`, name: block.name, input: (typeof block.input === 'object' ? block.input : {}) as Record<string, unknown> })
                }
              }
              return next
            })
          } else if (event.type === 'result') {
            setContentBlocks(prev => [...prev, { type: 'text', text: '\n\n✅ Generation complete.' }])
          } else if (event.type === 'error') {
            setContentBlocks(prev => [...prev, { type: 'text', text: `\n\n❌ Error: ${event.message}` }])
          }
        }

        // Get the first uploaded file from the document group (if any)
        let sopFile: File | null = null
        if (state.uploadedFiles.length > 0 && state.documentGroupId) {
          try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
            const token = await getValidToken()
            const filesRes = await restClient.get<{ data: Array<{ id: string; original_filename: string }> }>(
              `/api/document-groups/${state.documentGroupId}/files`
            )
            const firstFile = filesRes.data?.[0]
            if (firstFile) {
              const fileRes = await fetch(`${baseUrl}/api/document-groups/${state.documentGroupId}/files/${firstFile.id}/download`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              })
              if (fileRes.ok) {
                const blob = await fileRes.blob()
                sopFile = new File([blob], firstFile.original_filename)
              }
            }
          } catch { /* continue without file */ }
        }

        // Call the same generate endpoint as Business Scope creation
        const fullText = sopFile
          ? await generateScopeWithDocument(sopFile, twinDescription, sseHandler)
          : await generateScope(twinDescription, sseHandler)

        // 4. Parse the generated config
        try {
          const scopeConfig = parseScopeConfig(fullText)

          // Convert scope generator output to twin config format
          const firstAgent = scopeConfig.agents[0]
          const twinConfig = {
            scope: {
              name: state.displayName, // Force use user's name, not AI's
              description: scopeConfig.scope.description,
              icon: scopeConfig.scope.icon || '🤖',
              color: scopeConfig.scope.color || '#6366f1',
            },
            systemPrompt: firstAgent?.systemPrompt || scopeConfig.scope.description,
            skills: (firstAgent?.skills || []).map(s => ({
              name: s.name,
              description: s.description,
              body: s.body,
            })),
          }

          const skillCount = twinConfig.skills.length
          setContentBlocks(prev => [...prev, {
            type: 'text',
            text: `\n\n✅ Generated system prompt and **${skillCount} skills** for ${state.displayName}. Review above and click "Confirm & Create" to save.`,
          }])
          setGeneratedConfig({ config: twinConfig, avatarKey })
        } catch {
          // Fallback: basic config
          setContentBlocks(prev => [...prev, { type: 'text', text: '\n\n⚠️ Could not parse AI output. A basic configuration has been prepared.' }])
          setGeneratedConfig({
            config: {
              scope: { name: state.displayName, description: `Digital twin of ${state.displayName}`, icon: '🤖', color: '#6366f1' },
              systemPrompt: state.systemPrompt || `You are ${state.displayName}'s digital twin. ${state.description}`,
              skills: [],
            },
            avatarKey,
          })
        }

        setIsGeneratingTwin(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create digital twin')
        setIsGeneratingTwin(false)
      }
    }

  // Confirm: user clicks button to persist the generated config
  const handleConfirmCreate = async () => {
    if (!generatedConfig) return
    setIsConfirming(true)
    try {
      const { config, avatarKey } = generatedConfig

      setContentBlocks(prev => [...prev, { type: 'text', text: `\n\n💾 Saving digital twin with ${config.skills?.length ?? 0} skills...` }])

      const confirmRes = await restClient.post<{ data: { scope: { id: string } } }>(
        '/api/scope-generator/generate-twin/confirm',
        { config, avatar: avatarKey, documentGroupId: state.documentGroupId },
      )
      const scopeId = confirmRes.data.scope.id

      if (state.publishIM && state.imChannelId.trim()) {
        try {
          await restClient.post(`/api/business-scopes/${scopeId}/im-channels`, {
            channel_type: state.imChannelType, channel_id: state.imChannelId.trim(),
            channel_name: `${state.displayName} - ${state.imChannelType}`,
          })
        } catch { /* non-fatal */ }
      }

      setContentBlocks(prev => [...prev, { type: 'text', text: '\n\n🎉 Digital twin created successfully! Redirecting...' }])
      setTimeout(() => navigate(`/agents?scope=${scopeId}`), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save digital twin')
      setIsConfirming(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
        <button onClick={() => navigate('/agents')} className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-400" />
        </button>
        <div>
          <h1 className="text-lg font-semibold">Create Digital Twin</h1>
          <p className="text-xs text-gray-500">Build an AI version of yourself</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-1 px-6 py-4 border-b border-gray-800/50">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          const isActive = step.id === currentStep
          const isDone = i < stepIndex
          return (
            <div key={step.id} className="flex items-center">
              {i > 0 && <div className={`w-12 h-px mx-2 ${isDone ? 'bg-blue-500' : 'bg-gray-700'}`} />}
              <button
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : isDone ? 'text-green-400'
                  : 'text-gray-500'
                }`}
              >
                {isDone ? <Check size={14} /> : <Icon size={14} />}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        {(isGeneratingTwin || generatedConfig) ? (
          /* ── Generating view: Claude Code chat interface ── */
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-1">Creating {state.displayName}'s Digital Twin</h2>
              <p className="text-sm text-gray-400">AI is analyzing your documents and building skills...</p>
            </div>

            {/* User prompt bubble */}
            <div className="flex gap-3 flex-row-reverse">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-600">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col max-w-[70%] items-end">
                <div className="px-4 py-2 rounded-2xl bg-blue-600 text-white rounded-br-md">
                  <p className="text-sm">Create a digital twin for {state.displayName} ({state.role})</p>
                </div>
              </div>
            </div>

            {/* AI streaming response */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 max-w-[85%]">
                {contentBlocks.length > 0 ? (
                  <ChatMessage content={contentBlocks} isStreaming={true} />
                ) : (
                  <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Confirm button — shown after generation completes */}
            {generatedConfig && !isConfirming && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleConfirmCreate}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Check size={16} />
                  Confirm & Create Digital Twin
                </button>
              </div>
            )}
            {isConfirming && (
              <div className="flex justify-center pt-4">
                <div className="flex items-center gap-2 px-6 py-3 bg-gray-700 text-gray-300 rounded-lg text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        ) : currentStep === 'identity' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold mb-1">Who are you?</h2>
              <p className="text-sm text-gray-400">Upload your photo and describe yourself</p>
            </div>

            {/* Photo upload */}
            <div className="flex flex-col items-center gap-3">
              <label className="relative cursor-pointer group">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center overflow-hidden border-2 border-dashed transition-colors ${
                  state.avatarPreview ? 'border-blue-500' : 'border-gray-600 group-hover:border-gray-400'
                }`}>
                  {state.avatarPreview ? (
                    <img src={state.avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <Upload size={20} className="mx-auto text-gray-500" />
                      <span className="text-[10px] text-gray-500 mt-1">Photo</span>
                    </div>
                  )}
                </div>
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              </label>
              <span className="text-xs text-gray-500">Click to upload your photo</span>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Display Name</label>
                <input
                  value={state.displayName}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="e.g. Yaohua"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Role / Title</label>
                <input
                  value={state.role}
                  onChange={e => update({ role: e.target.value })}
                  placeholder="e.g. AWS AgentCore Specialist"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">About You</label>
              <textarea
                value={state.description}
                onChange={e => update({ description: e.target.value })}
                placeholder="Describe your expertise, personality, communication style... This will be used to generate your digital twin's behavior."
                rows={4}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* System prompt (AI-generated) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">System Prompt</label>
                <button
                  onClick={generateSystemPrompt}
                  disabled={isGeneratingPrompt || !state.description.trim()}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-purple-400 hover:text-purple-300 disabled:text-gray-600 transition-colors"
                >
                  {isGeneratingPrompt ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {isGeneratingPrompt ? 'Generating...' : 'AI Generate'}
                </button>
              </div>
              <textarea
                value={state.systemPrompt}
                onChange={e => update({ systemPrompt: e.target.value })}
                placeholder="AI will generate this based on your description, or write your own..."
                rows={6}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 resize-none font-mono text-xs"
              />
            </div>
          </div>
        )}

        {currentStep === 'knowledge' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold mb-1">What do you know?</h2>
              <p className="text-sm text-gray-400">Upload documents that represent your expertise</p>
            </div>

            {/* File upload area */}
            <label className="block border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl p-8 text-center cursor-pointer transition-colors">
              <Upload size={32} className="mx-auto text-gray-500 mb-3" />
              <p className="text-sm text-gray-300 mb-1">Drop files here or click to upload</p>
              <p className="text-xs text-gray-500">PDF, DOC, TXT, MD — up to 50MB each</p>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.csv"
                onChange={e => e.target.files && handleFileUpload(e.target.files)}
                className="hidden"
              />
            </label>

            {/* Uploaded files list */}
            {state.uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">{state.uploadedFiles.length} file(s) uploaded</p>
                {state.uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
                    <FileText size={14} className="text-blue-400" />
                    <span className="text-sm text-gray-300 flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-gray-500">{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-400">
                Tip: Upload documents that contain your domain expertise — internal docs, guides, FAQs, meeting notes.
                Your digital twin will use these as reference when answering questions.
              </p>
            </div>
          </div>
        )}

        {currentStep === 'skills' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold mb-1">What can you do?</h2>
              <p className="text-sm text-gray-400">Skills and tools can be configured later from the agent profile</p>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
              <Zap size={32} className="mx-auto text-yellow-500 mb-3" />
              <p className="text-sm text-gray-300 mb-2">Skills can be equipped after creation</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Once your digital twin is created, you can open the Skill Workshop to browse and equip skills,
                connect MCP servers (like Quip, Confluence), and fine-tune capabilities.
              </p>
            </div>
          </div>
        )}

        {currentStep === 'publish' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold mb-1">Where do you live?</h2>
              <p className="text-sm text-gray-400">Choose where your digital twin will be available</p>
            </div>

            {/* Platform toggle */}
            <label className="flex items-center gap-3 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors">
              <input
                type="checkbox"
                checked={state.publishPlatform}
                onChange={e => update({ publishPlatform: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm text-white">Super Agent Platform</div>
                <div className="text-xs text-gray-400">Available in the chat interface as an independent agent</div>
              </div>
              <Check size={16} className={state.publishPlatform ? 'text-green-400' : 'text-gray-600'} />
            </label>

            {/* IM toggle */}
            <label className="flex items-center gap-3 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors">
              <input
                type="checkbox"
                checked={state.publishIM}
                onChange={e => update({ publishIM: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm text-white">IM Channel (Feishu / Slack / DingTalk)</div>
                <div className="text-xs text-gray-400">Bind to a group chat so people can @mention your twin</div>
              </div>
            </label>

            {state.publishIM && (
              <div className="ml-7 space-y-3 pl-4 border-l-2 border-gray-700">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Channel Type</label>
                  <select
                    value={state.imChannelType}
                    onChange={e => update({ imChannelType: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none focus:border-blue-500"
                  >
                    <option value="slack">Slack</option>
                    <option value="feishu">Feishu / Lark</option>
                    <option value="dingtalk">DingTalk</option>
                    <option value="discord">Discord</option>
                    <option value="teams">Microsoft Teams</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Channel ID</label>
                  <input
                    value={state.imChannelId}
                    onChange={e => update({ imChannelId: e.target.value })}
                    placeholder="e.g. C01234ABCDE"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-2">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Summary</p>
              <div className="flex items-center gap-3">
                {state.avatarPreview ? (
                  <img src={state.avatarPreview} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm">
                    {state.displayName.charAt(0) || '?'}
                  </div>
                )}
                <div>
                  <div className="text-sm text-white font-medium">{state.displayName || 'Unnamed'}</div>
                  <div className="text-xs text-gray-400">{state.role || 'No role set'}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {state.uploadedFiles.length} document(s) • {state.publishPlatform ? 'Platform' : ''}{state.publishIM ? ' + IM' : ''}
              </div>
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom navigation — hidden during generation */}
      {!isGeneratingTwin && !generatedConfig && (
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-950">
        <button
          onClick={canGoBack ? goBack : () => navigate('/agents')}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          {canGoBack ? 'Back' : 'Cancel'}
        </button>

        {isLastStep ? (
          <button
            onClick={handleFinish}
            disabled={isGeneratingTwin || !state.displayName.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isGeneratingTwin ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isGeneratingTwin ? 'Creating...' : 'Create Digital Twin'}
          </button>
        ) : (
          <button
            onClick={goNext}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
          >
            Next
            <ArrowRight size={16} />
          </button>
        )}
      </div>
      )}
    </div>
  )
}
