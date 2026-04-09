import { useContext } from 'react'
import { ChatContext, type ChatContextType } from './ChatContext'

/**
 * Hook to access chat session state and actions
 * Must be used within a ChatProvider
 */
export function useChat(): ChatContextType {
  const context = useContext(ChatContext)
  
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  
  return context
}
