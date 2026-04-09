import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentCell } from './AgentCell'
import type { AgentSummary } from '@/types'

const mockAgent: AgentSummary = {
  id: 'agent-1',
  name: 'HR Assistant',
  role: 'Recruitment Specialist',
  avatar: 'H',
}

describe('AgentCell', () => {
  it('should render agent name', () => {
    render(<AgentCell agent={mockAgent} />)
    
    expect(screen.getByText('HR Assistant')).toBeInTheDocument()
  })

  it('should render agent role', () => {
    render(<AgentCell agent={mockAgent} />)
    
    expect(screen.getByText('Recruitment Specialist')).toBeInTheDocument()
  })

  it('should render avatar with first letter of name', () => {
    render(<AgentCell agent={mockAgent} />)
    
    const avatar = screen.getByText('H')
    expect(avatar).toBeInTheDocument()
  })

  it('should use provided avatar when available', () => {
    const agentWithAvatar: AgentSummary = {
      ...mockAgent,
      avatar: 'X',
    }
    
    render(<AgentCell agent={agentWithAvatar} />)
    
    expect(screen.getByText('X')).toBeInTheDocument()
  })

  it('should use first letter of name when avatar is empty', () => {
    const agentWithoutAvatar: AgentSummary = {
      ...mockAgent,
      avatar: '',
    }
    
    render(<AgentCell agent={agentWithoutAvatar} />)
    
    expect(screen.getByText('H')).toBeInTheDocument()
  })

  it('should have proper styling classes', () => {
    const { container } = render(<AgentCell agent={mockAgent} />)
    
    const wrapper = container.querySelector('[class*="flex"]')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper).toHaveClass('flex', 'items-center', 'gap-3')
  })

  it('should render avatar with gradient background', () => {
    const { container } = render(<AgentCell agent={mockAgent} />)
    
    const avatar = container.querySelector('[class*="bg-gradient"]')
    expect(avatar).toBeInTheDocument()
  })

  it('should truncate long names', () => {
    const longNameAgent: AgentSummary = {
      ...mockAgent,
      name: 'This is a very long agent name that should be truncated',
    }
    
    const { container } = render(<AgentCell agent={longNameAgent} />)
    
    const nameElement = container.querySelector('[class*="truncate"]')
    expect(nameElement).toBeInTheDocument()
  })

  it('should display agent information in correct order', () => {
    const { container } = render(<AgentCell agent={mockAgent} />)
    
    const elements = container.querySelectorAll('p')
    expect(elements[0]).toHaveTextContent('HR Assistant')
    expect(elements[1]).toHaveTextContent('Recruitment Specialist')
  })

  it('should handle agents with special characters in name', () => {
    const specialAgent: AgentSummary = {
      ...mockAgent,
      name: 'Agent & Co. <Special>',
    }
    
    render(<AgentCell agent={specialAgent} />)
    
    expect(screen.getByText(/Agent & Co/)).toBeInTheDocument()
  })

  it('should have proper text color styling', () => {
    const { container } = render(<AgentCell agent={mockAgent} />)
    
    const nameElement = container.querySelector('[class*="text-white"]')
    expect(nameElement).toBeInTheDocument()
  })
})
