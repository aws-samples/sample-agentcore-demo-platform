import { memo, useCallback } from 'react'
import { Play, Bot, User, Zap, CheckCircle, GripVertical } from 'lucide-react'
import type { WorkflowNode as WorkflowNodeType, NodeType } from '@/types'

interface WorkflowNodeProps {
  node: WorkflowNodeType
  isSelected?: boolean
  onSelect?: (nodeId: string) => void
  onDragStart?: (nodeId: string, e: React.MouseEvent) => void
}

const nodeTypeConfig: Record<NodeType, { 
  icon: typeof Play
  bgColor: string
  borderColor: string
  iconColor: string
}> = {
  trigger: {
    icon: Play,
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/50',
    iconColor: 'text-green-400',
  },
  agent: {
    icon: Bot,
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/50',
    iconColor: 'text-blue-400',
  },
  human: {
    icon: User,
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/50',
    iconColor: 'text-purple-400',
  },
  action: {
    icon: Zap,
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/50',
    iconColor: 'text-orange-400',
  },
  end: {
    icon: CheckCircle,
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/50',
    iconColor: 'text-gray-400',
  },
}

export const WorkflowNode = memo(function WorkflowNode({
  node,
  isSelected = false,
  onSelect,
  onDragStart,
}: WorkflowNodeProps) {
  const config = nodeTypeConfig[node.type]
  const Icon = config.icon

  const handleClick = useCallback(() => {
    onSelect?.(node.id)
  }, [node.id, onSelect])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      onDragStart?.(node.id, e)
    }
  }, [node.id, onDragStart])

  return (
    <div
      className={`
        absolute cursor-move select-none
        w-48 rounded-lg border-2 transition-all duration-200
        ${config.bgColor} ${config.borderColor}
        ${isSelected ? 'ring-2 ring-white/50 shadow-lg scale-105' : 'hover:scale-102'}
      `}
      style={{
        left: node.position.x,
        top: node.position.y,
        transform: 'translate(-50%, -50%)',
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      role="button"
      tabIndex={0}
      aria-label={`${node.type} node: ${node.label}`}
    >
      {/* Drag Handle */}
      <div className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      {/* Node Content */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className={`p-1.5 rounded ${config.bgColor}`}>
            <Icon className={`w-4 h-4 ${config.iconColor}`} />
          </div>
          <span className="text-sm font-medium text-white truncate">
            {node.label}
          </span>
        </div>
        <p className="text-xs text-gray-400 line-clamp-2">
          {node.description}
        </p>
      </div>

      {/* Connection Points */}
      <div className="absolute left-1/2 -top-2 w-3 h-3 bg-gray-600 rounded-full border-2 border-gray-800 -translate-x-1/2" />
      <div className="absolute left-1/2 -bottom-2 w-3 h-3 bg-gray-600 rounded-full border-2 border-gray-800 -translate-x-1/2" />
    </div>
  )
})
