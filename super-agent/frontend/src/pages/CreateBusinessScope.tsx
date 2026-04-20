import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Laptop, Cog, DollarSign, Scale, MoreHorizontal, Wand2, FileUp, CloudUpload, Sparkles, Globe, X } from 'lucide-react'
import { setSopFile } from '@/services/sopFileStore'
import { useTranslation } from '@/i18n/useTranslation'
import type { Language } from '@/types'

const DEPARTMENTS = [
  { id: 'HR', name: 'Human Resources', icon: Users },
  { id: 'IT', name: 'IT & Dev', icon: Laptop },
  { id: 'Ops', name: 'Operations', icon: Cog },
  { id: 'Finance', name: 'Finance', icon: DollarSign },
  { id: 'Legal', name: 'Legal', icon: Scale },
  { id: 'Other', name: 'Other', icon: MoreHorizontal },
]

const STRATEGIES = [
  { id: 1, titleKey: 'scope.strategy1Title', descKey: 'scope.strategy1Desc', icon: Wand2 },
  { id: 2, titleKey: 'scope.strategy2Title', descKey: 'scope.strategy2Desc', icon: FileUp },
  { id: 3, titleKey: 'scope.strategy3Title', descKey: 'scope.strategy3Desc', icon: Sparkles },
]

export function CreateBusinessScope() {
  const navigate = useNavigate()
  const { currentLanguage, t } = useTranslation()

  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [customDeptName, setCustomDeptName] = useState('')
  const [selectedStrategy, setSelectedStrategy] = useState<number | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('')

  // Language selection dialog state
  const [showLangDialog, setShowLangDialog] = useState(false)
  const [selectedLang, setSelectedLang] = useState<Language>(currentLanguage)
  const [pendingNavState, setPendingNavState] = useState<{ description: string; hasSopFile?: boolean; deptName?: string; hasDocument?: boolean } | null>(null)

  /** Open the language dialog before navigating to the AI generator */
  const promptLanguageAndNavigate = useCallback((description: string, hasSopFile?: boolean) => {
    setSelectedLang(currentLanguage)
    setPendingNavState({ description, hasSopFile })
    setShowLangDialog(true)
  }, [currentLanguage])

  /** Confirm language and navigate — rebuild description in the chosen language */
  const confirmLanguageAndNavigate = useCallback(() => {
    if (!pendingNavState) return
    setShowLangDialog(false)

    // Rebuild the description in the selected language if it was auto-generated
    // (Strategy 3 uses user's own text, so we keep it as-is)
    let finalDescription = pendingNavState.description
    if (pendingNavState.deptName) {
      if (pendingNavState.hasDocument) {
        finalDescription = selectedLang === 'cn'
          ? `基于上传的 SOP 文档，为"${pendingNavState.deptName}"部门创建业务范围。从文档中提取关键流程、角色和职责，并据此生成专业的 AI 智能体。`
          : `Create a business scope for a "${pendingNavState.deptName}" department based on the uploaded SOP document. Extract the key processes, roles, and responsibilities from this document and generate specialized AI agents accordingly.`
      } else {
        finalDescription = selectedLang === 'cn'
          ? `为"${pendingNavState.deptName}"部门创建一个全面的业务范围。生成具有行业最佳实践 SOP、职责和技能的专业 AI 智能体。`
          : `Create a comprehensive business scope for a "${pendingNavState.deptName}" department. Generate specialized AI agents with industry best-practice SOPs, responsibilities, and skills for this organizational unit.`
      }
    }

    navigate('/create-business-scope/ai', {
      state: { description: finalDescription, hasSopFile: pendingNavState.hasSopFile, language: selectedLang },
    })
  }, [pendingNavState, selectedLang, navigate])

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
      // Reference SOP — generate from department name (placeholder, rebuilt in confirmLanguageAndNavigate)
      description = `Create a comprehensive business scope for a "${deptName}" department. Generate specialized AI agents with industry best-practice SOPs, responsibilities, and skills for this organizational unit.`
    } else if (selectedStrategy === 2) {
      // Import SOP document — upload file to backend, let the agent parse it
      if (!uploadedFile) return
      description = `Create a business scope for a "${deptName}" department based on the uploaded SOP document. Extract the key processes, roles, and responsibilities from this document and generate specialized AI agents accordingly.`
      // Store the file in the ephemeral store (File objects don't survive navigation state serialization)
      setSopFile(uploadedFile)
      setSelectedLang(currentLanguage)
      setPendingNavState({ description, hasSopFile: true, deptName, hasDocument: true })
      setShowLangDialog(true)
      return
    } else if (selectedStrategy === 3) {
      // Natural language — already handled by inline button
      return
    }

    // Navigate to AI Scope Generator with the constructed description
    setSelectedLang(currentLanguage)
    setPendingNavState({ description, deptName })
    setShowLangDialog(true)
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
            <h1 className="text-xl font-semibold">{t('scope.importTitle')}</h1>
            <p className="text-xs text-gray-400">{t('scope.importSubtitle')}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-12">
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">{t('scope.selectUnit')}</h2>
              <p className="text-sm text-gray-400">{t('scope.selectUnitDesc')}</p>
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
                <h3 className="text-base font-semibold mb-3">{t('scope.customUnitName')}</h3>
                <input type="text" value={customDeptName} onChange={(e) => setCustomDeptName(e.target.value)} placeholder={t('scope.enterDeptName')} autoFocus
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">{t('scope.chooseStrategy')}</h2>
              <p className="text-sm text-gray-400">{t('scope.chooseStrategyDesc')}</p>
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
                          <h3 className="text-lg font-bold mb-1">{t(strategy.titleKey)}</h3>
                          <p className="text-sm text-gray-400 leading-relaxed">{t(strategy.descKey)}</p>
                        </div>
                      </div>
                      {isActive && (
                        <div className="mt-6 pt-5 border-t border-gray-700/50 animate-fade-in">
                          {strategy.id === 2 && (
                            <div onClick={(e) => { e.stopPropagation(); document.getElementById('file-upload')?.click() }}
                              className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center bg-gray-800/20 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all cursor-pointer">
                              <CloudUpload className="w-8 h-8 text-cyan-500 mx-auto mb-3" />
                              <p className="text-sm text-gray-300">{uploadedFile ? <>{t('scope.selected')} <strong>{uploadedFile.name}</strong></> : <>{t('scope.dragDropSop')}</>}</p>
                              <p className="text-xs text-gray-500 mt-1">{t('scope.supportsPdf')}</p>
                              <input id="file-upload" type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} className="hidden" />
                            </div>
                          )}
                          {strategy.id === 3 && (
                            <div className="space-y-3">
                              <div className="relative bg-gray-900/50 border border-gray-700 rounded-xl p-3 flex items-end gap-3">
                                <textarea value={naturalLanguageInput} onChange={(e) => setNaturalLanguageInput(e.target.value)} rows={4} onClick={(e) => e.stopPropagation()}
                                  placeholder={t('scope.nlPlaceholder')}
                                  className="flex-1 bg-transparent border-none text-white placeholder-gray-500 resize-none focus:outline-none text-sm" />
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (naturalLanguageInput.trim()) {
                                    promptLanguageAndNavigate(naturalLanguageInput.trim())
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
                                {t('scope.generateWithAi')}
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
            <button onClick={handleCancel} className="px-8 py-3 text-sm font-semibold text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 rounded-xl transition-colors">{t('common.cancel')}</button>
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
                {t('scope.generateWithAi')}
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Language Selection Dialog */}
      {showLangDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">{t('scope.langDialogTitle')}</h3>
              </div>
              <button onClick={() => setShowLangDialog(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-400">
                {t('scope.langDialogDesc')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedLang('en')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    selectedLang === 'en'
                      ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <span className="text-2xl">🇺🇸</span>
                  <span className={`text-sm font-medium ${selectedLang === 'en' ? 'text-purple-300' : 'text-gray-300'}`}>{t('scope.langEnglish')}</span>
                </button>
                <button
                  onClick={() => setSelectedLang('cn')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    selectedLang === 'cn'
                      ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <span className="text-2xl">🇨🇳</span>
                  <span className={`text-sm font-medium ${selectedLang === 'cn' ? 'text-purple-300' : 'text-gray-300'}`}>中文</span>
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
              <button onClick={() => setShowLangDialog(false)} className="px-5 py-2 text-sm text-gray-300 hover:text-white border border-gray-600 rounded-xl transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={confirmLanguageAndNavigate}
                className="px-6 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:shadow-lg hover:shadow-purple-500/30 transition-all flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {t('scope.langGenerate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateBusinessScope
