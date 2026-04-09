import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../app-utils'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components'
import { Dashboard, Chat, Workflow, Agents } from '@/pages'

// Test component for language toggle tests
function TestLanguageApp() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/workflow" element={<Workflow />} />
        <Route path="/agents" element={<Agents />} />
      </Routes>
    </AppShell>
  )
}

describe('Language Toggle Persistence Integration Tests', () => {
  beforeEach(() => {
    // Clear localStorage mock before each test
    const localStorageMock = window.localStorage as any
    localStorageMock.clear.mockClear()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
  })

  it('should toggle language and persist preference', async () => {
    const user = userEvent.setup()
    render(<TestLanguageApp />)

    // Initially should be in English
    expect(screen.getByText('Dashboard')).toBeInTheDocument()

    // Open admin menu
    const adminMenuButton = screen.getByRole('button', { name: /admin menu/i })
    await user.click(adminMenuButton)

    // Find language toggle using aria-label
    const languageToggle = screen.getByLabelText('Language Sync')
    await user.click(languageToggle)

    // Should switch to Chinese
    await waitFor(() => {
      expect(screen.getByText('仪表板')).toBeInTheDocument() // Dashboard in Chinese
    })

    // Verify language preference is saved in localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('language', 'cn')

    // Toggle back to English
    const adminMenuButton2 = screen.getByRole('button', { name: /admin menu/i })
    await user.click(adminMenuButton2)
    
    const languageToggle2 = screen.getByLabelText('Language Sync')
    await user.click(languageToggle2)

    // Should switch back to English
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    // Verify language preference is updated in localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('language', 'en')
  })

  it('should restore language preference on app reload', async () => {
    // Set Chinese as preferred language in localStorage mock
    const localStorageMock = window.localStorage as any
    localStorageMock.getItem.mockReturnValue('cn')

    render(<TestLanguageApp />)

    // Should start in Chinese
    await waitFor(() => {
      expect(screen.getByText('仪表板')).toBeInTheDocument() // Dashboard in Chinese
    })
  })

  it('should translate navigation items when language changes', async () => {
    const user = userEvent.setup()
    render(<TestLanguageApp />)

    // Verify English navigation items (using title attributes)
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /workflow/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /agents/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tools/i })).toBeInTheDocument()

    // Toggle to Chinese
    const adminMenuButton = screen.getByRole('button', { name: /admin menu/i })
    await user.click(adminMenuButton)

    const languageToggle = screen.getByLabelText('Language Sync')
    await user.click(languageToggle)

    // Verify Chinese navigation items (using title attributes)
    await waitFor(() => {
      expect(screen.getByTitle('仪表板')).toBeInTheDocument() // Dashboard
      expect(screen.getByTitle('对话')).toBeInTheDocument() // Chat
      expect(screen.getByTitle('工作流')).toBeInTheDocument() // Workflow
      expect(screen.getByTitle('智能体')).toBeInTheDocument() // Agents
      expect(screen.getByTitle('工具')).toBeInTheDocument() // Tools
    })
  })

  it('should translate dynamic content when language changes', async () => {
    const user = userEvent.setup()
    render(<TestLanguageApp />, { initialEntries: ['/agents'] })

    // Wait for page to load and check for the page title in the header
    await waitFor(() => {
      expect(screen.getByText('Agent Management')).toBeInTheDocument()
    })

    // Wait for agents to load
    await waitFor(() => {
      expect(screen.getByText('HR Assistant')).toBeInTheDocument()
    })

    // Toggle to Chinese
    const adminMenuButton = screen.getByRole('button', { name: /admin menu/i })
    await user.click(adminMenuButton)

    const languageToggle = screen.getByLabelText('Language Sync')
    await user.click(languageToggle)

    // Verify page title is translated
    await waitFor(() => {
      expect(screen.getByText('智能体管理')).toBeInTheDocument() // Agent Management in Chinese
    })

    // Agent names should remain the same (they're proper nouns)
    expect(screen.getByText('HR Assistant')).toBeInTheDocument()
  })

  it('should handle language toggle in different pages', async () => {
    const user = userEvent.setup()
    render(<TestLanguageApp />, { initialEntries: ['/chat'] })

    // Wait for page to load and check for the page title
    await waitFor(() => {
      expect(screen.getByText('Chat')).toBeInTheDocument()
    })

    // Toggle language from Chat page
    const adminMenuButton = screen.getByRole('button', { name: /admin menu/i })
    await user.click(adminMenuButton)

    const languageToggle = screen.getByLabelText('Language Sync')
    await user.click(languageToggle)

    // Verify Chat page is translated
    await waitFor(() => {
      expect(screen.getByText('对话')).toBeInTheDocument() // Chat in Chinese
    })

    // Navigate to other pages and verify they're in Chinese
    const workflowNavButton = screen.getByTitle('工作流')
    await user.click(workflowNavButton)
    
    await waitFor(() => {
      expect(screen.getByText('工作流设计器')).toBeInTheDocument() // Workflow Designer in Chinese
    })
  })

  it('should maintain language preference across page navigation', async () => {
    const user = userEvent.setup()
    render(<TestLanguageApp />)

    // Toggle to Chinese
    const adminMenuButton = screen.getByRole('button', { name: /admin menu/i })
    await user.click(adminMenuButton)

    const languageToggle = screen.getByLabelText('Language Sync')
    await user.click(languageToggle)

    // Verify Dashboard is in Chinese
    await waitFor(() => {
      expect(screen.getByText('仪表板')).toBeInTheDocument()
    })

    // Navigate through multiple pages using title attributes
    const chatNavButton = screen.getByTitle('对话')
    await user.click(chatNavButton)
    
    await waitFor(() => {
      expect(screen.getByText('对话')).toBeInTheDocument()
    })

    const workflowNavButton = screen.getByTitle('工作流')
    await user.click(workflowNavButton)
    
    await waitFor(() => {
      expect(screen.getByText('工作流设计器')).toBeInTheDocument()
    })

    const agentsNavButton = screen.getByTitle('智能体')
    await user.click(agentsNavButton)
    
    await waitFor(() => {
      expect(screen.getByText('智能体管理')).toBeInTheDocument()
    })

    // All pages should maintain Chinese language
    // Navigate back to Dashboard
    const dashboardNavButton = screen.getByTitle('仪表板')
    await user.click(dashboardNavButton)
    
    await waitFor(() => {
      expect(screen.getByText('仪表板')).toBeInTheDocument()
    })
  })
})