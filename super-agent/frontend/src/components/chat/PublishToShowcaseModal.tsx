/**
 * PublishToShowcaseModal — Modal for publishing a chat session to the showcase ("明星案例").
 * Shown when user clicks the star button on a session.
 * Collects: domain (category), title, description, initial_prompt.
 */

import { useState, useEffect } from 'react'
import { X, Star, Loader2 } from 'lucide-react'
import { restClient } from '@/services/api/restClient'
import { useTranslation } from '@/i18n/useTranslation'

interface ShowcaseDomainOption {
  id: string
  name: string
  name_en: string | null
  icon: string | null
  industry: { id: string; name: string }
}

interface PublishToShowcaseModalProps {
  sessionId: string
  sessionTitle: string | null
  onClose: () => void
  onPublished: () => void
  onStarOnly: () => void
}

export function PublishToShowcaseModal({ sessionId, sessionTitle, onClose, onPublished, onStarOnly }: PublishToShowcaseModalProps) {
  const { t } = useTranslation()
  const [domains, setDomains] = useState<ShowcaseDomainOption[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedDomainId, setSelectedDomainId] = useState('')
  const [title, setTitle] = useState(sessionTitle || '')
  const [description, setDescription] = useState('')
  const [initialPrompt, setInitialPrompt] = useState('')

  // Load available domains (grouped by industry)
  useEffect(() => {
    async function load() {
      try {
        const res = await restClient.get<{ data: any[] }>('/api/showcase')
        const allDomains: ShowcaseDomainOption[] = []
        for (const industry of (res.data || [])) {
          for (const domain of (industry.domains || [])) {
            allDomains.push({
              id: domain.id,
              name: domain.name,
              name_en: domain.name_en,
              icon: domain.icon,
              industry: { id: industry.id, name: industry.name },
            })
          }
        }
        setDomains(allDomains)
        if (allDomains.length > 0) setSelectedDomainId(allDomains[0].id)
      } catch (err) {
        console.error('Failed to load showcase domains:', err)
        setError(t('showcase.loadError'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handlePublish = async () => {
    if (!selectedDomainId || !title.trim()) return
    setPublishing(true)
    setError(null)
    try {
      await restClient.post('/api/showcase/publish', {
        session_id: sessionId,
        domain_id: selectedDomainId,
        title: title.trim(),
        description: description.trim() || undefined,
        initial_prompt: initialPrompt.trim() || undefined,
      })
      onPublished()
    } catch (err) {
      console.error('Failed to publish to showcase:', err)
      setError(t('showcase.publishError'))
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
            <h3 className="text-lg font-semibold text-white">{t('showcase.publishTitle')}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Domain selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{t('showcase.category')}</label>
              {domains.length === 0 ? (
                <p className="text-xs text-yellow-400">{t('showcase.noCategories')}</p>
              ) : (
                <select
                  value={selectedDomainId}
                  onChange={e => setSelectedDomainId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {domains.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.icon || ''} {d.industry.name} / {d.name}{d.name_en ? ` (${d.name_en})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{t('showcase.caseName')}</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('showcase.caseNamePlaceholder')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{t('showcase.briefDescription')}</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('showcase.briefDescPlaceholder')}
                rows={2}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* Initial Prompt */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">{t('showcase.guidingPrompt')} <span className="text-gray-600">({t('showcase.guidingPromptOptional')})</span></label>
              <textarea
                value={initialPrompt}
                onChange={e => setInitialPrompt(e.target.value)}
                placeholder={t('showcase.guidingPromptPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
              />
              <p className="text-xs text-gray-600 mt-1">{t('showcase.guidingPromptHint')}</p>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={async () => {
                  try {
                    await restClient.put(`/api/chat/sessions/${sessionId}/star`, {})
                    onStarOnly()
                  } catch (err) {
                    console.error('Failed to star:', err)
                  }
                }}
                className="px-3 py-2 text-sm text-gray-400 hover:text-yellow-400 transition-colors flex items-center gap-1.5"
              >
                <Star className="w-3.5 h-3.5" />
                {t('showcase.starOnly')}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing || !selectedDomainId || !title.trim()}
                  className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm font-medium hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t('showcase.publish')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
