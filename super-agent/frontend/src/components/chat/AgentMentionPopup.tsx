/**
 * AgentMentionPopup
 * Floating popup that appears when user types '@' in the chat input.
 * Shows agents in the current business scope for @mention routing.
 */
import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Bot } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { AgentService } from '@/services/agentService'
import type { Agent } from '@/types'
import { getAvatarDisplayUrl, getAvatarFallback, shouldShowAvatarImage } from '@/utils/avatarUtils'

export interface MentionAgent {
  id: string
  name: string
  displayName: string
  role: string
  avatar: string
  status: string
}

export interface AgentMentionPopupHandle {
  /** Move selection up */
  moveUp: () => void
  /** Move selection down */
  moveDown: () => void
  /** Confirm current selection, returns the selected agent or null */
  confirm: () => MentionAgent | null
  /** Whether the popup has items */
  hasItems: boolean
}

interface AgentMentionPopupProps {
  /** Current business scope ID — agents are loaded from this scope */
  scopeId: string | null
  /** Filter query (text after '@') */
  query: string
  /** Called when user clicks an agent */
  onSelect: (agent: MentionAgent) => void
  /** Position anchor — bottom of the popup aligns to this Y, left aligns to this X */
  anchorRect?: { bottom: number; left: number } | null
}

export const AgentMentionPopup = forwardRef<AgentMentionPopupHandle, AgentMentionPopupProps>(
  function AgentMentionPopup({ scopeId, query, onSelect, anchorRect }, ref) {
    const { t } = useTranslation()
    const [agents, setAgents] = useState<MentionAgent[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const listRef = useRef<HTMLDivElement>(null)

    // Load agents for the scope
    useEffect(() => {
      if (!scopeId) {
        setAgents([])
        return
      }

      let cancelled = false
      setIsLoading(true)

      const loadAgents = async () => {
        try {
          const svc = AgentService
          const scopeAgents = svc.getAgentsByBusinessScope
            ? await svc.getAgentsByBusinessScope(scopeId)
            : (await svc.getAgents()).filter(a => a.businessScopeId === scopeId)

          if (!cancelled) {
            setAgents(
              scopeAgents.map(a => ({
                id: a.id,
                name: a.name,
                displayName: a.displayName,
                role: a.role,
                avatar: a.avatar,
                status: a.status,
              }))
            )
          }
        } catch (err) {
          console.error('Failed to load scope agents for mention:', err)
          if (!cancelled) setAgents([])
        } finally {
          if (!cancelled) setIsLoading(false)
        }
      }

      void loadAgents()
      return () => { cancelled = true }
    }, [scopeId])

    // Filter agents by query
    const filtered = agents.filter(a => {
      if (!query) return true
      const q = query.toLowerCase()
      return (
        a.displayName.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q)
      )
    })

    // Reset selection when filtered list changes
    useEffect(() => {
      setSelectedIndex(0)
    }, [query, agents.length])

    // Scroll active item into view
    useEffect(() => {
      if (listRef.current) {
        const active = listRef.current.children[selectedIndex] as HTMLElement | undefined
        active?.scrollIntoView({ block: 'nearest' })
      }
    }, [selectedIndex])

    // Expose imperative handle for keyboard navigation
    useImperativeHandle(ref, () => ({
      moveUp: () => {
        setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length)
      },
      moveDown: () => {
        setSelectedIndex(i => (i + 1) % filtered.length)
      },
      confirm: () => {
        if (filtered.length === 0) return null
        return filtered[selectedIndex] ?? null
      },
      hasItems: filtered.length > 0,
    }), [filtered, selectedIndex])

    if (filtered.length === 0 && !isLoading) return null

    const statusColor = (status: string) => {
      switch (status) {
        case 'active': return 'bg-green-500'
        case 'busy': return 'bg-yellow-500'
        default: return 'bg-gray-500'
      }
    }

    return (
      <div
        className="absolute bottom-full left-4 right-4 mb-1 max-h-60 overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50"
        ref={listRef}
      >
        {/* Header */}
        <div className="px-3 py-1.5 text-xs text-gray-500 font-medium border-b border-gray-700 flex items-center gap-1.5">
          <Bot className="w-3 h-3" />
          {t('chat.mentionAgent')}
        </div>

        {isLoading ? (
          <div className="px-3 py-3 text-sm text-gray-500 text-center">
            {t('common.loading')}
          </div>
        ) : (
          filtered.map((agent, i) => {
            const avatarUrl = getAvatarDisplayUrl(agent.avatar)
            const fallbackChar = getAvatarFallback(agent.displayName, agent.avatar)
            const showImage = shouldShowAvatarImage(agent.avatar)

            return (
              <button
                key={agent.id}
                onMouseDown={(e) => { e.preventDefault(); onSelect(agent) }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors ${
                  i === selectedIndex ? 'bg-blue-600/25 text-white' : 'text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                {/* Avatar with status dot */}
                <div className="relative flex-shrink-0">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium overflow-hidden bg-gray-600">
                    {showImage && avatarUrl ? (
                      <img src={avatarUrl} alt={agent.displayName} className="w-full h-full object-cover" />
                    ) : (
                      fallbackChar
                    )}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-gray-800 ${statusColor(agent.status)}`} />
                </div>

                {/* Name + role */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{agent.displayName}</div>
                  <div className="text-xs text-gray-500 truncate">{agent.role}</div>
                </div>
              </button>
            )
          })
        )}
      </div>
    )
  }
)
