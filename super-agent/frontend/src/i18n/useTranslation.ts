import { useContext } from 'react'
import { TranslationContext } from './context'
import type { TranslationContextType } from '@/types'

export function useTranslation(): TranslationContextType {
  const context = useContext(TranslationContext)
  
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider')
  }
  
  return context
}
