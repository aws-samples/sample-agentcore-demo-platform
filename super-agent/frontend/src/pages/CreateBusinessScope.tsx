import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Laptop, Cog, DollarSign, Scale, MoreHorizontal, Wand2, FileUp, CloudUpload, Sparkles } from 'lucide-react'
import { setSopFile } from '@/services/sopFileStore'

const DEPARTMENTS = [
  { id: 'HR', name: 'Human Resources', icon: Users },
  { id: 'IT', name: 'IT & Dev', icon: Laptop },
  { id: 'Ops', name: 'Operations', icon: Cog },
  { id: 'Finance', name: 'Finance', icon: DollarSign },
  { id: 'Legal', name: 'Legal', icon: Scale },
  { id: 'Other', name: 'Other', icon: MoreHorizontal },
]

const STRATEGIES = [
  { id: 1, title: 'Generate Reference SOP using Agent', description: 'AI analyzes standard industry practices for your department to build a best-practice SOP.', icon: Wand2 },
  { id: 2, title: 'Import SOP document', description: 'Use LLM to understand existing SOP documents and automatically transform them into workflow nodes.', icon: FileUp },
  { id: 3, title: 'Build using Natural Language', description: 'Describe your business in plain text and let AI create the scope and agents for you. Powered by Claude streaming analysis.', icon: Sparkles },
]

export function CreateBusinessScope() {
  const navigate = useNavigate()

  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [customDeptName, setCustomDeptName] = useState('')
  const [selectedStrategy, setSelectedStrategy] = useState<number | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('')

  const handleDeptSelect = useCallback((deptId: string) => {
    setSelectedDept(deptId)
    if (deptId !== 'Other') setCustomDeptName('')
  }, [])

  const handleStrategySelect = useCallback((strategyId: number) => {
    setSelectedStrategy(strategyId)
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setUploadedFile(e.target.files[0])
  }, [])

  /**
   * All strategies now route through the AI Scope Generator (Claude Agent SDK).
   * Strategy 1: Builds a description from the department name.
   * Strategy 2: Reads the uploaded document and includes it in the description.
   * Strategy 3: Uses the user's natural language input directly.
   */
  const handleConfirm = useCallback(async () => {
    if (!selectedDept || !selectedStrategy) return

    let deptName = selectedDept
    if (selectedDept === 'Other') {
      if (!customDeptName.trim()) return
      deptName = customDeptName.trim()
    }

    // Build the description based on strategy
    let description = ''

    if (selectedStrategy === 1) {
      // Reference SOP — generate from department name
      description = `Create a comprehensive business scope for a "${deptName}" department. Generate specialized AI agents with industry best-practice SOPs, responsibilities, and skills for this organizational unit.`
    } else if (selectedStrategy === 2) {
      // Import SOP document — upload file to backend, let the agent parse it
      if (!uploadedFile) return
      description = `Create a business scope for a "${deptName}" department based on the uploaded SOP document. Extract the key processes, roles, and responsibilities from this document and generate specialized AI agents accordingly.`
      // Store the file in the ephemeral store (File objects don't survive navigation state serialization)
      setSopFile(uploadedFile)
      navigate('/create-business-scope/ai', { state: { description, hasSopFile: true } })
      return
    } else if (selectedStrategy === 3) {
      // Natural language — already handled by inline button
      return
    }

    // Navigate to AI Scope Generator with the constructed description
    navigate('/create-business-scope/ai', { state: { description } })
  }, [selectedDept, selectedStrategy, customDeptName, uploadedFile, navigate])

  const handleCancel = useCallback(() => navigate('/'), [navigate])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={handleCancel} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold">Import & Generate SOP</h1>
            <p className="text-xs text-gray-400">Configure your business scope</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-12">
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">1. Select Organizational Unit</h2>
              <p className="text-sm text-gray-400">Choose the department this SOP belongs to for accurate generation context.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {DEPARTMENTS.map((dept) => {
                const Icon = dept.icon
                const isActive = selectedDept === dept.id
                return (
                  <button key={dept.id} onClick={() => handleDeptSelect(dept.id)}
                    className={`relative rounded-xl p-4 border transition-all duration-300 flex flex-col items-center gap-3 text-center
                      ${isActive ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20' : 'border-gray-700 bg-gray-800/50 hover:border-purple-500/50 hover:bg-purple-500/5'}`}>
                    <Icon className={`w-6 h-6 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} />
                    <span className="text-sm font-semibold">{dept.name}</span>
                  </button>
                )
              })}
            </div>
            {selectedDept === 'Other' && (
              <div className="animate-fade-in">
                <h3 className="text-base font-semibold mb-3">Custom Unit Name</h3>
                <input type="text" value={customDeptName} onChange={(e) => setCustomDeptName(e.target.value)} placeholder="Enter department name..." autoFocus
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">2. Choose Generation Strategy</h2>
              <p className="text-sm text-gray-400">Select how you want the AI to construct your initial workflow draft.</p>
            </div>
            <div className="space-y-5">
              {STRATEGIES.map((strategy) => {
                const Icon = strategy.icon
                const isActive = selectedStrategy === strategy.id
                return (
                  <div key={strategy.id} onClick={() => handleStrategySelect(strategy.id)}
                    className={`relative rounded-2xl border transition-all duration-500 cursor-pointer overflow-hidden
                      ${isActive ? 'border-cyan-500 bg-cyan-500/6 shadow-xl shadow-cyan-500/15' : 'border-gray-700 bg-gray-800/50 hover:border-cyan-500/50 hover:bg-cyan-500/3'}`}>
                    <div className="p-6">
                      <div className="flex items-center gap-6">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300
                          ${isActive ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/40' : 'bg-gray-700/50 text-gray-400'}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold mb-1">{strategy.title}</h3>
                          <p className="text-sm text-gray-400 leading-relaxed">{strategy.description}</p>
                        </div>
                      </div>
                      {isActive && (
                        <div className="mt-6 pt-5 border-t border-gray-700/50 animate-fade-in">
                          {strategy.id === 2 && (
                            <div onClick={(e) => { e.stopPropagation(); document.getElementById('file-upload')?.click() }}
                              className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center bg-gray-800/20 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer">
                              <CloudUpload className="w-8 h-8 text-cyan-500 mx-auto mb-3" />
                              <p className="text-sm text-gray-300">{uploadedFile ? <>Selected: <strong>{uploadedFile.name}</strong></> : <>Drag & drop SOP document or <strong>click to browse</strong></>}</p>
                              <p className="text-xs text-gray-500 mt-1">Supports PDF, DOCX, TXT</p>
                              <input id="file-upload" type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} className="hidden" />
                            </div>
                          )}
                          {strategy.id === 3 && (
                            <div className="space-y-3">
                              <div className="relative bg-gray-900/50 border border-gray-700 rounded-xl p-3 flex items-end gap-3">
                                <textarea value={naturalLanguageInput} onChange={(e) => setNaturalLanguageInput(e.target.value)} rows={4} onClick={(e) => e.stopPropagation()}
                                  placeholder="e.g. We're an e-commerce fashion brand with 50 employees. We need agents for customer support, inventory management, marketing campaigns, and order fulfillment..."
                                  className="flex-1 bg-transparent border-none text-white placeholder-gray-500 resize-none focus:outline-none text-sm" />
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (naturalLanguageInput.trim()) {
                                    navigate('/create-business-scope/ai', { state: { description: naturalLanguageInput.trim() } })
                                  }
                                }}
                                disabled={!naturalLanguageInput.trim()}
                                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                                  naturalLanguageInput.trim()
                                    ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:shadow-lg hover:shadow-purple-500/30'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                <Sparkles className="w-4 h-4" />
                                Generate with AI
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="flex items-center justify-end gap-4 pt-8 border-t border-gray-800">
            <button onClick={handleCancel} className="px-8 py-3 text-sm font-semibold text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 rounded-xl transition-colors">Cancel</button>
            {/* Strategy 3 has its own inline button; strategies 1 & 2 use this Confirm button */}
            {selectedStrategy !== 3 && (
              <button onClick={handleConfirm}
                disabled={!selectedDept || !selectedStrategy || (selectedStrategy === 2 && !uploadedFile)}
                className={`px-12 py-3 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                  selectedDept && selectedStrategy && (selectedStrategy !== 2 || uploadedFile)
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:shadow-lg hover:shadow-cyan-500/30 hover:-translate-y-0.5'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}>
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default CreateBusinessScope
