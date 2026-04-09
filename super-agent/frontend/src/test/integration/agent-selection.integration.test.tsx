import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../app-utils'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components'
import { Agents, AgentConfigurator } from '@/pages'

// Test component for agent-related pages
function TestAgentApp() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Agents />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/agents/config/:agentId" element={<AgentConfigurator />} />
      </Routes>
    </AppShell>
  )
}

describe('Agent Selection and Profile Integration Tests', () => {
  it('should display agent list and show profile when agent is selected', async () => {
    const user = userEvent.setup()
    render(<TestAgentApp />, { initialEntries: ['/agents'] })

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('Agent Management')).toBeInTheDocument()
    })

    // Wait for agents to load and be displayed
    await waitFor(() => {
      expect(screen.getByText('HR Assistant')).toBeInTheDocument()
      expect(screen.getByText('IT Support Agent')).toBeInTheDocument()
    })

    // Click on HR Assistant agent
    const hrAgentCard = screen.getByText('HR Assistant').closest('button')
    expect(hrAgentCard).toBeInTheDocument()
    await user.click(hrAgentCard!)

    // Verify agent profile is displayed - use getAllByText for duplicate text
    await waitFor(() => {
      const recruitmentElements = screen.getAllByText('Recruitment Specialist')
      expect(recruitmentElements.length).toBeGreaterThan(0)
      expect(screen.getByText('Recruitment')).toBeInTheDocument()
      expect(screen.getByText('Onboarding')).toBeInTheDocument()
    })

    // Verify metrics are displayed
    expect(screen.getByText('156')).toBeInTheDocument() // Task count
    expect(screen.getByText('98%')).toBeInTheDocument() // Response rate
    expect(screen.getByText('1.2s')).toBeInTheDocument() // Avg response time

    // Click on IT Support agent
    const itAgentCard = screen.getByText('IT Support Agent').closest('button')
    expect(itAgentCard).toBeInTheDocument()
    await user.click(itAgentCard!)

    // Verify IT agent profile is displayed
    await waitFor(() => {
      const technicalSupportElements = screen.getAllByText('Technical Support')
      expect(technicalSupportElements.length).toBeGreaterThan(0)
      expect(screen.getByText('Troubleshooting')).toBeInTheDocument()
      expect(screen.getByText('System Access')).toBeInTheDocument()
    })

    // Verify IT agent metrics
    expect(screen.getByText('234')).toBeInTheDocument() // Task count
    expect(screen.getByText('99%')).toBeInTheDocument() // Response rate
    expect(screen.getByText('0.8s')).toBeInTheDocument() // Avg response time
  })

  it('should navigate to agent configuration from profile', async () => {
    const user = userEvent.setup()
    render(<TestAgentApp />, { initialEntries: ['/agents'] })

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('Agent Management')).toBeInTheDocument()
    })

    // Wait for agents to load
    await waitFor(() => {
      expect(screen.getByText('HR Assistant')).toBeInTheDocument()
    })

    // Click on HR Assistant agent
    const hrAgentCard = screen.getByText('HR Assistant').closest('button')
    await user.click(hrAgentCard!)

    // Wait for profile to load and find the edit button (configure button uses "Edit" text)
    await waitFor(() => {
      const editButton = screen.getByRole('button', { name: /edit/i })
      expect(editButton).toBeInTheDocument()
    })

    // Click on edit button
    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Should navigate to agent configuration page
    await waitFor(() => {
      expect(screen.getByText('Agent Configuration')).toBeInTheDocument()
      expect(screen.getByDisplayValue('HR Assistant')).toBeInTheDocument() // Display name field
    })
  })

  it('should show agent status indicators correctly', async () => {
    render(<TestAgentApp />, { initialEntries: ['/agents'] })

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('Agent Management')).toBeInTheDocument()
    })

    // Wait for agents to load
    await waitFor(() => {
      expect(screen.getByText('HR Assistant')).toBeInTheDocument()
      expect(screen.getByText('IT Support Agent')).toBeInTheDocument()
    })

    // Check that status indicators are present as visual dots (they don't have text)
    // We can verify that the status dots exist by checking for elements with status-related classes
    const statusDots = document.querySelectorAll('[class*="bg-green-500"], [class*="bg-yellow-500"], [class*="bg-blue-500"], [class*="bg-gray-500"]')
    expect(statusDots.length).toBeGreaterThan(0)
  })
})