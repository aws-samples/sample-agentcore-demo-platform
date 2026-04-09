import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, CheckCircle } from 'lucide-react'

type CardVariant = 'default' | 'agents' | 'tasks' | 'sla' | 'intelligence'

interface StatsCardPremiumProps {
  title: string
  value: string | number
  icon: ReactNode
  variant?: CardVariant
  href?: string
  // For agents card
  trend?: string
  trendPositive?: boolean
  // For tasks card
  progress?: number
  progressColor?: string
  // For SLA card
  statusText?: string
  statusHealthy?: boolean
  // For intelligence card
  activeLabel?: string
  slots?: { total: number; completed: number }
}

export function StatsCardPremium({ 
  title, 
  value, 
  icon, 
  variant = 'default',
  href,
  trend,
  trendPositive = true,
  progress,
  progressColor = 'bg-pink-500',
  statusText,
  statusHealthy = true,
  activeLabel,
  slots,
}: StatsCardPremiumProps) {
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'intelligence':
        return 'border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-400/50 hover:bg-cyan-500/10'
      default:
        return 'border-white/[0.06] bg-gray-900/60 hover:border-purple-500/50 hover:bg-gray-900/80'
    }
  }

  const getIconColor = () => {
    switch (variant) {
      case 'intelligence':
        return 'text-cyan-500/20'
      default:
        return 'text-white/[0.08]'
    }
  }

  const content = (
    <div className={`
      relative rounded-2xl p-6 border backdrop-blur-xl overflow-hidden h-[140px]
      transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
      ${getVariantStyles()}
      ${href ? 'cursor-pointer' : ''}
    `}>
      {/* Background Icon */}
      <div className={`absolute -right-4 -top-4 ${getIconColor()}`}>
        <div className="w-24 h-24 flex items-center justify-center">
          {icon}
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {/* Value */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-4xl font-bold text-white tracking-tight">{value}</span>
          {activeLabel && (
            <span className="text-base text-gray-500">{activeLabel}</span>
          )}
        </div>
        
        {/* Title */}
        <p className="text-sm text-gray-400 mb-3">{title}</p>
        
        {/* Bottom section based on variant */}
        {trend && (
          <div className={`text-xs flex items-center gap-1.5 ${trendPositive ? 'text-green-400' : 'text-red-400'}`}>
            <TrendingUp className="w-3.5 h-3.5" />
            {trend}
          </div>
        )}

        {progress !== undefined && (
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${progressColor} shadow-lg`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {statusText && (
          <div className={`text-xs flex items-center gap-1.5 ${statusHealthy ? 'text-cyan-400' : 'text-yellow-400'}`}>
            <CheckCircle className="w-3.5 h-3.5" />
            {statusText}
          </div>
        )}

        {slots && (
          <div className="flex gap-1">
            {Array.from({ length: slots.total }).map((_, i) => (
              <div 
                key={i}
                className={`flex-1 h-1 rounded-full ${
                  i < slots.completed 
                    ? 'bg-green-500' 
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link to={href} className="block">{content}</Link>
  }

  return content
}
