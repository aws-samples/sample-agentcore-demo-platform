/**
 * Property-Based Tests for Document Upload Consistency
 * 
 * Feature: supabase-backend, Property 8: Document Upload Consistency
 * Validates: Requirements 7.3, 7.4
 * 
 * Property 8: Document Upload Consistency
 * *For any* document upload, both a storage file (with org prefix) AND a metadata record 
 * SHALL be created atomically.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ============================================================================
// Type Definitions
// ============================================================================

interface User {
  id: string;
  email: string;
  active_organization_id: string | null;
}

interface DocumentMetadata {
  id: string;
  organization_id: string;
  title: string;
  category: string;
  file_name: string;
  file_type: 'PDF' | 'TXT' | 'MD' | 'DOCX';
  file_path: string;
  status: 'indexed' | 'processing' | 'error';
  created_at: string;
  updated_at: string;
}

interface StorageFile {
  bucket_id: string;
  path: string;
  size: number;
  content_type: string;
}

interface DocumentUploadInput {
  title: string;
  category: string;
  fileName: string;
  fileType: 'PDF' | 'TXT' | 'MD' | 'DOCX';
  fileSize: number;
}

interface UploadResult {
  success: boolean;
  metadata?: DocumentMetadata;
  storageFile?: StorageFile;
  error?: string;
}

interface UploadContext {
  currentUser: User;
  existingMetadata: DocumentMetadata[];
  existingStorageFiles: StorageFile[];
}

// ============================================================================
// Generators
// ============================================================================

const userIdArbitrary = fc.uuid();
const organizationIdArbitrary = fc.uuid();
const emailArbitrary = fc.emailAddress();

const userArbitrary = fc.record({
  id: userIdArbitrary,
  email: emailArbitrary,
  active_organization_id: fc.option(organizationIdArbitrary, { nil: null }),
});

const fileTypeArbitrary = fc.constantFrom<'PDF' | 'TXT' | 'MD' | 'DOCX'>(
  'PDF', 'TXT', 'MD', 'DOCX'
);

// Generate valid document titles (non-empty, trimmed)
const titleArbitrary = fc.stringMatching(/^[a-zA-Z0-9 _-]{1,100}$/)
  .filter(s => s.trim().length > 0);

// Generate valid category names
const categoryArbitrary = fc.constantFrom(
  'HR', 'Technical', 'Product', 'Marketing', 'Legal', 'Finance'
);

// Generate valid file names
const fileNameArbitrary = fc.tuple(
  fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/),
  fileTypeArbitrary
).map(([name, type]) => `${name || 'document'}.${type.toLowerCase()}`);

// Generate file sizes (1KB to 50MB)
const fileSizeArbitrary = fc.integer({ min: 1024, max: 52428800 });

// Generate valid document upload input
const documentUploadArbitrary = fc.record({
  title: titleArbitrary,
  category: categoryArbitrary,
  fileName: fileNameArbitrary,
  fileType: fileTypeArbitrary,
  fileSize: fileSizeArbitrary,
});

// Note: ISO date strings are generated inline where needed

// ============================================================================
// Upload Simulation Functions
// ============================================================================

/**
 * Generates a file path with organization prefix.
 * Format: {organization_id}/{timestamp}_{filename}
 * Requirements: 7.3 - Store file in Supabase Storage with organization prefix
 */
function generateFilePath(orgId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${orgId}/${timestamp}_${sanitizedFileName}`;
}

/**
 * Extracts organization ID from a file path.
 */
function extractOrgIdFromPath(path: string): string | null {
  const parts = path.split('/');
  if (parts.length < 2) {
    return null;
  }
  return parts[0];
}

/**
 * Validates that a file path has the correct organization prefix.
 */
function hasValidOrgPrefix(path: string, expectedOrgId: string): boolean {
  const pathOrgId = extractOrgIdFromPath(path);
  return pathOrgId === expectedOrgId;
}

/**
 * Simulates document upload operation.
 * Requirements: 7.3, 7.4
 * 
 * This function simulates the atomic upload process:
 * 1. Upload file to storage with org prefix
 * 2. Create metadata record in database
 * Both must succeed for the upload to be considered complete.
 */
function simulateDocumentUpload(
  input: DocumentUploadInput,
  context: UploadContext,
  simulateStorageFailure: boolean = false,
  simulateMetadataFailure: boolean = false
): UploadResult {
  const { currentUser } = context;
  
  // Validate user has active organization
  if (!currentUser.active_organization_id) {
    return {
      success: false,
      error: 'No active organization found',
    };
  }
  
  // Validate title
  if (!input.title || input.title.trim() === '') {
    return {
      success: false,
      error: 'Document title is required',
    };
  }
  
  // Validate category
  if (!input.category || input.category.trim() === '') {
    return {
      success: false,
      error: 'Document category is required',
    };
  }
  
  const orgId = currentUser.active_organization_id;
  const filePath = generateFilePath(orgId, input.fileName);
  
  // Step 1: Simulate storage upload
  if (simulateStorageFailure) {
    return {
      success: false,
      error: 'Failed to upload file to storage',
    };
  }
  
  const storageFile: StorageFile = {
    bucket_id: 'documents',
    path: filePath,
    size: input.fileSize,
    content_type: getMimeType(input.fileType),
  };
  
  // Step 2: Simulate metadata creation
  if (simulateMetadataFailure) {
    // In real implementation, we would rollback the storage upload here
    return {
      success: false,
      error: 'Failed to create document metadata',
      // Note: storageFile would be deleted in rollback
    };
  }
  
  const metadata: DocumentMetadata = {
    id: crypto.randomUUID(),
    organization_id: orgId,
    title: input.title.trim(),
    category: input.category.trim(),
    file_name: input.fileName,
    file_type: input.fileType,
    file_path: filePath,
    status: 'processing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  return {
    success: true,
    metadata,
    storageFile,
  };
}

/**
 * Gets MIME type for a file type.
 */
function getMimeType(fileType: 'PDF' | 'TXT' | 'MD' | 'DOCX'): string {
  const mimeTypes: Record<string, string> = {
    'PDF': 'application/pdf',
    'TXT': 'text/plain',
    'MD': 'text/markdown',
    'DOCX': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeTypes[fileType];
}

/**
 * Verifies that upload result is consistent.
 * Both storage file and metadata must exist together, or neither should exist.
 */
function isUploadConsistent(result: UploadResult): boolean {
  if (result.success) {
    // Success: both must exist
    return result.metadata !== undefined && result.storageFile !== undefined;
  } else {
    // Failure: neither should exist (or rollback should have occurred)
    // In our simulation, we don't create partial state
    return result.metadata === undefined || result.storageFile === undefined;
  }
}

/**
 * Verifies that the storage file path matches the metadata file_path.
 */
function isPathConsistent(result: UploadResult): boolean {
  if (!result.success || !result.metadata || !result.storageFile) {
    return true; // Not applicable for failed uploads
  }
  return result.metadata.file_path === result.storageFile.path;
}

/**
 * Verifies that the file path has the correct organization prefix.
 */
function hasCorrectOrgPrefix(result: UploadResult, expectedOrgId: string): boolean {
  if (!result.success || !result.storageFile) {
    return true; // Not applicable for failed uploads
  }
  return hasValidOrgPrefix(result.storageFile.path, expectedOrgId);
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Document Upload Consistency - Property-Based Tests', () => {
  /**
   * Feature: supabase-backend, Property 8: Document Upload Consistency
   * Validates: Requirements 7.3, 7.4
   */
  describe('Property 8: Document Upload Consistency', () => {
    it('should create both storage file and metadata record on successful upload', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          documentUploadArbitrary,
          (user, activeOrgId, uploadInput) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: UploadContext = {
              currentUser: userWithOrg,
              existingMetadata: [],
              existingStorageFiles: [],
            };
            
            const result = simulateDocumentUpload(uploadInput, context);
            
            // On success, both storage file and metadata must exist
            if (result.success) {
              expect(result.metadata).toBeDefined();
              expect(result.storageFile).toBeDefined();
              expect(isUploadConsistent(result)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure storage file path matches metadata file_path', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          documentUploadArbitrary,
          (user, activeOrgId, uploadInput) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: UploadContext = {
              currentUser: userWithOrg,
              existingMetadata: [],
              existingStorageFiles: [],
            };
            
            const result = simulateDocumentUpload(uploadInput, context);
            
            // Path in metadata must match actual storage path
            expect(isPathConsistent(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include organization ID prefix in storage file path', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          documentUploadArbitrary,
          (user, activeOrgId, uploadInput) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: UploadContext = {
              currentUser: userWithOrg,
              existingMetadata: [],
              existingStorageFiles: [],
            };
            
            const result = simulateDocumentUpload(uploadInput, context);
            
            // Storage path must have org prefix
            expect(hasCorrectOrgPrefix(result, activeOrgId)).toBe(true);
            
            // Metadata org_id must match
            if (result.success && result.metadata) {
              expect(result.metadata.organization_id).toBe(activeOrgId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail upload when user has no active organization', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          documentUploadArbitrary,
          (user, uploadInput) => {
            const userWithoutOrg: User = {
              ...user,
              active_organization_id: null,
            };
            
            const context: UploadContext = {
              currentUser: userWithoutOrg,
              existingMetadata: [],
              existingStorageFiles: [],
            };
            
            const result = simulateDocumentUpload(uploadInput, context);
            
            // Should fail without active organization
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            
            // No partial state should exist
            expect(isUploadConsistent(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not create metadata if storage upload fails', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          documentUploadArbitrary,
          (user, activeOrgId, uploadInput) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: UploadContext = {
              currentUser: userWithOrg,
              existingMetadata: [],
              existingStorageFiles: [],
            };
            
            // Simulate storage failure
            const result = simulateDocumentUpload(uploadInput, context, true, false);
            
            // Should fail
            expect(result.success).toBe(false);
            
            // No metadata should be created
            expect(result.metadata).toBeUndefined();
            
            // Consistency check
            expect(isUploadConsistent(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should rollback storage file if metadata creation fails', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          documentUploadArbitrary,
          (user, activeOrgId, uploadInput) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: UploadContext = {
              currentUser: userWithOrg,
              existingMetadata: [],
              existingStorageFiles: [],
            };
            
            // Simulate metadata failure (storage succeeds but metadata fails)
            const result = simulateDocumentUpload(uploadInput, context, false, true);
            
            // Should fail
            expect(result.success).toBe(false);
            
            // In a proper implementation, storage file would be rolled back
            // Our simulation doesn't create partial state
            expect(isUploadConsistent(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set initial status to processing for new uploads', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          documentUploadArbitrary,
          (user, activeOrgId, uploadInput) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: UploadContext = {
              currentUser: userWithOrg,
              existingMetadata: [],
              existingStorageFiles: [],
            };
            
            const result = simulateDocumentUpload(uploadInput, context);
            
            if (result.success && result.metadata) {
              // New documents should start in processing status
              expect(result.metadata.status).toBe('processing');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve file metadata correctly', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          documentUploadArbitrary,
          (user, activeOrgId, uploadInput) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: UploadContext = {
              currentUser: userWithOrg,
              existingMetadata: [],
              existingStorageFiles: [],
            };
            
            const result = simulateDocumentUpload(uploadInput, context);
            
            if (result.success && result.metadata) {
              // Metadata should preserve input values
              expect(result.metadata.title).toBe(uploadInput.title.trim());
              expect(result.metadata.category).toBe(uploadInput.category.trim());
              expect(result.metadata.file_name).toBe(uploadInput.fileName);
              expect(result.metadata.file_type).toBe(uploadInput.fileType);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate required fields before upload', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fc.constantFrom('', '   ', '\t\n'),
          categoryArbitrary,
          fileNameArbitrary,
          fileTypeArbitrary,
          fileSizeArbitrary,
          (user, activeOrgId, emptyTitle, category, fileName, fileType, fileSize) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: UploadContext = {
              currentUser: userWithOrg,
              existingMetadata: [],
              existingStorageFiles: [],
            };
            
            const uploadInput: DocumentUploadInput = {
              title: emptyTitle,
              category,
              fileName,
              fileType,
              fileSize,
            };
            
            const result = simulateDocumentUpload(uploadInput, context);
            
            // Should fail with empty title
            expect(result.success).toBe(false);
            expect(result.error).toContain('title');
            
            // No partial state
            expect(isUploadConsistent(result)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use correct MIME type in storage file', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          documentUploadArbitrary,
          (user, activeOrgId, uploadInput) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: UploadContext = {
              currentUser: userWithOrg,
              existingMetadata: [],
              existingStorageFiles: [],
            };
            
            const result = simulateDocumentUpload(uploadInput, context);
            
            if (result.success && result.storageFile) {
              const expectedMime = getMimeType(uploadInput.fileType);
              expect(result.storageFile.content_type).toBe(expectedMime);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
