import type { AgentSummary } from '@/types'
import { getAvatarDisplayUrl, getAvatarFallback, shouldShowAvatarImage } from '@/utils/avatarUtils'

interface AgentCellProps {
  agent: AgentSummary
}

export function AgentCell({ agent }: AgentCellProps) {
  const avatarUrl = getAvatarDisplayUrl(agent.avatar)
  const avatarFallback = getAvatarFallback(agent.name, agent.avatar)
  const showImage = shouldShowAvatarImage(agent.avatar)

  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden">
        {showImage && avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={agent.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              e.currentTarget.parentElement!.textContent = avatarFallback
            }}
          />
        ) : (
          avatarFallback
        )}
      </div>
      
      {/* Name and Role */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{agent.name}</p>
        <p className="text-xs text-gray-400 truncate">{agent.role}</p>
      </div>
    </div>
  )
}
