import type { KnowledgeDocument, DocumentUpload, KnowledgeBaseConfig, DocumentFileType } from '@/types'
import { getServiceConfig } from './api/createService'
import { RestDocumentService } from './api/restDocumentService'
import { shouldUseRestApi } from './api/index'

// Simulated network delay for realistic behavior
const SIMULATED_DELAY = 300

// Supported file types
const SUPPORTED_FILE_TYPES: DocumentFileType[] = ['PDF', 'TXT', 'MD', 'DOCX']

// Mock data for development
const mockDocuments: KnowledgeDocument[] = [
  {
    id: 'doc-1',
    title: 'Company Policies',
    category: 'HR',
    fileName: 'company-policies.pdf',
    fileType: 'PDF',
    uploadTime: new Date('2024-01-15'),
    status: 'indexed',
  },
  {
    id: 'doc-2',
    title: 'API Documentation',
    category: 'Technical',
    fileName: 'api-docs.md',
    fileType: 'MD',
    uploadTime: new Date('2024-01-14'),
    status: 'indexed',
  },
  {
    id: 'doc-3',
    title: 'Product Roadmap',
    category: 'Product',
    fileName: 'roadmap.docx',
    fileType: 'DOCX',
    uploadTime: new Date('2024-01-13'),
    status: 'processing',
  },
]

// In-memory store for mock data (simulates backend persistence)
let documentStore: KnowledgeDocument[] = [...mockDocuments]

// Helper to simulate async operations
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export type KnowledgeServiceErrorCode = 'NOT_FOUND' | 'VALIDATION_ERROR' | 'UNSUPPORTED_FILE_TYPE' | 'NETWORK_ERROR' | 'UNKNOWN'

export class KnowledgeServiceError extends Error {
  code: KnowledgeServiceErrorCode

  constructor(message: string, code: KnowledgeServiceErrorCode) {
    super(message)
    this.name = 'KnowledgeServiceError'
    this.code = code
  }
}

export const MockKnowledgeService = {
  /**
   * Retrieves all documents
   */
  async getDocuments(): Promise<KnowledgeDocument[]> {
    await delay(SIMULATED_DELAY)
    return [...documentStore]
  },

  /**
   * Retrieves a single document by ID
   * @throws KnowledgeServiceError if document not found
   */
  async getDocumentById(id: string): Promise<KnowledgeDocument> {
    await delay(SIMULATED_DELAY)
    const doc = documentStore.find(d => d.id === id)
    if (!doc) {
      throw new KnowledgeServiceError(`Document with id "${id}" not found`, 'NOT_FOUND')
    }
    return { ...doc }
  },

  /**
   * Uploads a new document
   * @throws KnowledgeServiceError if validation fails
   */
  async uploadDocument(upload: DocumentUpload): Promise<KnowledgeDocument> {
    await delay(SIMULATED_DELAY)

    // Validate title
    if (!upload.title || upload.title.trim() === '') {
      throw new KnowledgeServiceError('Document title is required', 'VALIDATION_ERROR')
    }

    // Validate category
    if (!upload.category || upload.category.trim() === '') {
      throw new KnowledgeServiceError('Document category is required', 'VALIDATION_ERROR')
    }

    // Validate file
    if (!upload.file) {
      throw new KnowledgeServiceError('File is required', 'VALIDATION_ERROR')
    }

    // Validate file type
    const fileExtension = upload.file.name.split('.').pop()?.toUpperCase() as DocumentFileType
    if (!SUPPORTED_FILE_TYPES.includes(fileExtension)) {
      throw new KnowledgeServiceError(
        `Unsupported file type: ${fileExtension}. Supported types: ${SUPPORTED_FILE_TYPES.join(', ')}`,
        'UNSUPPORTED_FILE_TYPE'
      )
    }

    // Create new document
    const newDocument: KnowledgeDocument = {
      id: `doc-${Date.now()}`,
      title: upload.title,
      category: upload.category,
      fileName: upload.file.name,
      fileType: fileExtension,
      uploadTime: new Date(),
      status: 'processing',
    }

    documentStore.push(newDocument)

    // Simulate indexing completion after a delay
    setTimeout(() => {
      const index = documentStore.findIndex(d => d.id === newDocument.id)
      if (index !== -1) {
        documentStore[index].status = 'indexed'
      }
    }, 2000)

    return { ...newDocument }
  },

  /**
   * Deletes a document
   * @throws KnowledgeServiceError if document not found
   */
  async deleteDocument(id: string): Promise<void> {
    await delay(SIMULATED_DELAY)

    const index = documentStore.findIndex(d => d.id === id)
    if (index === -1) {
      throw new KnowledgeServiceError(`Document with id "${id}" not found`, 'NOT_FOUND')
    }

    documentStore.splice(index, 1)
  },

  /**
   * Creates a new knowledge base
   */
  async createKnowledgeBase(config: KnowledgeBaseConfig): Promise<void> {
    await delay(SIMULATED_DELAY)

    // Validate required fields
    if (!config.name || config.name.trim() === '') {
      throw new KnowledgeServiceError('Knowledge base name is required', 'VALIDATION_ERROR')
    }

    if (!config.vectorDatabase) {
      throw new KnowledgeServiceError('Vector database selection is required', 'VALIDATION_ERROR')
    }

    if (!config.storageUri || config.storageUri.trim() === '') {
      throw new KnowledgeServiceError('S3 storage URI is required', 'VALIDATION_ERROR')
    }

    // In a real implementation, this would create the KB in the backend
    // For now, we just validate and return
  },

  /**
   * Syncs all documents (re-indexes them)
   */
  async syncAll(): Promise<void> {
    await delay(SIMULATED_DELAY)

    // Mark all documents as processing
    documentStore.forEach(doc => {
      doc.status = 'processing'
    })

    // Simulate sync completion
    setTimeout(() => {
      documentStore.forEach(doc => {
        doc.status = 'indexed'
      })
    }, 3000)
  },

  /**
   * Gets supported file types
   */
  getSupportedFileTypes(): DocumentFileType[] {
    return [...SUPPORTED_FILE_TYPES]
  },

  /**
   * Resets the document store to initial mock data (useful for testing)
   */
  resetStore(): void {
    documentStore = [...mockDocuments]
  },

  /**
   * Gets the initial mock documents (useful for testing)
   */
  getMockDocuments(): KnowledgeDocument[] {
    return [...mockDocuments]
  },
}

/**
 * Knowledge Service Interface
 * Defines the contract that mock and REST implementations must follow
 */
export interface IKnowledgeService {
  getDocuments(): Promise<KnowledgeDocument[]>
  getDocumentById(id: string): Promise<KnowledgeDocument>
  uploadDocument(upload: DocumentUpload): Promise<KnowledgeDocument>
  deleteDocument(id: string): Promise<void>
  createKnowledgeBase?(config: KnowledgeBaseConfig): Promise<void>
  syncAll?(): Promise<void>
  getSupportedFileTypes?(): DocumentFileType[]
  resetStore?(): void
  getMockDocuments?(): KnowledgeDocument[]
}

/**
 * REST Knowledge Service adapter
 * Wraps RestDocumentService to match IKnowledgeService interface
 */
const RestKnowledgeServiceAdapter: IKnowledgeService = {
  getDocuments: () => RestDocumentService.getDocuments(),
  getDocumentById: (id: string) => RestDocumentService.getDocumentById(id),
  uploadDocument: (upload: DocumentUpload) => RestDocumentService.uploadDocument(upload),
  deleteDocument: (id: string) => RestDocumentService.deleteDocument(id),
  // These methods are not available in REST API, use mock fallbacks
  createKnowledgeBase: MockKnowledgeService.createKnowledgeBase,
  syncAll: MockKnowledgeService.syncAll,
  getSupportedFileTypes: MockKnowledgeService.getSupportedFileTypes,
}

/**
 * Unified Knowledge Service
 * 
 * Automatically switches between mock and REST API implementations
 * based on environment variables:
 * 
 * - When VITE_API_MODE=rest: Uses RestDocumentService (REST API backend)
 * - Otherwise: Uses MockKnowledgeService
 */
function selectKnowledgeService(): IKnowledgeService {
  if (shouldUseRestApi()) {
    return RestKnowledgeServiceAdapter
  }
  const config = getServiceConfig()
  return MockKnowledgeService
}

export const KnowledgeService = selectKnowledgeService()
export default KnowledgeService
