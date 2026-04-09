import { Building2, Plus } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useNavigate } from 'react-router-dom'

interface CreateScopeCardProps {
  onClick?: () => void
}

export function CreateScopeCard({ onClick }: CreateScopeCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  
  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      navigate('/create-business-scope')
    }
  }
  
  return (
    <button
      onClick={handleClick}
      className="
        relative rounded-2xl p-6 border-2 border-dashed border-purple-500/30 
        bg-purple-500/5 backdrop-blur-xl overflow-hidden h-[140px]
        transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
        hover:border-purple-500/50 hover:bg-purple-500/10
        cursor-pointer text-left w-full
      "
    >
      {/* Background Icon */}
      <div className="absolute -right-4 -top-4 text-purple-500/10">
        <Plus className="w-24 h-24" />
      </div>

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center h-full text-center py-2">
        {/* Icon */}
        <div className="text-purple-400 mb-3">
          <Building2 className="w-8 h-8" />
        </div>
        
        {/* Title */}
        <p className="text-sm font-semibold text-purple-400 mb-1">
          {t('dashboard.createBusinessScope')}
        </p>
        
        {/* Subtitle */}
        <p className="text-xs text-gray-500">
          {t('createScope.subtitle')}
        </p>
      </div>
    </button>
  )
}
