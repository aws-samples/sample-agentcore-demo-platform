/**
 * Document Service
 * Business logic layer for Document management with S3 integration.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { documentRepository, type DocumentEntity } from '../repositories/document.repository.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentFilter,
  DocumentStatus,
} from '../schemas/document.schema.js';

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Presigned URL response
 */
export interface PresignedUrlResponse {
  url: string;
  key: string;
  expiresIn: number;
}

/**
 * Document with download URL
 */
export interface DocumentWithUrl extends DocumentEntity {
  downloadUrl?: string;
}

/**
 * Initialize S3 client
 */
const s3Client = new S3Client({
  region: config.aws.region,
  ...(config.aws.accessKeyId && config.aws.secretAccessKey
    ? {
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
        },
      }
    : {}),
});

/**
 * Document Service class providing business logic for document operations.
 */
export class DocumentService {
  /**
   * Get all documents for an organization with optional filters.
   * Requirements: 7.1, 7.4
   *
   * @param organizationId - The organization ID
   * @param filters - Optional filters (category, status, file_type)
   * @param pagination - Optional pagination options
   * @returns Paginated list of documents
   */
  async getDocuments(
    organizationId: string,
    filters?: DocumentFilter,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<DocumentEntity>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const documents = await documentRepository.findAllWithFilters(organizationId, filters, {
      skip,
      take: limit,
    });

    // Get total count for pagination
    const total = await documentRepository.count(
      organizationId,
      filters as Partial<DocumentEntity>
    );

    return {
      data: documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single document by ID.
   * Requirements: 7.4
   *
   * @param id - The document ID
   * @param organizationId - The organization ID
   * @returns The document if found
   * @throws AppError.notFound if document doesn't exist
   */
  async getDocumentById(id: string, organizationId: string): Promise<DocumentEntity> {
    const document = await documentRepository.findById(id, organizationId);

    if (!document) {
      throw AppError.notFound(`Document with ID ${id} not found`);
    }

    return document;
  }

  /**
   * Create a new document record.
   * Requirements: 7.2, 7.3
   *
   * @param data - The document data
   * @param organizationId - The organization ID
   * @returns The created document
   */
  async createDocument(data: CreateDocumentInput, organizationId: string): Promise<DocumentEntity> {
    // Validate required fields
    if (!data.title || data.title.trim() === '') {
      throw AppError.validation('Document title is required');
    }

    if (!data.file_name || data.file_name.trim() === '') {
      throw AppError.validation('File name is required');
    }

    if (!data.file_path || data.file_path.trim() === '') {
      throw AppError.validation('File path is required');
    }

    // Create the document record
    const document = await documentRepository.create(
      {
        title: data.title.trim(),
        category: data.category ?? null,
        file_name: data.file_name.trim(),
        file_type: data.file_type ?? null,
        file_path: data.file_path.trim(),
        status: data.status ?? 'processing',
      },
      organizationId
    );

    return document;
  }

  /**
   * Update an existing document.
   * Requirements: 7.4
   *
   * @param id - The document ID
   * @param data - The update data
   * @param organizationId - The organization ID
   * @returns The updated document
   * @throws AppError.notFound if document doesn't exist
   */
  async updateDocument(
    id: string,
    data: UpdateDocumentInput,
    organizationId: string
  ): Promise<DocumentEntity> {
    // Verify document exists
    const existingDocument = await documentRepository.findById(id, organizationId);
    if (!existingDocument) {
      throw AppError.notFound(`Document with ID ${id} not found`);
    }

    // Validate title if provided
    if (data.title !== undefined && (!data.title || data.title.trim() === '')) {
      throw AppError.validation('Document title cannot be empty');
    }

    // Build update object with only provided fields
    const updateData: Partial<DocumentEntity> = {};

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.category !== undefined) updateData.category = data.category;
    if (data.status !== undefined) updateData.status = data.status;

    const updatedDocument = await documentRepository.update(id, organizationId, updateData);

    if (!updatedDocument) {
      throw AppError.notFound(`Document with ID ${id} not found`);
    }

    return updatedDocument;
  }

  /**
   * Update document status.
   * Requirements: 7.5
   *
   * @param id - The document ID
   * @param status - The new status
   * @param organizationId - The organization ID
   * @returns The updated document
   * @throws AppError.notFound if document doesn't exist
   */
  async updateDocumentStatus(
    id: string,
    status: DocumentStatus,
    organizationId: string
  ): Promise<DocumentEntity> {
    const updatedDocument = await documentRepository.updateStatus(id, organizationId, status);

    if (!updatedDocument) {
      throw AppError.notFound(`Document with ID ${id} not found`);
    }

    return updatedDocument;
  }

  /**
   * Delete a document and its S3 file.
   * Requirements: 7.5
   *
   * @param id - The document ID
   * @param organizationId - The organization ID
   * @returns True if deleted successfully
   * @throws AppError.notFound if document doesn't exist
   */
  async deleteDocument(id: string, organizationId: string): Promise<boolean> {
    // Get document to retrieve file path
    const document = await documentRepository.findById(id, organizationId);
    if (!document) {
      throw AppError.notFound(`Document with ID ${id} not found`);
    }

    // Delete from S3
    try {
      await this.deleteFileFromS3(document.file_path);
    } catch (error) {
      // Log error but continue with database deletion
      console.error(`Failed to delete S3 file: ${document.file_path}`, error);
    }

    // Delete from database
    const deleted = await documentRepository.delete(id, organizationId);

    if (!deleted) {
      throw AppError.notFound(`Document with ID ${id} not found`);
    }

    return true;
  }

  /**
   * Generate a presigned URL for uploading a file to S3.
   * Requirements: 7.3, 7.6
   *
   * @param organizationId - The organization ID (used for file path prefix)
   * @param fileName - The original file name
   * @param contentType - The file content type
   * @returns Presigned URL and S3 key
   */
  async getUploadUrl(
    organizationId: string,
    fileName: string,
    contentType: string
  ): Promise<PresignedUrlResponse> {
    // Generate unique key with organization prefix for isolation
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${organizationId}/${timestamp}-${sanitizedFileName}`;

    const command = new PutObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: config.s3.presignedUrlExpires,
    });

    return {
      url,
      key,
      expiresIn: config.s3.presignedUrlExpires,
    };
  }

  /**
   * Generate a presigned URL for downloading a file from S3.
   * Requirements: 7.6
   *
   * @param filePath - The S3 key/path of the file
   * @param organizationId - The organization ID for validation
   * @returns Presigned download URL
   * @throws AppError.forbidden if file doesn't belong to organization
   */
  async getDownloadUrl(filePath: string, organizationId: string): Promise<PresignedUrlResponse> {
    // Validate that the file path belongs to the organization
    if (!filePath.startsWith(`${organizationId}/`)) {
      throw AppError.forbidden('Access denied to this file');
    }

    const command = new GetObjectCommand({
      Bucket: config.s3.bucketName,
      Key: filePath,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: config.s3.presignedUrlExpires,
    });

    return {
      url,
      key: filePath,
      expiresIn: config.s3.presignedUrlExpires,
    };
  }

  /**
   * Get document with download URL.
   * Requirements: 7.6
   *
   * @param id - The document ID
   * @param organizationId - The organization ID
   * @returns Document with presigned download URL
   */
  async getDocumentWithDownloadUrl(id: string, organizationId: string): Promise<DocumentWithUrl> {
    const document = await this.getDocumentById(id, organizationId);

    const { url } = await this.getDownloadUrl(document.file_path, organizationId);

    return {
      ...document,
      downloadUrl: url,
    };
  }

  /**
   * Delete a file from S3.
   *
   * @param key - The S3 key of the file to delete
   */
  private async deleteFileFromS3(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
    });

    await s3Client.send(command);
  }

  /**
   * Get documents by category.
   *
   * @param organizationId - The organization ID
   * @param category - The category to filter by
   * @returns List of documents in the category
   */
  async getDocumentsByCategory(
    organizationId: string,
    category: string
  ): Promise<DocumentEntity[]> {
    return documentRepository.findByCategory(organizationId, category);
  }

  /**
   * Get documents by status.
   *
   * @param organizationId - The organization ID
   * @param status - The status to filter by
   * @returns List of documents with the specified status
   */
  async getDocumentsByStatus(
    organizationId: string,
    status: DocumentStatus
  ): Promise<DocumentEntity[]> {
    return documentRepository.findByStatus(organizationId, status);
  }
}

// Export singleton instance
export const documentService = new DocumentService();
