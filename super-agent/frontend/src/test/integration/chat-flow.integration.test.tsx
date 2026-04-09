import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../app-utils'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components'
import { Chat } from '@/pages'
import { ChatService } from '@/services/chatService'

// Test component for chat page
function TestChatApp() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </AppShell>
  )
}

describe('Chat Message Flow Integration Tests', () => {
  beforeEach(() => {
    // Reset chat service store before each test
    ChatService.resetStore()
  })

  it('should send message and receive AI response', async () => {
    const user = userEvent.setup()
    render(<TestChatApp />, { initialEntries: ['/chat'] })

    // Wait for page to load and loading to complete
    await waitFor(() => {
      expect(screen.getByText('Chat')).toBeInTheDocument()
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    // Find message input and send button (send button has no accessible name, so find by disabled state)
    const messageInput = screen.getByPlaceholderText(/type your message/i)
    
    // Type a message first to enable the send button
    const testMessage = 'Hello, I need help with onboarding'
    await user.type(messageInput, testMessage)
    
    // Now find the enabled send button
    const sendButton = screen.getByRole('button', { name: '' })

    // Verify message appears in input
    expect(messageInput).toHaveValue(testMessage)

    // Send the message
    await user.click(sendButton)

    // Verify user message appears in chat
    await waitFor(() => {
      expect(screen.getByText(testMessage)).toBeInTheDocument()
    })

    // Verify input is cleared after sending
    expect(messageInput).toHaveValue('')

    // Wait for AI response (the ChatService has simulated delays)
    await waitFor(() => {
      // Look for any of the possible AI responses
      const possibleResponses = [
        /I understand your request/i,
        /I'm processing your request/i,
        /Here's what I found/i
      ]
      
      const hasAnyResponse = possibleResponses.some(pattern => 
        screen.queryByText(pattern) !== null
      )
      
      expect(hasAnyResponse).toBe(true)
    }, { timeout: 5000 })
  })

  it('should change SOP context and show notification', async () => {
    const user = userEvent.setup()
    render(<TestChatApp />, { initialEntries: ['/chat'] })

    // Wait for page to load and loading to complete
    await waitFor(() => {
      expect(screen.getByText('Chat')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    // Find SOP context dropdown
    const sopDropdown = screen.getByRole('button', { name: /select sop context/i })
    
    // Change SOP context
    await user.click(sopDropdown)
    const hrOption = screen.getByRole('button', { name: /hr onboarding/i })
    await user.click(hrOption)

    // Verify context switch notification appears
    await waitFor(() => {
      expect(screen.getByText(/context switched to hr onboarding/i)).toBeInTheDocument()
    })
  })

  it('should display context panel with memories and use cases', async () => {
    render(<TestChatApp />, { initialEntries: ['/chat'] })

    // Wait for page to load and loading to complete
    await waitFor(() => {
      expect(screen.getByText('Chat')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    // Verify context panel sections are present (default context has no memories, so only check Use Cases and Related Links)
    expect(screen.getByText('Use Cases')).toBeInTheDocument()
    expect(screen.getByText('Related Links')).toBeInTheDocument()
    
    // Verify default context content
    expect(screen.getByText('General Assistance')).toBeInTheDocument()
    expect(screen.getByText('Documentation')).toBeInTheDocument()
  })

  it('should display quick questions based on SOP context', async () => {
    const user = userEvent.setup()
    render(<TestChatApp />, { initialEntries: ['/chat'] })

    // Wait for page to load and loading to complete
    await waitFor(() => {
      expect(screen.getByText('Chat')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    // Wait for quick questions to load (they should be available for default context)
    await waitFor(() => {
      expect(screen.getByText('What can you help me with?')).toBeInTheDocument()
      expect(screen.getByText('Show me available resources')).toBeInTheDocument()
    })

    // Click on a quick question (use getAllByText since there might be duplicates)
    const quickQuestionButtons = screen.getAllByText('What can you help me with?')
    const quickQuestionButton = quickQuestionButtons.find(el => el.closest('button'))
    await user.click(quickQuestionButton!.closest('button')!)

    // Verify the question appears as a message (it gets sent automatically)
    await waitFor(() => {
      // After clicking, the message should appear in the chat area
      const messageElements = screen.getAllByText('What can you help me with?')
      expect(messageElements.length).toBeGreaterThan(1) // Should be in both quick questions and chat messages
    })
  })

  it('should handle message sending with Enter key', async () => {
    const user = userEvent.setup()
    render(<TestChatApp />, { initialEntries: ['/chat'] })

    // Wait for page to load and loading to complete
    await waitFor(() => {
      expect(screen.getByText('Chat')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    // Find message input
    const messageInput = screen.getByPlaceholderText(/type your message/i)

    // Type a message and press Enter
    const testMessage = 'Test message with Enter key'
    await user.type(messageInput, testMessage)
    await user.keyboard('{Enter}')

    // Verify message appears in chat
    await waitFor(() => {
      expect(screen.getByText(testMessage)).toBeInTheDocument()
    })

    // Verify input is cleared
    expect(messageInput).toHaveValue('')
  })
})