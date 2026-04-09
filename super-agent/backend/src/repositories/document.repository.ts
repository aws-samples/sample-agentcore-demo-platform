/**
 * Document Repository
 * Data access layer for Document entities with multi-tenancy support.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { BaseRepository, type FindAllOptions } from './base.repository.js';
import type { DocumentFilter, DocumentStatus } from '../schemas/document.schema.js';

/**
 * Document entity type matching the Prisma schema
 */
export interface DocumentEntity {
  id: string;
  organization_id: string;
  title: string;
  category: string | null;
  file_name: string;
  file_type: string | null;
  file_path: string;
  status: 'indexed' | 'processing' | 'error';
  created_at: Date;
  updated_at: Date;
}

/**
 * Document Repository class extending BaseRepository with document-specific methods.
 * Provides multi-tenancy filtering for all operations.
 */
export class DocumentRepository extends BaseRepository<DocumentEntity> {
  constructor() {
    super('documents');
  }

  /**
   * Find all documents with optional filters.
   * Supports filtering by category, status, and file_type.
   *
   * @param organizationId - The organization ID to filter by
   * @param filters - Optional filters (category, status, file_type)
   * @param options - Optional query options (pagination, ordering)
   * @returns Array of documents matching the criteria
   */
  async findAllWithFilters(
    organizationId: string,
    filters?: DocumentFilter,
    options?: Omit<FindAllOptions<DocumentEntity>, 'where'>
  ): Promise<DocumentEntity[]> {
    const where: Partial<DocumentEntity> = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.file_type) {
      where.file_type = filters.file_type;
    }

    return this.findAll(organizationId, {
      ...options,
      where,
    });
  }

  /**
   * Find documents by category.
   *
   * @param organizationId - The organization ID to filter by
   * @param category - The category to filter by
   * @returns Array of documents in the specified category
   */
  async findByCategory(organizationId: string, category: string): Promise<DocumentEntity[]> {
    return this.findAll(organizationId, {
      where: { category },
    });
  }

  /**
   * Find documents by status.
   *
   * @param organizationId - The organization ID to filter by
   * @param status - The status to filter by
   * @returns Array of documents with the specified status
   */
  async findByStatus(organizationId: string, status: DocumentStatus): Promise<DocumentEntity[]> {
    return this.findAll(organizationId, {
      where: { status },
    });
  }

  /**
   * Find document by file path within an organization.
   * Useful for checking if a file already exists.
   *
   * @param organizationId - The organization ID to filter by
   * @param filePath - The file path to search for
   * @returns The document if found, null otherwise
   */
  async findByFilePath(organizationId: string, filePath: string): Promise<DocumentEntity | null> {
    return this.findFirst(organizationId, { file_path: filePath });
  }

  /**
   * Update document status.
   * Requirements: 7.5 - document status management
   *
   * @param id - The document ID
   * @param organizationId - The organization ID to filter by
   * @param status - The new status
   * @returns The updated document, or null if not found
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: DocumentStatus
  ): Promise<DocumentEntity | null> {
    return this.update(id, organizationId, { status });
  }

  /**
   * Find documents by file type.
   *
   * @param organizationId - The organization ID to filter by
   * @param fileType - The file type to filter by
   * @returns Array of documents with the specified file type
   */
  async findByFileType(organizationId: string, fileType: string): Promise<DocumentEntity[]> {
    return this.findAll(organizationId, {
      where: { file_type: fileType },
    });
  }

  /**
   * Count documents by status within an organization.
   * Useful for dashboard statistics.
   *
   * @param organizationId - The organization ID to filter by
   * @param status - The status to count
   * @returns The count of documents with the specified status
   */
  async countByStatus(organizationId: string, status: DocumentStatus): Promise<number> {
    return this.count(organizationId, { status });
  }
}

// Export singleton instance
export const documentRepository = new DocumentRepository();
