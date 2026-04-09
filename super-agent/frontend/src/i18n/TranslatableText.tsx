import { useTranslation } from './useTranslation'
import type { ElementType } from 'react'

type ValidElement = 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'label'

interface TranslatableTextProps<T extends ValidElement = 'span'> {
  /** The translation key to look up */
  translationKey: string
  /** Optional fallback text if translation is not found */
  fallback?: string
  /** Optional className for styling */
  className?: string
  /** HTML element to render (default: span) */
  as?: T
}

/**
 * A component for rendering translated text that automatically updates
 * when the language changes. Use this for dynamic content that needs
 * to be translated.
 */
export function TranslatableText<T extends ValidElement = 'span'>({
  translationKey,
  fallback,
  className,
  as
}: TranslatableTextProps<T>) {
  const { t } = useTranslation()
  
  const translatedText = t(translationKey)
  
  // If translation returns the key itself (not found), use fallback if provided
  const displayText = translatedText === translationKey && fallback 
    ? fallback 
    : translatedText

  const Component = (as || 'span') as ElementType

  return (
    <Component className={className}>
      {displayText}
    </Component>
  )
}
