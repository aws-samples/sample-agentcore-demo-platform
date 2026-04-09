import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface StatsCardProps {
  title: string
  value: string | number
  icon: ReactNode
  color: 'blue' | 'green' | 'purple' | 'orange'
  href?: string
}

const colorClasses = {
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  purple: 'from-purple-500 to-purple-600',
  orange: 'from-orange-500 to-orange-600',
}

export function StatsCard({ title, value, icon, color, href }: StatsCardProps) {
  const content = (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-sm mb-1">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
        {icon}
      </div>
    </div>
  )

  const baseClasses = "bg-gray-800 rounded-xl p-5 border border-gray-700"
  const hoverClasses = href ? "hover:border-gray-600 hover:bg-gray-750 transition-colors cursor-pointer" : ""

  if (href) {
    return (
      <Link to={href} className={`${baseClasses} ${hoverClasses} block`}>
        {content}
      </Link>
    )
  }

  return (
    <div className={baseClasses}>
      {content}
    </div>
  )
}
