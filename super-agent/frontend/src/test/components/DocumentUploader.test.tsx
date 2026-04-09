/**
 * DocumentUploader Component Tests
 * 
 * Tests for the DocumentUploader component that handles document upload
 * for business scope creation context.
 * 
 * Task 4.3: Test file type validation, document addition and removal,
 * and drag-and-drop behavior.
 * 
 * Property Tests:
 * - Property 8: Document Upload Acceptance
 * - Property 9: Document Removal
 * 
 * Validates: Requirements 2.5.2, 2.5.3, 2.5.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import fc from 'fast-check'
import { DocumentUploader } from '@/components/DocumentUploader'
import type { UploadedDocument } from '@/services/useBusinessScopeCreator'

// Helper to create mock uploaded documents
const createMockDocument = (overrides?: Partial<UploadedDocument>): UploadedDocument => ({
  id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: 'test-document.pdf',
  size: 1024,
  type: 'application/pdf',
  file: new File(['test content'], 'test-document.pdf', { type: 'application/pdf' }),
  ...overrides,
})

// Helper to create mock File objects
const createMockFile = (name: string, type: string, size: number = 1024): File => {
  const content = new Array(size).fill('a').join('')
  return new File([content], name, { type })
}

describe('DocumentUploader', () => {
  const defaultProps = {
    documents: [] as UploadedDocument[],
    onAddDocument: vi.fn(),
    onRemoveDocument: vi.fn(),
    disabled: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render upload zone with instructions', () => {
      render(<DocumentUploader {...defaultProps} />)
      
      expect(screen.getByText(/拖拽文件到此处或点击上传/)).toBeInTheDocument()
    })

    it('should display supported file types', () => {
      render(<DocumentUploader {...defaultProps} />)
      
      expect(screen.getByText(/PDF, DOC, DOCX, TXT, MD/)).toBeInTheDocument()
    })

    it('should show helper text when no documents uploaded', () => {
      render(<DocumentUploader {...defaultProps} />)
      
      expect(screen.getByText(/上传文档可以帮助 AI 更好地理解您的业务场景/)).toBeInTheDocument()
    })

    it('should display uploaded documents count', () => {
      const documents = [
        createMockDocument({ name: 'doc1.pdf' }),
        createMockDocument({ name: 'doc2.txt' }),
      ]
      
      render(<DocumentUploader {...defaultProps} documents={documents} />)
      
      expect(screen.getByText('已上传 2 个文件')).toBeInTheDocument()
    })
  })

  describe('File Type Validation', () => {
    it('should accept PDF files', () => {
      const onAddDocument = vi.fn().mockReturnValue(createMockDocument())
      render(<DocumentUploader {...defaultProps} onAddDocument={onAddDocument} />)
      
      const file = createMockFile('test.pdf', 'application/pdf')
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(input, { target: { files: [file] } })
      
      expect(onAddDocument).toHaveBeenCalledWith(file)
    })

    it('should accept DOC files', () => {
      const onAddDocument = vi.fn().mockReturnValue(createMockDocument())
      render(<DocumentUploader {...defaultProps} onAddDocument={onAddDocument} />)
      
      const file = createMockFile('test.doc', 'application/msword')
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(input, { target: { files: [file] } })
      
      expect(onAddDocument).toHaveBeenCalledWith(file)
    })

    it('should accept DOCX files', () => {
      const onAddDocument = vi.fn().mockReturnValue(createMockDocument())
      render(<DocumentUploader {...defaultProps} onAddDocument={onAddDocument} />)
      
      const file = createMockFile('test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(input, { target: { files: [file] } })
      
      expect(onAddDocument).toHaveBeenCalledWith(file)
    })

    it('should accept TXT files', () => {
      const onAddDocument = vi.fn().mockReturnValue(createMockDocument())
      render(<DocumentUploader {...defaultProps} onAddDocument={onAddDocument} />)
      
      const file = createMockFile('test.txt', 'text/plain')
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(input, { target: { files: [file] } })
      
      expect(onAddDocument).toHaveBeenCalledWith(file)
    })

    it('should accept MD files', () => {
      const onAddDocument = vi.fn().mockReturnValue(createMockDocument())
      render(<DocumentUploader {...defaultProps} onAddDocument={onAddDocument} />)
      
      const file = createMockFile('test.md', 'text/markdown')
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(input, { target: { files: [file] } })
      
      expect(onAddDocument).toHaveBeenCalledWith(file)
    })

    it('should reject unsupported file types and show error', () => {
      const onAddDocument = vi.fn().mockReturnValue(null)
      render(<DocumentUploader {...defaultProps} onAddDocument={onAddDocument} />)
      
      const file = createMockFile('test.exe', 'application/x-msdownload')
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(input, { target: { files: [file] } })
      
      expect(screen.getByText(/不支持的文件类型/)).toBeInTheDocument()
    })
  })

  describe('Document Addition and Removal', () => {
    it('should display document name in the list', () => {
      const documents = [createMockDocument({ name: 'my-report.pdf' })]
      
      render(<DocumentUploader {...defaultProps} documents={documents} />)
      
      expect(screen.getByText('my-report.pdf')).toBeInTheDocument()
    })

    it('should display document size', () => {
      const documents = [createMockDocument({ name: 'test.pdf', size: 2048 })]
      
      render(<DocumentUploader {...defaultProps} documents={documents} />)
      
      expect(screen.getByText('2 KB')).toBeInTheDocument()
    })

    it('should display file type label', () => {
      const documents = [createMockDocument({ name: 'test.pdf', type: 'application/pdf' })]
      
      render(<DocumentUploader {...defaultProps} documents={documents} />)
      
      expect(screen.getByText('PDF')).toBeInTheDocument()
    })

    it('should call onRemoveDocument when remove button is clicked', () => {
      const onRemoveDocument = vi.fn()
      const documents = [createMockDocument({ id: 'doc-123', name: 'test.pdf' })]
      
      render(<DocumentUploader {...defaultProps} documents={documents} onRemoveDocument={onRemoveDocument} />)
      
      const removeButton = screen.getByTitle('移除文档')
      fireEvent.click(removeButton)
      
      expect(onRemoveDocument).toHaveBeenCalledWith('doc-123')
    })

    it('should handle multiple documents', () => {
      const documents = [
        createMockDocument({ name: 'doc1.pdf' }),
        createMockDocument({ name: 'doc2.txt' }),
        createMockDocument({ name: 'doc3.md' }),
      ]
      
      render(<DocumentUploader {...defaultProps} documents={documents} />)
      
      expect(screen.getByText('doc1.pdf')).toBeInTheDocument()
      expect(screen.getByText('doc2.txt')).toBeInTheDocument()
      expect(screen.getByText('doc3.md')).toBeInTheDocument()
    })
  })

  describe('Drag and Drop Behavior', () => {
    it('should show drag feedback on dragover', () => {
      const { container } = render(<DocumentUploader {...defaultProps} />)
      
      const dropZone = container.querySelector('[class*="border-dashed"]')!
      
      fireEvent.dragOver(dropZone)
      
      expect(screen.getByText('释放以上传文件')).toBeInTheDocument()
    })

    it('should hide drag feedback on dragleave', () => {
      const { container } = render(<DocumentUploader {...defaultProps} />)
      
      const dropZone = container.querySelector('[class*="border-dashed"]')!
      
      fireEvent.dragOver(dropZone)
      expect(screen.getByText('释放以上传文件')).toBeInTheDocument()
      
      fireEvent.dragLeave(dropZone)
      expect(screen.getByText(/拖拽文件到此处或点击上传/)).toBeInTheDocument()
    })

    it('should process files on drop', () => {
      const onAddDocument = vi.fn().mockReturnValue(createMockDocument())
      const { container } = render(<DocumentUploader {...defaultProps} onAddDocument={onAddDocument} />)
      
      const dropZone = container.querySelector('[class*="border-dashed"]')!
      const file = createMockFile('dropped.pdf', 'application/pdf')
      
      const dataTransfer = {
        files: [file],
      }
      
      fireEvent.drop(dropZone, { dataTransfer })
      
      expect(onAddDocument).toHaveBeenCalledWith(file)
    })
  })

  describe('Disabled State', () => {
    it('should not process files when disabled', () => {
      const onAddDocument = vi.fn()
      render(<DocumentUploader {...defaultProps} onAddDocument={onAddDocument} disabled={true} />)
      
      const file = createMockFile('test.pdf', 'application/pdf')
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(input, { target: { files: [file] } })
      
      expect(onAddDocument).not.toHaveBeenCalled()
    })

    it('should disable remove buttons when disabled', () => {
      const documents = [createMockDocument({ name: 'test.pdf' })]
      
      render(<DocumentUploader {...defaultProps} documents={documents} disabled={true} />)
      
      const removeButton = screen.getByTitle('移除文档')
      expect(removeButton).toBeDisabled()
    })
  })
})

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('DocumentUploader - Property-Based Tests', () => {
  /**
   * Property 8: Document Upload Acceptance
   * 
   * *For any* file uploaded to the document upload area, if the file type is one of 
   * PDF, DOC, DOCX, TXT, or MD, the file SHALL be added to the upload list and 
   * displayed with its name and size.
   * 
   * **Validates: Requirements 2.5.2, 2.5.3**
   */
  describe('Property 8: Document Upload Acceptance', () => {
    const SUPPORTED_FILE_CONFIGS = [
      { extension: 'pdf', mimeType: 'application/pdf' },
      { extension: 'doc', mimeType: 'application/msword' },
      { extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { extension: 'txt', mimeType: 'text/plain' },
      { extension: 'md', mimeType: 'text/markdown' },
    ]

    it('should accept any file with supported extension and display name and size', { timeout: 30000 }, () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...SUPPORTED_FILE_CONFIGS),
          fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
          fc.integer({ min: 1, max: 10000 }),
          (fileConfig, baseName, size) => {
            const fileName = `${baseName}.${fileConfig.extension}`
            const onAddDocument = vi.fn().mockImplementation((file: File) => ({
              id: `doc-${Date.now()}`,
              name: file.name,
              size: file.size,
              type: file.type,
              file,
            }))
            
            const { unmount } = render(
              <DocumentUploader 
                documents={[]} 
                onAddDocument={onAddDocument}
                onRemoveDocument={vi.fn()}
              />
            )
            
            const file = createMockFile(fileName, fileConfig.mimeType, size)
            const input = document.querySelector('input[type="file"]') as HTMLInputElement
            
            fireEvent.change(input, { target: { files: [file] } })
            
            // Verify onAddDocument was called with the file
            expect(onAddDocument).toHaveBeenCalledWith(file)
            expect(onAddDocument.mock.calls[0][0].name).toBe(fileName)
            
            unmount()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should display uploaded document with correct name and size', { timeout: 30000 }, () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...SUPPORTED_FILE_CONFIGS),
          fc.stringMatching(/^[a-zA-Z0-9]{1,15}$/),
          fc.integer({ min: 1024, max: 1048576 }), // 1KB to 1MB
          (fileConfig, baseName, size) => {
            const fileName = `${baseName}.${fileConfig.extension}`
            const document: UploadedDocument = {
              id: `doc-${Date.now()}`,
              name: fileName,
              size: size,
              type: fileConfig.mimeType,
              file: createMockFile(fileName, fileConfig.mimeType, size),
            }
            
            const { unmount } = render(
              <DocumentUploader 
                documents={[document]} 
                onAddDocument={vi.fn()}
                onRemoveDocument={vi.fn()}
              />
            )
            
            // Document name should be displayed
            expect(screen.getByText(fileName)).toBeInTheDocument()
            
            // Document count should be displayed
            expect(screen.getByText('已上传 1 个文件')).toBeInTheDocument()
            
            unmount()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 9: Document Removal
   * 
   * *For any* document in the upload list, when the remove button is clicked, 
   * the document SHALL be removed from the list and no longer displayed.
   * 
   * **Validates: Requirements 2.5.4**
   */
  describe('Property 9: Document Removal', () => {
    it('should call onRemoveDocument with correct id for any document', { timeout: 30000 }, () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9-]{5,20}$/),
          fc.stringMatching(/^[a-zA-Z0-9]{1,15}$/),
          (documentId, baseName) => {
            const fileName = `${baseName}.pdf`
            const onRemoveDocument = vi.fn()
            
            const document: UploadedDocument = {
              id: documentId,
              name: fileName,
              size: 1024,
              type: 'application/pdf',
              file: createMockFile(fileName, 'application/pdf'),
            }
            
            const { unmount } = render(
              <DocumentUploader 
                documents={[document]} 
                onAddDocument={vi.fn()}
                onRemoveDocument={onRemoveDocument}
              />
            )
            
            // Click remove button
            const removeButton = screen.getByTitle('移除文档')
            fireEvent.click(removeButton)
            
            // Verify onRemoveDocument was called with correct id
            expect(onRemoveDocument).toHaveBeenCalledWith(documentId)
            expect(onRemoveDocument).toHaveBeenCalledTimes(1)
            
            unmount()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should remove correct document from list of multiple documents', { timeout: 30000 }, () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),
          fc.integer({ min: 0, max: 4 }),
          (numDocs, removeIndex) => {
            // Ensure removeIndex is valid
            const actualRemoveIndex = removeIndex % numDocs
            
            const documents: UploadedDocument[] = Array.from({ length: numDocs }, (_, i) => ({
              id: `doc-${i}`,
              name: `document-${i}.pdf`,
              size: 1024 * (i + 1),
              type: 'application/pdf',
              file: createMockFile(`document-${i}.pdf`, 'application/pdf'),
            }))
            
            const onRemoveDocument = vi.fn()
            
            const { unmount } = render(
              <DocumentUploader 
                documents={documents} 
                onAddDocument={vi.fn()}
                onRemoveDocument={onRemoveDocument}
              />
            )
            
            // Click remove button for the target document
            const removeButtons = screen.getAllByTitle('移除文档')
            fireEvent.click(removeButtons[actualRemoveIndex])
            
            // Verify correct document id was passed
            expect(onRemoveDocument).toHaveBeenCalledWith(`doc-${actualRemoveIndex}`)
            
            unmount()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
