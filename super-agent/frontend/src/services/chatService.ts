/**
 * Chat Service
 * 
 * This module provides the unified chat service that automatically switches
 * between mock and REST API implementations based on environment configuration.
 */

import type { Message, ChatContext, QuickQuestion } from '@/types'
import { getServiceConfig } from './api/createService'
import { RestChatService } from './api/restChatService'
import { shouldUseRestApi } from './api/index'

export type ChatServiceErrorCode = 'SESSION_NOT_FOUND' | 'VALIDATION_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN'

export class ChatServiceError extends Error {
  code: ChatServiceErrorCode
  constructor(message: string, code: ChatServiceErrorCode) {
    super(message)
    this.name = 'ChatServiceError'
    this.code = code
  }
}

const SIMULATED_DELAY = 500
const CHAT_HISTORY_STORAGE_KEY = 'super-agent-chat-history'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

const mockAIResponses: Record<string, string[]> = {
  'hr-onboarding': [
    'I can help you with the onboarding process. What specific information do you need?',
    'The onboarding checklist includes: document submission, system access setup, and team introductions.',
  ],
  'it-support': [
    'I\'ll help you troubleshoot this issue. Can you describe what you\'re experiencing?',
    'Have you tried restarting your device? This often resolves common issues.',
  ],
  default: [
    'I understand your request. Let me help you with that.',
    'I\'m processing your request. Please give me a moment.',
  ],
}

const mockContextData: Record<string, ChatContext> = {
  'hr-onboarding': {
    memories: [{ id: 'mem-1', content: 'Previous onboarding completed for 5 employees this month' }],
    useCases: [{ id: 'uc-1', title: 'New Employee Setup', description: 'Complete onboarding for new hires' }],
    relatedLinks: [{ id: 'link-1', title: 'Employee Handbook', url: '/docs/handbook' }],
  },
  default: { memories: [], useCases: [], relatedLinks: [] },
}

const mockQuickQuestions: Record<string, QuickQuestion[]> = {
  'hr-onboarding': [
    { id: 'qq-1', icon: '📋', category: 'Onboarding', text: 'What documents do I need to submit?' },
    { id: 'qq-2', icon: '📅', category: 'Onboarding', text: 'When is my orientation scheduled?' },
  ],
  default: [{ id: 'qq-default', icon: '❓', category: 'General', text: 'What can you help me with?' }],
}

const chatSessions: Map<string, Message[]> = new Map()

function loadPersistedHistory(): void {
  if (typeof window === 'undefined') return
  try {
    const stored = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, Message[]>
      Object.entries(parsed).forEach(([sessionId, messages]) => {
        chatSessions.set(sessionId, messages.map(msg => ({ ...msg, timestamp: new Date(msg.timestamp) })))
      })
    }
  } catch { /* ignore */ }
}

function persistHistory(): void {
  if (typeof window === 'undefined') return
  try {
    const data: Record<string, Message[]> = {}
    chatSessions.forEach((messages, sessionId) => { data[sessionId] = messages })
    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

loadPersistedHistory()

function generateAIResponse(userMessage: string, sopContext: string): string {
  const responses = mockAIResponses[sopContext] || mockAIResponses.default
  return responses[Math.abs(userMessage.length % responses.length)]
}

export const MockChatService = {
  async sendMessage(sessionId: string, content: string, sopContext: string): Promise<Message> {
    await delay(SIMULATED_DELAY)
    if (!content.trim()) throw new ChatServiceError('Message content cannot be empty', 'VALIDATION_ERROR')
    if (!chatSessions.has(sessionId)) chatSessions.set(sessionId, [])
    const messages = chatSessions.get(sessionId)!
    const userMessage: Message = { id: generateId(), type: 'user', content: content.trim(), timestamp: new Date() }
    messages.push(userMessage)
    await delay(SIMULATED_DELAY * 2)
    const aiResponse: Message = { id: generateId(), type: 'ai', content: generateAIResponse(content, sopContext), timestamp: new Date() }
    messages.push(aiResponse)
    persistHistory()
    return aiResponse
  },

  async getHistory(sessionId: string): Promise<Message[]> {
    await delay(SIMULATED_DELAY / 2)
    return [...(chatSessions.get(sessionId) || [])]
  },

  async getContext(sopContext: string): Promise<ChatContext> {
    await delay(SIMULATED_DELAY / 2)
    return mockContextData[sopContext] || mockContextData.default
  },

  async getQuickQuestions(sopId: string): Promise<QuickQuestion[]> {
    await delay(SIMULATED_DELAY / 2)
    return mockQuickQuestions[sopId] || mockQuickQuestions.default
  },

  async clearHistory(sessionId: string): Promise<void> {
    await delay(SIMULATED_DELAY / 2)
    chatSessions.delete(sessionId)
    persistHistory()
  },

  resetStore(): void {
    chatSessions.clear()
    if (typeof window !== 'undefined') localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY)
  },

  getSessionIds(): string[] { return Array.from(chatSessions.keys()) },
}

export interface IChatService {
  sendMessage(sessionId: string, content: string, sopContext: string): Promise<Message>
  getHistory(sessionId: string): Promise<Message[]>
  getContext(sopContext: string): Promise<ChatContext>
  getQuickQuestions?(sopId: string): Promise<QuickQuestion[]>
  clearHistory(sessionId: string): Promise<void>
  resetStore?(): void
  getSessionIds?(): string[]
}

function selectChatService(): IChatService {
  if (shouldUseRestApi()) {
    return RestChatService as unknown as IChatService
  }
  const config = getServiceConfig()
  return config.useMock ? MockChatService : (RestChatService as unknown as IChatService)
}

export const ChatService = selectChatService()
export default ChatService
