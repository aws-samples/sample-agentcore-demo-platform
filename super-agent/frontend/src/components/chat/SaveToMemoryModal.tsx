/**
 * SaveToMemoryModal — Summarize a chat session and save it as a scope memory.
 * Calls the /summarize endpoint, lets user edit the draft, then saves.
 */

import { useState } from 'react'
import { Brain, Loader2, X } from 'lucide-react'
import { restScopeMemoryService } from '@/services/api/restScopeMemoryService'

const CATEGORIES = ['lesson', 'decision', 'procedure', 'fact', 'custom'] as const

interface SaveToMemoryModalProps {
  scopeId: string
  sessionId: string
  onClose: () => void
  onSaved?: () => void
}

export function SaveToMemoryModal({ scopeId, sessionId, onClose, onSaved }: SaveToMemoryModalProps) {
  const [step, setStep] = useState<'summarizing' | 'edit' | 'saving' | 'done'>('summarizing')
  const [form, setForm] = useState({ title: '', content: '', category: 'lesson', tags: '', is_pinned: false })
  const [error, setError] = useState<string | null>(null)

  // Auto-summarize on mount
  useState(() => {
    restScopeMemoryService.summarize(scopeId, sessionId)
      .then(draft => {
        setForm({
          title: draft.title,
          content: draft.content,
          category: draft.category || 'lesson',
          tags: draft.tags?.join(', ') || '',
          is_pinned: false,
        })
        setStep('edit')
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : 'Failed to summarize session')
        setStep('edit')
      })
  })

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    setStep('saving')
    try {
      await restScopeMemoryService.create(scopeId, {
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        is_pinned: form.is_pinned,
        session_id: sessionId,
      })
      setStep('done')
      onSaved?.()
      setTimeout(onClose, 800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save memory')
      setStep('edit')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-white">Save to Scope Memory</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4">
          {step === 'summarizing' && (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-400">Summarizing session...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-8 text-center">
              <Brain className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-emerald-400">Memory saved!</p>
            </div>
          )}

          {(step === 'edit' || step === 'saving') && (
            <div className="space-y-3">
              {error && (
                <div className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded">{error}</div>
              )}
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Memory title"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
              />
              <textarea
                value={form.content}
                onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Key takeaways from this session..."
                rows={6}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <select
                  value={form.category}
                  onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
                  className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 focus:outline-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => setForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="Tags (comma-separated)"
                  className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:outline-none"
                />
                <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_pinned}
                    onChange={e => setForm(prev => ({ ...prev, is_pinned: e.target.checked }))}
                    className="rounded"
                  />
                  Pin
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={step === 'saving' || !form.title.trim() || !form.content.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-40"
                >
                  {step === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save Memory
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
