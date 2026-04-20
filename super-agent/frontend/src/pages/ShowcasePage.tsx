/**
 * ShowcasePage — "企业Agent大赏" / Enterprise Agent Showcase.
 *
 * Displays agent capabilities organized by Industry (tabs) → Domain (sections) → Cases (cards).
 * Includes an admin panel for managing industries and domains.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/i18n'
import {
  Star, Loader2, Play, Eye, Settings, Plus, Pencil, Trash2, X,
  ChevronRight,
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

  const activeIndustry = industries.find(i => i.id === activeTab)

  const handleRun = (c: ShowcaseCase) => {
    const params = new URLSearchParams()
    if (c.scope_id) params.set('scope', c.scope_id)
    if (c.agent_id) params.set('agent', c.agent_id)
    const prompt = c.initial_prompt || c.description
    if (prompt) params.set('prompt', prompt)
    params.set('showcase_case_id', c.id)
    navigate(`/chat?${params.toString()}`)
  }

  const handleView = (c: ShowcaseCase) => {
    if (c.session_id) {
      navigate(`/chat?session=${c.session_id}`)
    }
  }

  return (
    <div className="h-full flex">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto bg-gray-950">
        {/* Header */}
        <div className="px-8 pt-6 pb-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-wide">{t('showcase.title')}</h1>
              <span className="flex items-center gap-1 text-xs bg-purple-500/20 text-purple-400 px-2.5 py-1 rounded-full font-medium">
                <Star className="w-3 h-3" fill="currentColor" />
                {t('showcase.featured')}
              </span>
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

          {/* Industry Tabs */}
          {industries.length > 0 && (
            <div className="flex items-center gap-1">
              {industries.map(ind => (
                <button
                  key={ind.id}
                  onClick={() => setActiveTab(ind.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === ind.id
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800 border border-transparent'
                  }`}
                >
                  {ind.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">{t('showcase.loading')}</span>
            </div>
          ) : industries.length === 0 ? (
            <div className="text-center py-20">
              <Star className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{t('showcase.empty')}</p>
              <p className="text-xs text-gray-600 mt-1">{t('showcase.emptyHint')}</p>
            </div>
          ) : activeIndustry ? (
            <div className="space-y-10">
              {activeIndustry.domains.map(domain => (
                <DomainSection key={domain.id} domain={domain} onRun={handleRun} onView={handleView} />
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
          activeIndustryId={activeTab}
          onClose={() => setShowAdmin(false)}
          onDataChanged={() => {
            loadData()
          }}
        />
      )}
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
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">{t('showcase.categoryManagement')}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Industries section */}
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

        {/* Domains section */}
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
                <DomainRow
                  key={domain.id}
                  domain={domain}
                  onUpdated={onDataChanged}
                  onDeleted={onDataChanged}
                />
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
// Industry CRUD components
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
      setName('')
      setSlug('')
      setOpen(false)
      onCreated()
    } catch (err) {
      console.error('Failed to create industry:', err)
    } finally {
      setSaving(false)
    }
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
      <input
        type="text" value={name} onChange={e => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')) }}
        placeholder={t('showcase.industryNamePlaceholder')}
        className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        autoFocus
      />
      <input
        type="text" value={slug} onChange={e => setSlug(e.target.value)}
        placeholder={t('showcase.slugPlaceholder')}
        className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
      />
      <div className="flex justify-end gap-2">
        <button onClick={() => { setOpen(false); setName(''); setSlug('') }} className="px-2 py-1 text-xs text-gray-400 hover:text-white">{t('common.cancel')}</button>
        <button onClick={handleSave} disabled={saving || !name.trim() || !slug.trim()} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50">
          {saving ? '...' : t('showcase.add')}
        </button>
      </div>
    </div>
  )
}

function IndustryRow({ industry, isSelected, onSelect, onUpdated, onDeleted }: {
  industry: ShowcaseIndustry
  isSelected: boolean
  onSelect: () => void
  onUpdated: () => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(industry.name)
  const [deleting, setDeleting] = useState(false)
  const { t } = useTranslation()

  const handleSave = async () => {
    if (!name.trim()) return
    try {
      await restClient.put(`/api/showcase/industries/${industry.id}`, { name: name.trim() })
      setEditing(false)
      onUpdated()
    } catch (err) {
      console.error('Failed to update industry:', err)
    }
  }

  const handleDelete = async () => {
    if (!confirm(t('showcase.deleteIndustryConfirm').replace('{name}', industry.name))) return
    setDeleting(true)
    try {
      await restClient.delete(`/api/showcase/industries/${industry.id}`)
      onDeleted()
    } catch (err) {
      console.error('Failed to delete industry:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-colors ${
        isSelected ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800/50'
      }`}
    >
      <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isSelected ? 'rotate-90 text-blue-400' : 'text-gray-600'}`} />
      {editing ? (
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setName(industry.name) } }}
          onBlur={handleSave}
          onClick={e => e.stopPropagation()}
          className="flex-1 px-1.5 py-0.5 bg-gray-900 border border-blue-500 rounded text-sm text-white focus:outline-none"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-sm truncate">{industry.name}</span>
      )}
      <span className="text-xs text-gray-600">{industry.domains.length}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); setEditing(true); setName(industry.name) }} className="p-0.5 rounded text-gray-500 hover:text-white" title={t('showcase.edit')}>
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={e => { e.stopPropagation(); handleDelete() }} disabled={deleting} className="p-0.5 rounded text-gray-500 hover:text-red-400" title={t('common.delete')}>
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Domain CRUD components
// ============================================================================

function AddDomainButton({ industryId, onCreated }: { industryId: string; onCreated: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [icon, setIcon] = useState('')
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-suggest English name and icon when Chinese name changes
  const triggerSuggest = useCallback((chineseName: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (!chineseName.trim()) return
    suggestTimer.current = setTimeout(async () => {
      setSuggesting(true)
      try {
        const res = await restClient.post<{ data: { name_en: string; icon: string } }>('/api/showcase/suggest', { name: chineseName.trim() })
        const { name_en, icon: suggestedIcon } = res.data || {}
        // Only fill if user hasn't manually typed something
        setNameEn(prev => prev ? prev : (name_en || ''))
        setIcon(prev => prev ? prev : (suggestedIcon || ''))
      } catch (err) {
        // Silently fail — user can still type manually
      } finally {
        setSuggesting(false)
      }
    }, 600)
  }, [])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await restClient.post('/api/showcase/domains', {
        industry_id: industryId,
        name: name.trim(),
        name_en: nameEn.trim() || undefined,
        icon: icon.trim() || undefined,
      })
      setName('')
      setNameEn('')
      setIcon('')
      setOpen(false)
      onCreated()
    } catch (err) {
      console.error('Failed to create domain:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white transition-colors" title={t('showcase.addDomain')}>
        <Plus className="w-3.5 h-3.5" />
      </button>
    )
  }

  return (
    <div className="mt-2 p-3 bg-gray-800 rounded-lg border border-gray-700 space-y-2">
      <div className="flex gap-2">
        <input
          type="text" value={icon} onChange={e => setIcon(e.target.value)}
          placeholder={t('showcase.iconPlaceholder')}
          className="w-12 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-center text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <input
          type="text" value={name} onChange={e => { setName(e.target.value); triggerSuggest(e.target.value) }}
          placeholder={t('showcase.domainNamePlaceholder')}
          className="flex-1 px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          autoFocus
        />
      </div>
      <div className="relative">
        <input
          type="text" value={nameEn} onChange={e => setNameEn(e.target.value)}
          placeholder={suggesting ? t('showcase.aiSuggesting') : t('showcase.enNameOptionalPlaceholder')}
          className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        {suggesting && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-400 animate-spin" />}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => { setOpen(false); setName(''); setNameEn(''); setIcon('') }} className="px-2 py-1 text-xs text-gray-400 hover:text-white">{t('common.cancel')}</button>
        <button onClick={handleSave} disabled={saving || !name.trim()} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50">
          {saving ? '...' : t('showcase.add')}
        </button>
      </div>
    </div>
  )
}

function DomainRow({ domain, onUpdated, onDeleted }: {
  domain: ShowcaseDomain
  onUpdated: () => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(domain.name)
  const [nameEn, setNameEn] = useState(domain.name_en || '')
  const [icon, setIcon] = useState(domain.icon || '')
  const [deleting, setDeleting] = useState(false)
  const { t } = useTranslation()

  const handleSave = async () => {
    if (!name.trim()) return
    try {
      await restClient.put(`/api/showcase/domains/${domain.id}`, {
        name: name.trim(),
        name_en: nameEn.trim() || null,
        icon: icon.trim() || null,
      })
      setEditing(false)
      onUpdated()
    } catch (err) {
      console.error('Failed to update domain:', err)
    }
  }

  const handleDelete = async () => {
    if (!confirm(t('showcase.deleteDomainConfirm').replace('{name}', domain.name))) return
    setDeleting(true)
    try {
      await restClient.delete(`/api/showcase/domains/${domain.id}`)
      onDeleted()
    } catch (err) {
      console.error('Failed to delete domain:', err)
    } finally {
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <div className="p-3 bg-gray-800 rounded-lg border border-blue-500/30 space-y-2">
        <div className="flex gap-2">
          <input
            type="text" value={icon} onChange={e => setIcon(e.target.value)}
            placeholder={t('showcase.iconPlaceholder')}
            className="w-12 px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-center text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder={t('showcase.domainNamePlaceholder')}
            className="flex-1 px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            autoFocus
          />
        </div>
        <input
          type="text" value={nameEn} onChange={e => setNameEn(e.target.value)}
          placeholder={t('showcase.enNamePlaceholder')}
          className="w-full px-2.5 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
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
        <button onClick={() => { setEditing(true); setName(domain.name); setNameEn(domain.name_en || ''); setIcon(domain.icon || '') }} className="p-0.5 rounded text-gray-500 hover:text-white" title={t('showcase.edit')}>
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={handleDelete} disabled={deleting} className="p-0.5 rounded text-gray-500 hover:text-red-400" title={t('common.delete')}>
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Display components (cards)
// ============================================================================

function DomainSection({ domain, onRun, onView }: { domain: ShowcaseDomain; onRun: (c: ShowcaseCase) => void; onView: (c: ShowcaseCase) => void }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        {domain.icon && <span className="text-lg">{domain.icon}</span>}
        <h2 className="text-base font-semibold text-white">
          {domain.name}
          {domain.name_en && (
            <span className="text-gray-500 font-normal ml-2">（{domain.name_en}）</span>
          )}
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {domain.cases.map(c => (
          <CaseCard key={c.id} caseItem={c} onRun={() => onRun(c)} onView={() => onView(c)} />
        ))}
      </div>
    </section>
  )
}

function CaseCard({ caseItem, onRun, onView }: { caseItem: ShowcaseCase; onRun: () => void; onView: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between hover:border-gray-700 transition-colors group">
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">{caseItem.title}</h3>
        {caseItem.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{caseItem.description}</p>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        {caseItem.session_id && (
          <button
            onClick={onView}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 border border-gray-700 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <Eye className="w-3 h-3" />
            {t('showcase.view')}
          </button>
        )}
        <button
          onClick={onRun}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition-colors"
        >
          <Play className="w-3 h-3" />
          {t('marketplace.run')}
        </button>
      </div>
    </div>
  )
}
