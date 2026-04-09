import type { Capability } from '@/types'

interface CapabilityCardProps {
  capability: Capability
}

export function CapabilityCard({ capability }: CapabilityCardProps) {
  return (
    <div className="bg-gray-800/50 hover:bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all">
      {/* Icon and Category */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: `${capability.color}20` }}
        >
          {capability.icon}
        </div>
        <span
          className="text-xs px-2 py-1 rounded-full font-medium"
          style={{ backgroundColor: `${capability.color}20`, color: capability.color }}
        >
          {capability.category}
        </span>
      </div>

      {/* Name */}
      <h3 className="text-white font-semibold mb-2 line-clamp-2">{capability.name}</h3>

      {/* Description */}
      <p className="text-gray-400 text-sm mb-3 line-clamp-2">{capability.description}</p>

      {/* Tool Identifier */}
      <div className="pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-500 mb-1">Tool ID</p>
        <p className="text-xs text-gray-300 font-mono break-all">{capability.toolIdentifier}</p>
      </div>
    </div>
  )
}
