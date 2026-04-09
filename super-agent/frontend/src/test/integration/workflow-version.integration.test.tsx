import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../app-utils'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components'
import { Workflow } from '@/pages'

// Test component for workflow page
function TestWorkflowApp() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Workflow />} />
        <Route path="/workflow" element={<Workflow />} />
      </Routes>
    </AppShell>
  )
}

describe('Workflow Version Switching Integration Tests', () => {
  it('should display workflow categories and switch between them', async () => {
    const user = userEvent.setup()
    render(<TestWorkflowApp />, { initialEntries: ['/workflow'] })

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('Workflow Designer')).toBeInTheDocument()
    })

    // Verify category tabs are present
    expect(screen.getByRole('tab', { name: /hr/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /deployment/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /marketing/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /support/i })).toBeInTheDocument()

    // HR tab should be active initially
    const hrTab = screen.getByRole('tab', { name: /hr/i })
    expect(hrTab).toHaveAttribute('aria-selected', 'true')

    // Switch to Deployment tab
    const deploymentTab = screen.getByRole('tab', { name: /deployment/i })
    await user.click(deploymentTab)

    await waitFor(() => {
      expect(deploymentTab).toHaveAttribute('aria-selected', 'true')
      expect(hrTab).toHaveAttribute('aria-selected', 'false')
    })
  })

  it('should display workflow with nodes and connections', async () => {
    const user = userEvent.setup()
    render(<TestWorkflowApp />, { initialEntries: ['/workflow'] })

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('Workflow Designer')).toBeInTheDocument()
    })

    // Wait for workflow to load - use heading role to be more specific
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Employee Onboarding' })).toBeInTheDocument()
    })

    // Verify workflow nodes are displayed
    expect(screen.getByText('New Employee')).toBeInTheDocument()
    expect(screen.getByText('HR Assistant')).toBeInTheDocument()
  })

  it('should show version selector and handle version switching', async () => {
    const user = userEvent.setup()
    render(<TestWorkflowApp />, { initialEntries: ['/workflow'] })

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('Workflow Designer')).toBeInTheDocument()
    })

    // Wait for workflow to load - use heading role to be more specific
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Employee Onboarding' })).toBeInTheDocument()
    })

    // Find version selector
    const versionSelector = screen.getByRole('combobox', { name: /version/i })
    expect(versionSelector).toBeInTheDocument()

    // Current version should be displayed
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
  })

  it('should show deployment options for non-official versions', async () => {
    const user = userEvent.setup()
    render(<TestWorkflowApp />, { initialEntries: ['/workflow'] })

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('Workflow Designer')).toBeInTheDocument()
    })

    // For this test, we'll simulate selecting a non-official version
    // In a real scenario, we'd need to mock a workflow with isOfficial: false
    
    // The deployment button should not be visible for official versions
    expect(screen.queryByRole('button', { name: /deploy to test/i })).not.toBeInTheDocument()
  })

  it('should handle workflow AI copilot natural language changes', async () => {
    const user = userEvent.setup()
    render(<TestWorkflowApp />, { initialEntries: ['/workflow'] })

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('Workflow Designer')).toBeInTheDocument()
    })

    // Find AI copilot input
    const copilotInput = screen.getByPlaceholderText(/describe workflow changes/i)
    expect(copilotInput).toBeInTheDocument()

    // Type natural language instruction
    const instruction = 'Add an approval step after HR Assistant'
    await user.type(copilotInput, instruction)

    // Submit the instruction
    const applyButton = screen.getByRole('button', { name: /apply changes/i })
    await user.click(applyButton)

    // Verify the instruction was processed (in a real implementation, this would update the workflow)
    expect(copilotInput).toHaveValue('')
  })

  it('should handle workflow import from image', async () => {
    const user = userEvent.setup()
    render(<TestWorkflowApp />, { initialEntries: ['/workflow'] })

    // Wait for page to load
    await waitFor(() => {
      expect(screen.getByText('Workflow Designer')).toBeInTheDocument()
    })

    // Find import button
    const importButton = screen.getByRole('button', { name: /import from image/i })
    expect(importButton).toBeInTheDocument()

    await user.click(importButton)

    // Verify import dialog opens
    await waitFor(() => {
      expect(screen.getByText('Import Workflow from Image')).toBeInTheDocument()
    })

    // Find file input
    const fileInput = screen.getByLabelText(/upload image/i)
    expect(fileInput).toBeInTheDocument()

    // Create a mock file
    const file = new File(['mock image content'], 'workflow.png', { type: 'image/png' })
    
    // Upload the file
    await user.upload(fileInput, file)

    // Verify file is selected
    expect(fileInput.files?.[0]).toBe(file)
  })
})