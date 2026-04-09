/**
 * REST Document Service
 * 
 * Implements the document service interface using the REST API backend.
 * Handles file uploads via presigned URLs.
 */

import { restClient } from './restClient';
import type { KnowledgeDocument, DocumentFileType, DocumentStatus, DocumentUpload } from '@/types';
import { ServiceError } from '@/utils/errorHandling';

/**
 * API response type for documents (snake_case from backend)
 */
interface ApiDocument {
  id: string;
  organization_id: string;
  title: string;
  category: string | null;
  file_name: string;
  file_type: string | null;
  file_path: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Maps API document response to application KnowledgeDocument type
 */
function mapApiDocumentToKnowledgeDocument(apiDoc: ApiDocument): KnowledgeDocument {
  return {
    id: apiDoc.id,
    title: apiDoc.title,
    category: apiDoc.category || 'Uncategorized',
    fileName: apiDoc.file_name,
    fileType: (apiDoc.file_type || 'TXT') as DocumentFileType,
    uploadTime: new Date(apiDoc.created_at),
    status: apiDoc.status as DocumentStatus,
  };
}

/**
 * REST implementation of the Document Service
 */
export const RestDocumentService = {
  /**
   * Retrieves all documents from the API
   */
  async getDocuments(): Promise<KnowledgeDocument[]> {
    try {
      const response = await restClient.get<{
        data: ApiDocument[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>('/api/documents');
      return response.data.map(mapApiDocumentToKnowledgeDocument);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to fetch documents', 'UNKNOWN');
    }
  },

  /**
   * Retrieves a single document by ID
   */
  async getDocumentById(id: string): Promise<KnowledgeDocument> {
    try {
      const response = await restClient.get<ApiDocument>(`/api/documents/${id}`);
      return mapApiDocumentToKnowledgeDocument(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch document with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Uploads a document using presigned URL
   */
  async uploadDocument(upload: DocumentUpload): Promise<KnowledgeDocument> {
    try {
      if (!upload.title || upload.title.trim() === '') {
        throw new ServiceError('Document title is required', 'VALIDATION_ERROR');
      }
      if (!upload.file) {
        throw new ServiceError('File is required', 'VALIDATION_ERROR');
      }

      // Step 1: Get presigned upload URL
      const { uploadUrl, key } = await restClient.post<{ uploadUrl: string; key: string }>(
        '/api/files/upload-url',
        {
          fileName: upload.file.name,
          contentType: upload.file.type,
        }
      );

      // Step 2: Upload file to S3 using presigned URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: upload.file,
        headers: {
          'Content-Type': upload.file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new ServiceError('Failed to upload file to storage', 'SERVER_ERROR');
      }

      // Step 3: Create document record
      const fileType = getFileType(upload.file.name);
      const response = await restClient.post<ApiDocument>('/api/documents', {
        title: upload.title.trim(),
        category: upload.category || null,
        file_name: upload.file.name,
        file_type: fileType,
        file_path: key,
        status: 'processing',
      });

      return mapApiDocumentToKnowledgeDocument(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to upload document', 'UNKNOWN');
    }
  },

  /**
   * Updates a document's metadata
   */
  async updateDocument(
    id: string,
    data: { title?: string; category?: string; status?: DocumentStatus }
  ): Promise<KnowledgeDocument> {
    try {
      const requestData: Record<string, unknown> = {};
      if (data.title !== undefined) requestData.title = data.title;
      if (data.category !== undefined) requestData.category = data.category;
      if (data.status !== undefined) requestData.status = data.status;

      const response = await restClient.put<ApiDocument>(`/api/documents/${id}`, requestData);
      return mapApiDocumentToKnowledgeDocument(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to update document with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Deletes a document
   */
  async deleteDocument(id: string): Promise<void> {
    try {
      await restClient.delete(`/api/documents/${id}`);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to delete document with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Gets a download URL for a document
   */
  async getDownloadUrl(id: string): Promise<string> {
    try {
      const response = await restClient.get<{ downloadUrl: string }>(`/api/documents/${id}/download`);
      return response.downloadUrl;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to get download URL for document "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Retrieves documents filtered by category
   */
  async getDocumentsByCategory(category: string): Promise<KnowledgeDocument[]> {
    try {
      const response = await restClient.get<{
        data: ApiDocument[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(
        `/api/documents?category=${encodeURIComponent(category)}`
      );
      return response.data.map(mapApiDocumentToKnowledgeDocument);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch documents for category "${category}"`, 'UNKNOWN');
    }
  },

  /**
   * Retrieves documents filtered by status
   */
  async getDocumentsByStatus(status: DocumentStatus): Promise<KnowledgeDocument[]> {
    try {
      const response = await restClient.get<{
        data: ApiDocument[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(
        `/api/documents?status=${encodeURIComponent(status)}`
      );
      return response.data.map(mapApiDocumentToKnowledgeDocument);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch documents with status "${status}"`, 'UNKNOWN');
    }
  },

  /**
   * Subscribes to real-time document changes (no-op for REST)
   */
  subscribeToChanges(callback: (payload: { eventType: string; new?: KnowledgeDocument; old?: KnowledgeDocument }) => void) {
    console.warn('REST API does not support real-time subscriptions. Consider using polling.');
    return () => {};
  },
};

/**
 * Determines file type from filename extension
 */
function getFileType(fileName: string): DocumentFileType {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'PDF';
    case 'txt':
      return 'TXT';
    case 'md':
      return 'MD';
    case 'docx':
    case 'doc':
      return 'DOCX';
    default:
      return 'TXT';
  }
}

export default RestDocumentService;
