import { useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Language, TranslationContextType } from '@/types'
import { TranslationContext } from './context'
import { translations } from './translations'

const LANGUAGE_STORAGE_KEY = 'super-agent-language'

interface TranslationProviderProps {
  children: ReactNode
}

export function TranslationProvider({ children }: TranslationProviderProps) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (stored === 'en' || stored === 'cn') {
        return stored
      }
    }
    return 'en'
  })

  // Persist language preference to localStorage
  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage)
  }, [currentLanguage])

  const setLanguage = useCallback((lang: Language) => {
    setCurrentLanguage(lang)
  }, [])

  const t = useCallback((key: string): string => {
    const translation = translations[key]
    if (!translation) {
      console.warn(`Translation missing for key: ${key}`)
      return key
    }
    return translation[currentLanguage]
  }, [currentLanguage])

  const value: TranslationContextType = {
    currentLanguage,
    setLanguage,
    t
  }

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  )
}
