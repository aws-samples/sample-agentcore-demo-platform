/**
 * GenerationProgress Component Tests
 * 
 * Tests for the GenerationProgress component that displays
 * real-time progress during business scope generation.
 * 
 * Task 4.1: Test step rendering, status updates, error state display,
 * and optional document_analysis step visibility.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GenerationProgress } from '@/components/GenerationProgress'
import type { GenerationStep, GenerationError } from '@/services/useBusinessScopeCreator'

describe('GenerationProgress', () => {
  const defaultProps = {
    currentStep: null as GenerationStep | null,
    completedSteps: [] as GenerationStep[],
    error: null as GenerationError | null,
    businessScopeName: 'Test Business Scope',
    hasDocuments: false,
  }

  describe('Step Rendering', () => {
    it('should render all required steps without documents', () => {
      render(<GenerationProgress {...defaultProps} />)
      
      // Check for required steps (Chinese labels)
      expect(screen.getByText('业务分析')).toBeInTheDocument()
      expect(screen.getByText('角色识别')).toBeInTheDocument()
      expect(screen.getByText('智能体创建')).toBeInTheDocument()
      expect(screen.getByText('文档生成')).toBeInTheDocument()
      expect(screen.getByText('完成')).toBeInTheDocument()
      
      // Document analysis should NOT be visible without documents
      expect(screen.queryByText('文档分析')).not.toBeInTheDocument()
    })

    it('should render document_analysis step when hasDocuments is true', () => {
      render(<GenerationProgress {...defaultProps} hasDocuments={true} />)
      
      // Document analysis should be visible with documents
      expect(screen.getByText('文档分析')).toBeInTheDocument()
    })

    it('should display business scope name in header', () => {
      render(<GenerationProgress {...defaultProps} businessScopeName="逾期资产治理" />)
      
      expect(screen.getByText(/逾期资产治理/)).toBeInTheDocument()
    })
  })

  describe('Status Updates', () => {
    it('should show generating state when currentStep is set', () => {
      render(
        <GenerationProgress 
          {...defaultProps} 
          currentStep="business_analysis"
        />
      )
      
      expect(screen.getByText('正在生成...')).toBeInTheDocument()
    })

    it('should show completed state when finalization is in completedSteps', () => {
      render(
        <GenerationProgress 
          {...defaultProps} 
          completedSteps={['business_analysis', 'role_identification', 'agent_creation', 'document_generation', 'finalization']}
        />
      )
      
      expect(screen.getByText('生成完成')).toBeInTheDocument()
      expect(screen.getByText('生成成功')).toBeInTheDocument()
    })

    it('should display success message when generation completes', () => {
      render(
        <GenerationProgress 
          {...defaultProps} 
          completedSteps={['business_analysis', 'role_identification', 'agent_creation', 'document_generation', 'finalization']}
          businessScopeName="HR Department"
        />
      )
      
      expect(screen.getByText(/HR Department/)).toBeInTheDocument()
      expect(screen.getByText('生成成功')).toBeInTheDocument()
    })
  })

  describe('Error State Display', () => {
    it('should display error message when error is provided', () => {
      const error: GenerationError = {
        step: 'role_identification',
        message: 'Failed to identify roles',
        code: 'ROLE_GENERATION_FAILED',
        retryable: true,
      }

      render(
        <GenerationProgress 
          {...defaultProps} 
          currentStep="role_identification"
          completedSteps={['business_analysis']}
          error={error}
        />
      )
      
      expect(screen.getByText('生成失败')).toBeInTheDocument()
      expect(screen.getByText('Failed to identify roles')).toBeInTheDocument()
    })

    it('should show retry hint for retryable errors', () => {
      const error: GenerationError = {
        step: 'agent_creation',
        message: 'Network error occurred',
        code: 'NETWORK_ERROR',
        retryable: true,
      }

      render(
        <GenerationProgress 
          {...defaultProps} 
          error={error}
        />
      )
      
      expect(screen.getByText(/重试/)).toBeInTheDocument()
    })

    it('should not show retry hint for non-retryable errors', () => {
      const error: GenerationError = {
        step: 'business_analysis',
        message: 'Generation cancelled',
        code: 'CANCELLED',
        retryable: false,
      }

      render(
        <GenerationProgress 
          {...defaultProps} 
          error={error}
        />
      )
      
      expect(screen.getByText('生成失败')).toBeInTheDocument()
      // The retry hint should not appear
      const retryHint = screen.queryByText(/您可以点击"重试"按钮重新开始生成/)
      expect(retryHint).not.toBeInTheDocument()
    })
  })

  describe('Optional Document Analysis Step', () => {
    it('should hide document_analysis step when hasDocuments is false', () => {
      render(
        <GenerationProgress 
          {...defaultProps} 
          hasDocuments={false}
        />
      )
      
      expect(screen.queryByText('文档分析')).not.toBeInTheDocument()
      expect(screen.queryByText('Document Analysis')).not.toBeInTheDocument()
    })

    it('should show document_analysis step when hasDocuments is true', () => {
      render(
        <GenerationProgress 
          {...defaultProps} 
          hasDocuments={true}
        />
      )
      
      expect(screen.getByText('文档分析')).toBeInTheDocument()
      expect(screen.getByText('Document Analysis')).toBeInTheDocument()
    })

    it('should include document_analysis in progress when documents uploaded', () => {
      render(
        <GenerationProgress 
          {...defaultProps} 
          hasDocuments={true}
          currentStep="document_analysis"
          completedSteps={['business_analysis']}
        />
      )
      
      expect(screen.getByText('文档分析')).toBeInTheDocument()
    })
  })
})
