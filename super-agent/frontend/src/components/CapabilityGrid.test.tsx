import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CapabilityGrid } from './CapabilityGrid'
import type { Capability } from '@/types'

// Mock the translation hook
vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// Mock CapabilityCard component
vi.mock('./CapabilityCard', () => ({
  CapabilityCard: ({ capability }: { capability: Capability }) => (
    <div data-testid={`capability-${capability.id}`}>{capability.name}</div>
  ),
}))

const mockCapabilities: Capability[] = [
  {
    id: 'cap-1',
    category: 'Video Intelligence',
    name: 'Video Analysis',
    description: 'Analyze video content',
    toolIdentifier: 'video.analysis.v1',
    icon: '🎬',
    color: '#FF6B6B',
  },
  {
    id: 'cap-2',
    category: 'Video Intelligence',
    name: 'Face Recognition',
    description: 'Detect faces in video',
    toolIdentifier: 'video.face.v1',
    icon: '👤',
    color: '#FF6B6B',
  },
  {
    id: 'cap-3',
    category: 'Knowledge & Data',
    name: 'Document Retrieval',
    description: 'Retrieve documents',
    toolIdentifier: 'knowledge.retrieval.v1',
    icon: '📚',
    color: '#4ECDC4',
  },
  {
    id: 'cap-4',
    category: 'Communication',
    name: 'Email Sending',
    description: 'Send emails',
    toolIdentifier: 'email.send.v1',
    icon: '📧',
    color: '#95E1D3',
  },
]

describe('CapabilityGrid', () => {
  it('should render all capabilities', () => {
    render(<CapabilityGrid capabilities={mockCapabilities} searchQuery="" />)

    mockCapabilities.forEach((cap) => {
      expect(screen.getByTestId(`capability-${cap.id}`)).toBeInTheDocument()
    })
  })

  it('should group capabilities by category', () => {
    render(<CapabilityGrid capabilities={mockCapabilities} searchQuery="" />)

    expect(screen.getByText('Video Intelligence')).toBeInTheDocument()
    expect(screen.getByText('Knowledge & Data')).toBeInTheDocument()
    expect(screen.getByText('Communication')).toBeInTheDocument()
  })

  it('should filter capabilities by name', () => {
    render(<CapabilityGrid capabilities={mockCapabilities} searchQuery="Video" />)

    expect(screen.getByTestId('capability-cap-1')).toBeInTheDocument()
    expect(screen.getByTestId('capability-cap-2')).toBeInTheDocument()
    expect(screen.queryByTestId('capability-cap-3')).not.toBeInTheDocument()
  })

  it('should filter capabilities by description', () => {
    render(<CapabilityGrid capabilities={mockCapabilities} searchQuery="Retrieve" />)

    expect(screen.getByTestId('capability-cap-3')).toBeInTheDocument()
    expect(screen.queryByTestId('capability-cap-1')).not.toBeInTheDocument()
  })

  it('should filter capabilities by tool identifier', () => {
    render(<CapabilityGrid capabilities={mockCapabilities} searchQuery="email.send" />)

    expect(screen.getByTestId('capability-cap-4')).toBeInTheDocument()
    expect(screen.queryByTestId('capability-cap-1')).not.toBeInTheDocument()
  })

  it('should be case-insensitive when filtering', () => {
    render(<CapabilityGrid capabilities={mockCapabilities} searchQuery="VIDEO" />)

    expect(screen.getByTestId('capability-cap-1')).toBeInTheDocument()
    expect(screen.getByTestId('capability-cap-2')).toBeInTheDocument()
  })

  it('should show empty state when no results match search', () => {
    render(<CapabilityGrid capabilities={mockCapabilities} searchQuery="nonexistent" />)

    expect(screen.getByText('common.search')).toBeInTheDocument()
    expect(screen.getByText('No capabilities match your search')).toBeInTheDocument()
  })

  it('should show empty state message when no capabilities provided', () => {
    render(<CapabilityGrid capabilities={[]} searchQuery="" />)

    expect(screen.getByText('No capabilities available')).toBeInTheDocument()
  })

  it('should maintain category order', () => {
    const { container } = render(<CapabilityGrid capabilities={mockCapabilities} searchQuery="" />)

    const categoryHeaders = container.querySelectorAll('h2')
    const categories = Array.from(categoryHeaders).map((h) => h.textContent)

    // Video Intelligence should come before Knowledge & Data
    const videoIndex = categories.indexOf('Video Intelligence')
    const knowledgeIndex = categories.indexOf('Knowledge & Data')
    expect(videoIndex).toBeLessThan(knowledgeIndex)
  })

  it('should render category underline decoration', () => {
    const { container } = render(<CapabilityGrid capabilities={mockCapabilities} searchQuery="" />)

    const underlines = container.querySelectorAll('.bg-gradient-to-r')
    expect(underlines.length).toBeGreaterThan(0)
  })

  it('should handle partial search matches', () => {
    render(<CapabilityGrid capabilities={mockCapabilities} searchQuery="ana" />)

    // Should match "Video Analysis"
    expect(screen.getByTestId('capability-cap-1')).toBeInTheDocument()
  })

  it('should filter across all searchable fields', () => {
    render(<CapabilityGrid capabilities={mockCapabilities} searchQuery="v1" />)

    // Should match multiple capabilities with v1 in tool identifier
    expect(screen.getByTestId('capability-cap-1')).toBeInTheDocument()
    expect(screen.getByTestId('capability-cap-2')).toBeInTheDocument()
    expect(screen.getByTestId('capability-cap-3')).toBeInTheDocument()
  })
})
