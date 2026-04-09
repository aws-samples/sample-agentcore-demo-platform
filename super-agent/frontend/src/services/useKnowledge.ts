import { useState, useCallback, useEffect } from 'react'
import { KnowledgeService } from './knowledgeService'
import type { KnowledgeDocument, DocumentUpload, KnowledgeBaseConfig, DocumentFileType } from '@/types'

export interface UseKnowledgeReturn {
  documents: KnowledgeDocument[]
  isLoading: boolean
  error: string | null
  getDocuments: () => Promise<void>
  uploadDocument: (upload: DocumentUpload) => Promise<KnowledgeDocument>
  deleteDocument: (id: string) => Promise<void>
  createKnowledgeBase: (config: KnowledgeBaseConfig) => Promise<void>
  syncAll: () => Promise<void>
  getSupportedFileTypes: () => DocumentFileType[]
}

export function useKnowledge(): UseKnowledgeReturn {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const docs = await KnowledgeService.getDocuments()
      setDocuments(docs)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const uploadDocument = useCallback(async (upload: DocumentUpload): Promise<KnowledgeDocument> => {
    setError(null)
    try {
      const doc = await KnowledgeService.uploadDocument(upload)
      setDocuments(prev => [...prev, doc])
      return doc
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload document'
      setError(message)
      throw err
    }
  }, [])

  const deleteDocument = useCallback(async (id: string) => {
    setError(null)
    try {
      await KnowledgeService.deleteDocument(id)
      setDocuments(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document'
      setError(message)
      throw err
    }
  }, [])

  const createKnowledgeBase = useCallback(async (config: KnowledgeBaseConfig) => {
    setError(null)
    try {
      await KnowledgeService.createKnowledgeBase(config)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create knowledge base'
      setError(message)
      throw err
    }
  }, [])

  const syncAll = useCallback(async () => {
    setError(null)
    try {
      await KnowledgeService.syncAll()
      // Refresh documents after sync
      await getDocuments()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync documents'
      setError(message)
      throw err
    }
  }, [getDocuments])

  const getSupportedFileTypes = useCallback(() => {
    return KnowledgeService.getSupportedFileTypes()
  }, [])

  // Load documents on mount
  useEffect(() => {
    getDocuments()
  }, [getDocuments])

  return {
    documents,
    isLoading,
    error,
    getDocuments,
    uploadDocument,
    deleteDocument,
    createKnowledgeBase,
    syncAll,
    getSupportedFileTypes,
  }
}
