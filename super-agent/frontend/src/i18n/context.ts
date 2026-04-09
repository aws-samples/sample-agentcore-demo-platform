import { createContext } from 'react'
import type { TranslationContextType } from '@/types'

const defaultContext: TranslationContextType = {
  currentLanguage: 'en',
  setLanguage: () => {},
  t: (key: string) => key
}

export const TranslationContext = createContext<TranslationContextType>(defaultContext)
