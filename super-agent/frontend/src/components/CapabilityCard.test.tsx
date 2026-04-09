import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CapabilityCard } from './CapabilityCard'
import type { Capability } from '@/types'

const mockCapability: Capability = {
  id: 'cap-1',
  category: 'Video Intelligence',
  name: 'Video Analysis',
  description: 'Analyze video content for objects, scenes, and activities',
  toolIdentifier: 'video.analysis.v1',
  icon: '🎬',
  color: '#FF6B6B',
}

describe('CapabilityCard', () => {
  it('should render capability name', () => {
    render(<CapabilityCard capability={mockCapability} />)
    expect(screen.getByText('Video Analysis')).toBeInTheDocument()
  })

  it('should render capability description', () => {
    render(<CapabilityCard capability={mockCapability} />)
    expect(screen.getByText('Analyze video content for objects, scenes, and activities')).toBeInTheDocument()
  })

  it('should render capability category', () => {
    render(<CapabilityCard capability={mockCapability} />)
    expect(screen.getByText('Video Intelligence')).toBeInTheDocument()
  })

  it('should render tool identifier', () => {
    render(<CapabilityCard capability={mockCapability} />)
    expect(screen.getByText('video.analysis.v1')).toBeInTheDocument()
  })

  it('should render icon', () => {
    render(<CapabilityCard capability={mockCapability} />)
    expect(screen.getByText('🎬')).toBeInTheDocument()
  })

  it('should display Tool ID label', () => {
    render(<CapabilityCard capability={mockCapability} />)
    expect(screen.getByText('Tool ID')).toBeInTheDocument()
  })

  it('should have correct styling classes', () => {
    const { container } = render(<CapabilityCard capability={mockCapability} />)
    const card = container.querySelector('.bg-gray-800\\/50')
    expect(card).toBeInTheDocument()
  })

  it('should render with different capability data', () => {
    const differentCapability: Capability = {
      id: 'cap-2',
      category: 'Communication',
      name: 'Email Sending',
      description: 'Send emails with templates',
      toolIdentifier: 'email.send.v1',
      icon: '📧',
      color: '#95E1D3',
    }

    render(<CapabilityCard capability={differentCapability} />)
    expect(screen.getByText('Email Sending')).toBeInTheDocument()
    expect(screen.getByText('Communication')).toBeInTheDocument()
    expect(screen.getByText('email.send.v1')).toBeInTheDocument()
  })

  it('should handle long descriptions with line clamping', () => {
    const longCapability: Capability = {
      ...mockCapability,
      description: 'This is a very long description that should be clamped to two lines to maintain the card layout and visual consistency across the grid',
    }

    const { container } = render(<CapabilityCard capability={longCapability} />)
    const descriptionElement = container.querySelector('.line-clamp-2')
    expect(descriptionElement).toBeInTheDocument()
  })

  it('should render all required sections', () => {
    const { container } = render(<CapabilityCard capability={mockCapability} />)
    
    // Check for icon section
    expect(container.querySelector('.w-10.h-10')).toBeInTheDocument()
    
    // Check for border separator
    expect(container.querySelector('.border-t')).toBeInTheDocument()
  })
})
