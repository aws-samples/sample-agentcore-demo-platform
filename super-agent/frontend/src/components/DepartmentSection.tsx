import type { ReactNode } from 'react'
import type { Agent } from '@/types'
import { AgentCard } from './AgentCard'

interface DepartmentSectionProps {
  name: string
  icon: ReactNode
  color: string
  agents: Agent[]
}

export function DepartmentSection({ name, icon, color, agents }: DepartmentSectionProps) {
  if (agents.length === 0) return null

  return (
    <div className="mb-6">
      {/* Department Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
          {icon}
        </div>
        <h3 className="text-white font-semibold">{name}</h3>
        <span className="text-gray-500 text-sm">({agents.length})</span>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  )
}
