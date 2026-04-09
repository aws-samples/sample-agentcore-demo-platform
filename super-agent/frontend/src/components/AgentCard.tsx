import { useNavigate } from 'react-router-dom'
import type { Agent, AgentStatus } from '@/types'
import { useTranslation } from '@/i18n'
import { getAvatarDisplayUrl, getAvatarFallback, shouldShowAvatarImage } from '@/utils/avatarUtils'

interface AgentCardProps {
  agent: Agent
}

const statusColors: Record<AgentStatus, { bg: string; dot: string; text: string }> = {
  active: { bg: 'bg-green-500/10', dot: 'bg-green-500', text: 'text-green-400' },
  busy: { bg: 'bg-blue-500/10', dot: 'bg-blue-500', text: 'text-blue-400' },
  offline: { bg: 'bg-gray-500/10', dot: 'bg-gray-500', text: 'text-gray-400' },
}

export function AgentCard({ agent }: AgentCardProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const statusStyle = statusColors[agent.status] || statusColors.active

  const handleClick = () => {
    navigate(`/agents?id=${agent.id}`)
  }

  const avatarUrl = getAvatarDisplayUrl(agent.avatar)
  const avatarFallback = getAvatarFallback(agent.displayName, agent.avatar)
  const showImage = shouldShowAvatarImage(agent.avatar)

  return (
    <button
      onClick={handleClick}
      className="w-full bg-gray-800/50 hover:bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all text-left group"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden">
          {showImage && avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={agent.displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to character on image load error
                e.currentTarget.style.display = 'none'
                e.currentTarget.parentElement!.textContent = avatarFallback
              }}
            />
          ) : (
            avatarFallback
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate group-hover:text-blue-400 transition-colors">
            {agent.displayName}
          </p>
          <p className="text-gray-400 text-sm truncate">{agent.role}</p>
        </div>

        {/* Status */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${statusStyle.bg}`}>
          <div className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
          <span className={`text-xs ${statusStyle.text}`}>
            {t(`status.${agent.status}`)}
          </span>
        </div>
      </div>
    </button>
  )
}
