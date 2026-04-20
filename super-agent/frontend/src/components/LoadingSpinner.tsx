import React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from '@/i18n'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  text?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '',
  text 
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-4 w-4'
      case 'md':
        return 'h-6 w-6'
      case 'lg':
        return 'h-8 w-8'
      case 'xl':
        return 'h-12 w-12'
    }
  }

  const getTextSize = () => {
    switch (size) {
      case 'sm':
        return 'text-sm'
      case 'md':
        return 'text-base'
      case 'lg':
        return 'text-lg'
      case 'xl':
        return 'text-xl'
    }
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className={`${getSizeClasses()} text-blue-500 animate-spin`} />
        {text && (
          <span className={`${getTextSize()} text-gray-400`}>
            {text}
          </span>
        )}
      </div>
    </div>
  )
}

interface FullPageLoadingProps {
  text?: string
}

export const FullPageLoading: React.FC<FullPageLoadingProps> = ({ text }) => {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <LoadingSpinner size="xl" text={text ?? t('common.loading')} />
    </div>
  )
}

interface InlineLoadingProps {
  text?: string
  className?: string
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({ text, className }) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      {text && <span className="text-sm text-gray-400">{text}</span>}
    </div>
  )
}
