/**
 * AgentPreviewCard Component Tests
 * 
 * Tests for the AgentPreviewCard component that displays
 * a preview of a generated agent with expansion and removal capabilities.
 * 
 * Task 4.2: Test card expansion/collapse, removal toggle,
 * and disabled state for last agent.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentPreviewCard } from '@/components/AgentPreviewCard'
import type { GeneratedAgent } from '@/services/roleGeneratorService'

const createMockAgent = (overrides?: Partial<GeneratedAgent>): GeneratedAgent => ({
  id: 'agent-1',
  name: 'risk-strategist',
  roleId: 'risk-strategist',
  role: '风险策略师',
  avatar: '风',
  description: '负责风险评估、策略制定等核心工作，具备风险建模能力。',
  responsibilities: ['风险评估', '策略制定', '风险监控'],
  capabilities: ['风险建模', '预测分析', '策略优化'],
  systemPromptSummary: '你是一名专业的风险策略师，主要负责风险评估、策略制定、风险监控。',
  tools: ['风险评估工具', '数据分析平台'],
  ...overrides,
})

describe('AgentPreviewCard', () => {
  const defaultProps = {
    agent: createMockAgent(),
    isRemoved: false,
    isLastAgent: false,
    onToggleRemoval: vi.fn(),
    onExpand: vi.fn(),
    isExpanded: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render agent role name', () => {
      render(<AgentPreviewCard {...defaultProps} />)
      expect(screen.getByText('风险策略师')).toBeInTheDocument()
    })

    it('should render agent roleId', () => {
      render(<AgentPreviewCard {...defaultProps} />)
      expect(screen.getByText('risk-strategist')).toBeInTheDocument()
    })

    it('should render agent description', () => {
      render(<AgentPreviewCard {...defaultProps} />)
      expect(screen.getByText(/负责风险评估/)).toBeInTheDocument()
    })

    it('should render agent avatar', () => {
      render(<AgentPreviewCard {...defaultProps} />)
      expect(screen.getByText('风')).toBeInTheDocument()
    })
  })

  describe('Card Expansion/Collapse', () => {
    it('should call onExpand when card is clicked', () => {
      const onExpand = vi.fn()
      render(<AgentPreviewCard {...defaultProps} onExpand={onExpand} />)
      
      // Click on the card content area
      const cardContent = screen.getByText('风险策略师').closest('div[class*="cursor-pointer"]')
      fireEvent.click(cardContent!)
      
      expect(onExpand).toHaveBeenCalledWith('agent-1')
    })

    it('should show expanded content when isExpanded is true', () => {
      render(<AgentPreviewCard {...defaultProps} isExpanded={true} />)
      
      // Check for expanded content
      expect(screen.getByText('核心职责')).toBeInTheDocument()
      expect(screen.getByText('系统提示词摘要')).toBeInTheDocument()
      expect(screen.getByText('建议工具')).toBeInTheDocument()
      expect(screen.getByText('核心能力')).toBeInTheDocument()
    })

    it('should hide expanded content when isExpanded is false', () => {
      render(<AgentPreviewCard {...defaultProps} isExpanded={false} />)
      
      // Expanded content should not be visible
      expect(screen.queryByText('核心职责')).not.toBeInTheDocument()
      expect(screen.queryByText('系统提示词摘要')).not.toBeInTheDocument()
    })

    it('should display responsibilities in expanded view', () => {
      render(<AgentPreviewCard {...defaultProps} isExpanded={true} />)
      
      expect(screen.getByText('风险评估')).toBeInTheDocument()
      expect(screen.getByText('策略制定')).toBeInTheDocument()
      expect(screen.getByText('风险监控')).toBeInTheDocument()
    })

    it('should display tools in expanded view', () => {
      render(<AgentPreviewCard {...defaultProps} isExpanded={true} />)
      
      expect(screen.getByText('风险评估工具')).toBeInTheDocument()
      expect(screen.getByText('数据分析平台')).toBeInTheDocument()
    })

    it('should display capabilities in expanded view', () => {
      render(<AgentPreviewCard {...defaultProps} isExpanded={true} />)
      
      expect(screen.getByText('风险建模')).toBeInTheDocument()
      expect(screen.getByText('预测分析')).toBeInTheDocument()
      expect(screen.getByText('策略优化')).toBeInTheDocument()
    })
  })

  describe('Removal Toggle', () => {
    it('should call onToggleRemoval when remove button is clicked', () => {
      const onToggleRemoval = vi.fn()
      render(<AgentPreviewCard {...defaultProps} onToggleRemoval={onToggleRemoval} />)
      
      // Find and click the remove button (X icon button)
      const removeButton = screen.getByTitle('移除此智能体')
      fireEvent.click(removeButton)
      
      expect(onToggleRemoval).toHaveBeenCalledWith('agent-1')
    })

    it('should show "已移除" badge when isRemoved is true', () => {
      render(<AgentPreviewCard {...defaultProps} isRemoved={true} />)
      
      expect(screen.getByText('已移除')).toBeInTheDocument()
    })

    it('should show restore button when agent is removed', () => {
      render(<AgentPreviewCard {...defaultProps} isRemoved={true} />)
      
      expect(screen.getByTitle('恢复此智能体')).toBeInTheDocument()
    })

    it('should apply dimmed styling when agent is removed', () => {
      const { container } = render(<AgentPreviewCard {...defaultProps} isRemoved={true} />)
      
      // Check for opacity class indicating dimmed state
      const card = container.querySelector('.opacity-60')
      expect(card).toBeInTheDocument()
    })

    it('should apply strikethrough to role name when removed', () => {
      const { container } = render(<AgentPreviewCard {...defaultProps} isRemoved={true} />)
      
      const strikethroughElement = container.querySelector('.line-through')
      expect(strikethroughElement).toBeInTheDocument()
    })
  })

  describe('Disabled State for Last Agent', () => {
    it('should disable remove button when isLastAgent is true and not removed', () => {
      render(<AgentPreviewCard {...defaultProps} isLastAgent={true} isRemoved={false} />)
      
      const removeButton = screen.getByTitle('至少需要保留一个智能体')
      expect(removeButton).toBeDisabled()
    })

    it('should not call onToggleRemoval when clicking disabled remove button', () => {
      const onToggleRemoval = vi.fn()
      render(
        <AgentPreviewCard 
          {...defaultProps} 
          isLastAgent={true} 
          isRemoved={false}
          onToggleRemoval={onToggleRemoval} 
        />
      )
      
      const removeButton = screen.getByTitle('至少需要保留一个智能体')
      fireEvent.click(removeButton)
      
      expect(onToggleRemoval).not.toHaveBeenCalled()
    })

    it('should show tooltip hint for disabled state', () => {
      render(<AgentPreviewCard {...defaultProps} isLastAgent={true} isRemoved={false} />)
      
      // The tooltip text should be present in the DOM
      expect(screen.getByText('至少需要保留一个智能体')).toBeInTheDocument()
    })

    it('should allow restore when agent is removed even if it was last', () => {
      render(<AgentPreviewCard {...defaultProps} isLastAgent={true} isRemoved={true} />)
      
      // Restore button should be enabled
      const restoreButton = screen.getByTitle('恢复此智能体')
      expect(restoreButton).not.toBeDisabled()
    })
  })

  describe('Internal Expansion State', () => {
    it('should toggle internal expansion when onExpand is not provided', () => {
      render(
        <AgentPreviewCard 
          {...defaultProps} 
          onExpand={undefined}
          isExpanded={undefined}
        />
      )
      
      // Initially collapsed
      expect(screen.queryByText('核心职责')).not.toBeInTheDocument()
      
      // Click to expand
      const cardContent = screen.getByText('风险策略师').closest('div[class*="cursor-pointer"]')
      fireEvent.click(cardContent!)
      
      // Should now be expanded
      expect(screen.getByText('核心职责')).toBeInTheDocument()
    })
  })
})
