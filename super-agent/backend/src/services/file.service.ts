/**
 * File Service
 * Business logic layer for file storage operations with S3 integration.
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';

/**
 * Presigned URL response structure
 */
export interface PresignedUrlResponse {
  url: string;
  key: string;
  expiresIn: number;
}

/**
 * File metadata response
 */
export interface FileMetadata {
  key: string;
  contentType: string | undefined;
  contentLength: number | undefined;
  lastModified: Date | undefined;
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
 * File Service class providing business logic for file storage operations.
 * All file operations enforce organization-based isolation through key prefixes.
 */
export class FileService {
  /**
   * Generate a presigned URL for uploading a file to S3.
   * Files are stored with organization_id prefix for isolation.
   * Requirements: 12.1, 12.3
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
    // Validate inputs
    if (!organizationId || organizationId.trim() === '') {
      throw AppError.validation('Organization ID is required');
    }

    if (!fileName || fileName.trim() === '') {
      throw AppError.validation('File name is required');
    }

    if (!contentType || contentType.trim() === '') {
      throw AppError.validation('Content type is required');
    }

    // Generate unique key with organization prefix for isolation
    const timestamp = Date.now();
    const sanitizedFileName = this.sanitizeFileName(fileName);
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
   * Validates that the file belongs to the requesting organization.
   * Requirements: 12.2, 12.3, 12.4
   *
   * @param key - The S3 key/path of the file
   * @param organizationId - The organization ID for validation
   * @returns Presigned download URL
   * @throws AppError.forbidden if file doesn't belong to organization
   */
  async getDownloadUrl(key: string, organizationId: string): Promise<PresignedUrlResponse> {
    // Validate inputs
    if (!key || key.trim() === '') {
      throw AppError.validation('File key is required');
    }

    if (!organizationId || organizationId.trim() === '') {
      throw AppError.validation('Organization ID is required');
    }

    // Validate that the file path belongs to the organization
    this.validateFileAccess(key, organizationId);

    const command = new GetObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
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
   * Delete a file from S3.
   * Validates that the file belongs to the requesting organization.
   * Requirements: 12.3, 12.4
   *
   * @param key - The S3 key of the file to delete
   * @param organizationId - The organization ID for validation
   * @throws AppError.forbidden if file doesn't belong to organization
   */
  async deleteFile(key: string, organizationId: string): Promise<void> {
    // Validate inputs
    if (!key || key.trim() === '') {
      throw AppError.validation('File key is required');
    }

    if (!organizationId || organizationId.trim() === '') {
      throw AppError.validation('Organization ID is required');
    }

    // Validate that the file path belongs to the organization
    this.validateFileAccess(key, organizationId);

    const command = new DeleteObjectCommand({
      Bucket: config.s3.bucketName,
      Key: key,
    });

    await s3Client.send(command);
  }

  /**
   * Check if a file exists in S3.
   * Validates that the file belongs to the requesting organization.
   * Requirements: 12.3, 12.4
   *
   * @param key - The S3 key of the file
   * @param organizationId - The organization ID for validation
   * @returns True if file exists, false otherwise
   * @throws AppError.forbidden if file doesn't belong to organization
   */
  async fileExists(key: string, organizationId: string): Promise<boolean> {
    // Validate inputs
    if (!key || key.trim() === '') {
      throw AppError.validation('File key is required');
    }

    if (!organizationId || organizationId.trim() === '') {
      throw AppError.validation('Organization ID is required');
    }

    // Validate that the file path belongs to the organization
    this.validateFileAccess(key, organizationId);

    try {
      const command = new HeadObjectCommand({
        Bucket: config.s3.bucketName,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error: unknown) {
      // Check if error is NotFound
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata from S3.
   * Validates that the file belongs to the requesting organization.
   * Requirements: 12.3, 12.4
   *
   * @param key - The S3 key of the file
   * @param organizationId - The organization ID for validation
   * @returns File metadata
   * @throws AppError.forbidden if file doesn't belong to organization
   * @throws AppError.notFound if file doesn't exist
   */
  async getFileMetadata(key: string, organizationId: string): Promise<FileMetadata> {
    // Validate inputs
    if (!key || key.trim() === '') {
      throw AppError.validation('File key is required');
    }

    if (!organizationId || organizationId.trim() === '') {
      throw AppError.validation('Organization ID is required');
    }

    // Validate that the file path belongs to the organization
    this.validateFileAccess(key, organizationId);

    try {
      const command = new HeadObjectCommand({
        Bucket: config.s3.bucketName,
        Key: key,
      });

      const response = await s3Client.send(command);

      return {
        key,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
      };
    } catch (error: unknown) {
      // Check if error is NotFound
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
        throw AppError.notFound(`File not found: ${key}`);
      }
      throw error;
    }
  }

  /**
   * Validate that a file key belongs to the specified organization.
   * Files must be prefixed with the organization ID for isolation.
   * Requirements: 12.3, 12.4
   *
   * @param key - The S3 key to validate
   * @param organizationId - The organization ID to check against
   * @throws AppError.forbidden if file doesn't belong to organization
   */
  validateFileAccess(key: string, organizationId: string): void {
    // Normalize the key and organization ID
    const normalizedKey = key.trim();
    const normalizedOrgId = organizationId.trim();

    // Check if the key starts with the organization ID prefix
    if (!normalizedKey.startsWith(`${normalizedOrgId}/`)) {
      throw AppError.forbidden('Access denied to this file');
    }
  }

  /**
   * Extract organization ID from a file key.
   *
   * @param key - The S3 key
   * @returns The organization ID or null if not found
   */
  extractOrganizationId(key: string): string | null {
    const parts = key.split('/');
    if (parts.length < 2 || !parts[0]) {
      return null;
    }
    return parts[0];
  }

  /**
   * Sanitize a file name for safe storage.
   * Replaces special characters with underscores.
   *
   * @param fileName - The original file name
   * @returns Sanitized file name
   */
  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  }
}

// Export singleton instance
export const fileService = new FileService();
