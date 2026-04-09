import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../app-utils'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components'
import { Dashboard, Chat, Workflow, Agents, Tools, MCPConfigurator } from '@/pages'

// Test component that mimics App structure without BrowserRouter
function TestApp() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/workflow" element={<Workflow />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/config/mcp" element={<MCPConfigurator />} />
      </Routes>
    </AppShell>
  )
}

describe('Navigation Integration Tests', () => {
  it('should navigate between pages using sidebar navigation', async () => {
    const user = userEvent.setup()
    render(<TestApp />)

    // Should start on Dashboard
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    
    // Navigate to Chat
    const chatNavButton = screen.getByRole('button', { name: /chat/i })
    await user.click(chatNavButton)
    
    await waitFor(() => {
      expect(screen.getByText('Chat')).toBeInTheDocument()
    })

    // Navigate to Workflow
    const workflowNavButton = screen.getByRole('button', { name: /workflow/i })
    await user.click(workflowNavButton)
    
    await waitFor(() => {
      expect(screen.getByText('Workflow Designer')).toBeInTheDocument()
    })

    // Navigate to Agents
    const agentsNavButton = screen.getByRole('button', { name: /agents/i })
    await user.click(agentsNavButton)
    
    await waitFor(() => {
      expect(screen.getByText('Agent Management')).toBeInTheDocument()
    })

    // Navigate to Tools
    const toolsNavButton = screen.getByRole('button', { name: /tools/i })
    await user.click(toolsNavButton)
    
    await waitFor(() => {
      expect(screen.getByText('App Management')).toBeInTheDocument()
    })

    // Navigate back to Dashboard
    const dashboardNavButton = screen.getByRole('button', { name: /dashboard/i })
    await user.click(dashboardNavButton)
    
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })

  it('should show active page indicator in sidebar', async () => {
    const user = userEvent.setup()
    render(<TestApp />)

    // Dashboard should be active initially
    const dashboardButton = screen.getByRole('button', { name: /dashboard/i })
    expect(dashboardButton).toHaveClass('bg-blue-600') // Active state class

    // Navigate to Chat and check active state
    const chatButton = screen.getByRole('button', { name: /chat/i })
    await user.click(chatButton)
    
    await waitFor(() => {
      expect(chatButton).toHaveClass('bg-blue-600')
      expect(dashboardButton).not.toHaveClass('bg-blue-600')
    })
  })

  it('should navigate to admin configuration pages', async () => {
    const user = userEvent.setup()
    render(<TestApp />)

    // Click on admin menu (user avatar)
    const adminMenuButton = screen.getByRole('button', { name: /admin menu/i })
    await user.click(adminMenuButton)

    // Navigate to MCP Configuration (it's a button, not a link)
    const mcpConfigButton = screen.getByRole('button', { name: /mcp configuration/i })
    await user.click(mcpConfigButton)
    
    await waitFor(() => {
      expect(screen.getByText('MCP Server Configuration')).toBeInTheDocument()
    })
  })
})