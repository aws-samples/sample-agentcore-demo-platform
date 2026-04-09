/**
 * Property-based tests for File Storage Isolation
 *
 * Feature: unified-ecs-backend
 * Property 7: File Storage Isolation
 * Validates: Requirements 12.3, 12.4
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { FileService } from '../../src/services/file.service.js';
import { AppError } from '../../src/middleware/errorHandler.js';

describe('File Storage Isolation Properties', () => {
  const fileService = new FileService();

  /**
   * Feature: unified-ecs-backend, Property 7: File Storage Isolation
   * Validates: Requirements 12.3, 12.4
   *
   * For any file upload or download request, the S3 key should be prefixed
   * with the user's org_id, and requests for files with a different org_id
   * prefix should return 403 Forbidden.
   */

  /**
   * Property 7a: Upload keys are prefixed with organization ID
   *
   * For any valid organization ID and file name, the generated S3 key
   * should always start with the organization ID prefix.
   */
  it('should prefix upload keys with organization ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.constantFrom('application/pdf', 'text/plain', 'image/png', 'application/json'),
        async (organizationId, fileName, contentType) => {
          // Get upload URL - this generates the S3 key
          const result = await fileService.getUploadUrl(organizationId, fileName, contentType);

          // Verify the key starts with the organization ID
          expect(result.key.startsWith(`${organizationId}/`)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7b: Access validation allows same-org access
   *
   * For any organization ID and file key that belongs to that organization,
   * validateFileAccess should not throw an error.
   */
  it('should allow access to files within same organization', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-zA-Z0-9._-]+$/.test(s)),
        (organizationId, fileName) => {
          // Create a key that belongs to the organization
          const key = `${organizationId}/${Date.now()}-${fileName}`;

          // Should not throw - access is allowed
          expect(() => fileService.validateFileAccess(key, organizationId)).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7c: Access validation denies cross-org access
   *
   * For any two different organization IDs, attempting to access a file
   * belonging to one organization from another should throw a 403 Forbidden error.
   */
  it('should deny access to files from different organization', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-zA-Z0-9._-]+$/.test(s)),
        (ownerOrgId, requestingOrgId, fileName) => {
          // Skip if org IDs happen to be the same
          fc.pre(ownerOrgId !== requestingOrgId);

          // Create a key that belongs to the owner organization
          const key = `${ownerOrgId}/${Date.now()}-${fileName}`;

          // Attempting to access from different org should throw forbidden error
          expect(() => fileService.validateFileAccess(key, requestingOrgId)).toThrow(AppError);

          try {
            fileService.validateFileAccess(key, requestingOrgId);
          } catch (error) {
            expect(error).toBeInstanceOf(AppError);
            expect((error as AppError).statusCode).toBe(403);
            expect((error as AppError).code).toBe('FORBIDDEN');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7d: Organization ID extraction is correct
   *
   * For any organization ID and file path, extracting the organization ID
   * from a properly formatted key should return the original organization ID.
   */
  it('should correctly extract organization ID from file key', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-zA-Z0-9._-]+$/.test(s)),
        (organizationId, fileName) => {
          // Create a key with the organization prefix
          const key = `${organizationId}/${Date.now()}-${fileName}`;

          // Extract should return the original organization ID
          const extractedOrgId = fileService.extractOrganizationId(key);
          expect(extractedOrgId).toBe(organizationId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7e: Keys without proper prefix are rejected
   *
   * For any key that doesn't start with the organization ID prefix,
   * access should be denied with a 403 Forbidden error.
   */
  it('should reject keys without proper organization prefix', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0 && !s.includes('/')),
        (organizationId, invalidKey) => {
          // Key without any slash (no org prefix structure)
          expect(() => fileService.validateFileAccess(invalidKey, organizationId)).toThrow(AppError);

          try {
            fileService.validateFileAccess(invalidKey, organizationId);
          } catch (error) {
            expect(error).toBeInstanceOf(AppError);
            expect((error as AppError).statusCode).toBe(403);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
