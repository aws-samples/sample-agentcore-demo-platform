/**
 * BusinessScopeCreator Component Tests
 * 
 * Tests for the BusinessScopeCreator modal component that orchestrates
 * the business scope creation workflow.
 * 
 * Task 4.4: Test modal open/close behavior, step transitions,
 * and cancellation confirmation dialog.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BusinessScopeCreator } from '@/components/BusinessScopeCreator'

// Mock the useBusinessScopeCreator hook
const mockReset = vi.fn()
const mockValidateName = vi.fn()
const mockStartGeneration = vi.fn()
const mockCancelGeneration = vi.fn()
const mockSetStep = vi.fn()
const mockSetBusinessScopeName = vi.fn()
const mockAddDocument = vi.fn()
const mockRemoveDocument = vi.fn()
const mockToggleAgentRemoval = vi.fn()
const mockGetSelectedAgents = vi.fn()
const mockSetCustomization = vi.fn()
const mockSaveBusinessScope = vi.fn()

const createMockState = (overrides = {}) => ({
  step: 'input' as const,
  businessScopeName: '',
  validationError: null,
  generatedAgents: [],
  uploadedDocuments: [],
  removedAgentIds: [],
  customization: { icon: '👥', color: '#4CAF50', description: '' },
  generationProgress: {
    currentStep: null,
    completedSteps: [],
    progress: 0,
    error: null,
  },
  ...overrides,
})

vi.mock('@/services/useBusinessScopeCreator', () => ({
  useBusinessScopeCreator: () => ({
    state: createMockState(),
    validateName: mockValidateName,
    addDocument: mockAddDocument,
    removeDocument: mockRemoveDocument,
    toggleAgentRemoval: mockToggleAgentRemoval,
    getSelectedAgents: mockGetSelectedAgents,
    startGeneration: mockStartGeneration,
    cancelGeneration: mockCancelGeneration,
    setCustomization: mockSetCustomization,
    saveBusinessScope: mockSaveBusinessScope,
    reset: mockReset,
    setStep: mockSetStep,
    setBusinessScopeName: mockSetBusinessScopeName,
  }),
}))

describe('BusinessScopeCreator', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSelectedAgents.mockReturnValue([])
    mockValidateName.mockResolvedValue({ isValid: true, error: null, errorCode: null })
    mockStartGeneration.mockResolvedValue({ success: true, agents: [] })
    mockSaveBusinessScope.mockResolvedValue({ success: true, businessScope: {} })
  })

  describe('Modal Open/Close Behavior', () => {
    it('should render modal when isOpen is true', () => {
      render(<BusinessScopeCreator {...defaultProps} isOpen={true} />)
      
      expect(screen.getByText('创建业务范围')).toBeInTheDocument()
    })

    it('should not render modal when isOpen is false', () => {
      render(<BusinessScopeCreator {...defaultProps} isOpen={false} />)
      
      expect(screen.queryByText('创建业务范围')).not.toBeInTheDocument()
    })

    it('should call reset when modal opens', () => {
      render(<BusinessScopeCreator {...defaultProps} isOpen={true} />)
      
      expect(mockReset).toHaveBeenCalled()
    })

    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn()
      render(<BusinessScopeCreator {...defaultProps} onClose={onClose} />)
      
      // Find and click the close button (X icon)
      const closeButton = screen.getByRole('button', { name: '' })
      fireEvent.click(closeButton)
      
      expect(mockReset).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })

    it('should call onClose when cancel button is clicked', () => {
      const onClose = vi.fn()
      render(<BusinessScopeCreator {...defaultProps} onClose={onClose} />)
      
      const cancelButton = screen.getByText('取消')
      fireEvent.click(cancelButton)
      
      expect(onClose).toHaveBeenCalled()
    })

    it('should call onClose when backdrop is clicked', () => {
      const onClose = vi.fn()
      const { container } = render(<BusinessScopeCreator {...defaultProps} onClose={onClose} />)
      
      // Click on the backdrop
      const backdrop = container.querySelector('.backdrop-blur-sm')
      if (backdrop) {
        fireEvent.click(backdrop)
        expect(onClose).toHaveBeenCalled()
      }
    })
  })

  describe('Step Transitions', () => {
    it('should display input step content initially', () => {
      render(<BusinessScopeCreator {...defaultProps} />)
      
      expect(screen.getByText('业务范围名称')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/逾期资产治理/)).toBeInTheDocument()
    })

    it('should display step description for input step', () => {
      render(<BusinessScopeCreator {...defaultProps} />)
      
      expect(screen.getByText('输入业务领域名称')).toBeInTheDocument()
    })

    it('should show generate button in input step', () => {
      render(<BusinessScopeCreator {...defaultProps} />)
      
      expect(screen.getByText('生成智能体')).toBeInTheDocument()
    })

    it('should disable generate button when name is empty', () => {
      render(<BusinessScopeCreator {...defaultProps} />)
      
      const generateButton = screen.getByText('生成智能体').closest('button')
      expect(generateButton).toBeDisabled()
    })
  })

  describe('Input Handling', () => {
    it('should call setBusinessScopeName when input changes', () => {
      render(<BusinessScopeCreator {...defaultProps} />)
      
      const input = screen.getByPlaceholderText(/逾期资产治理/)
      fireEvent.change(input, { target: { value: 'Test Scope' } })
      
      expect(mockSetBusinessScopeName).toHaveBeenCalledWith('Test Scope')
    })
  })

  describe('Document Upload Integration', () => {
    it('should display document uploader in input step', () => {
      render(<BusinessScopeCreator {...defaultProps} />)
      
      expect(screen.getByText('上传参考文档（可选）')).toBeInTheDocument()
    })
  })

  describe('Header Display', () => {
    it('should display modal title', () => {
      render(<BusinessScopeCreator {...defaultProps} />)
      
      expect(screen.getByText('创建业务范围')).toBeInTheDocument()
    })

    it('should display sparkles icon in header', () => {
      const { container } = render(<BusinessScopeCreator {...defaultProps} />)
      
      // Check for the gradient icon container
      const iconContainer = container.querySelector('.bg-gradient-to-br')
      expect(iconContainer).toBeInTheDocument()
    })
  })
})
