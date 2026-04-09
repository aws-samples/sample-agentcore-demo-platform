/**
 * Property-Based Tests for Storage Tenant Isolation
 * 
 * Feature: supabase-backend, Property 3: Storage Tenant Isolation
 * Validates: Requirements 2.6, 2.7, 7.5
 * 
 * Property 3: Storage Tenant Isolation
 * *For any* storage operation (upload, download, delete), the file path SHALL contain 
 * the organization ID prefix, and access SHALL be restricted to members of that organization.
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

interface Membership {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'pending' | 'active' | 'inactive';
}

interface StorageObject {
  id: string;
  bucket_id: string;
  name: string; // Full path including org prefix: {org_id}/{filename}
  owner: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

interface StorageContext {
  currentUser: User;
  memberships: Membership[];
}

type StorageOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

// ============================================================================
// Generators
// ============================================================================

const userIdArbitrary = fc.uuid();
const organizationIdArbitrary = fc.uuid();
const emailArbitrary = fc.emailAddress();

const roleArbitrary = fc.constantFrom<'owner' | 'admin' | 'member' | 'viewer'>(
  'owner', 'admin', 'member', 'viewer'
);

const membershipStatusArbitrary = fc.constantFrom<'pending' | 'active' | 'inactive'>(
  'pending', 'active', 'inactive'
);

const userArbitrary = fc.record({
  id: userIdArbitrary,
  email: emailArbitrary,
  active_organization_id: fc.option(organizationIdArbitrary, { nil: null }),
});

// Generate valid file names (alphanumeric with common extensions)
const fileNameArbitrary = fc.tuple(
  fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/),
  fc.constantFrom('.pdf', '.txt', '.md', '.docx')
).map(([name, ext]) => `${name || 'file'}${ext}`);

// Generate valid ISO date strings
const isoDateArbitrary = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime()
}).map(timestamp => new Date(timestamp).toISOString());

// Generate storage object with organization prefix in path
const storageObjectArbitrary = (orgId: string) => fc.record({
  id: fc.uuid(),
  bucket_id: fc.constant('documents'),
  name: fileNameArbitrary.map(fileName => `${orgId}/${fileName}`),
  owner: fc.option(userIdArbitrary, { nil: null }),
  created_at: isoDateArbitrary,
  updated_at: isoDateArbitrary,
  metadata: fc.constant({}),
});

const storageOperationArbitrary = fc.constantFrom<StorageOperation>(
  'SELECT', 'INSERT', 'UPDATE', 'DELETE'
);

// ============================================================================
// Storage Policy Simulation Functions
// ============================================================================

/**
 * Simulates the get_active_org_id() PostgreSQL function.
 * Returns the user's active organization ID.
 */
function getActiveOrgId(context: StorageContext): string | null {
  return context.currentUser.active_organization_id;
}

/**
 * Extracts the organization ID from a storage path.
 * Storage paths follow the convention: {organization_id}/{filename}
 */
function extractOrgIdFromPath(path: string): string | null {
  const parts = path.split('/');
  if (parts.length < 2) {
    return null;
  }
  return parts[0];
}

/**
 * Validates that a storage path has the correct organization prefix.
 * Requirements: 2.6 - Files organized by organization_id prefix
 */
function hasValidOrgPrefix(path: string, expectedOrgId: string): boolean {
  const pathOrgId = extractOrgIdFromPath(path);
  return pathOrgId === expectedOrgId;
}

/**
 * Simulates storage policy check for SELECT (download) operations.
 * Requirements: 7.5 - Storage bucket enforces organization-based access
 */
function canSelectStorageObject(
  object: StorageObject,
  context: StorageContext
): boolean {
  const activeOrgId = getActiveOrgId(context);
  
  if (!activeOrgId) {
    return false;
  }
  
  if (object.bucket_id !== 'documents') {
    return false;
  }
  
  return hasValidOrgPrefix(object.name, activeOrgId);
}

/**
 * Simulates storage policy check for INSERT (upload) operations.
 * Requirements: 2.6, 7.5 - Files must be uploaded to org folder
 */
function canInsertStorageObject(
  path: string,
  bucketId: string,
  context: StorageContext
): boolean {
  const activeOrgId = getActiveOrgId(context);
  
  if (!activeOrgId) {
    return false;
  }
  
  if (bucketId !== 'documents') {
    return false;
  }
  
  return hasValidOrgPrefix(path, activeOrgId);
}

/**
 * Simulates storage policy check for UPDATE operations.
 * Requirements: 2.7, 7.5 - Can only update files in own org folder
 */
function canUpdateStorageObject(
  object: StorageObject,
  newPath: string,
  context: StorageContext
): boolean {
  const activeOrgId = getActiveOrgId(context);
  
  if (!activeOrgId) {
    return false;
  }
  
  if (object.bucket_id !== 'documents') {
    return false;
  }
  
  // Both current and new path must be in user's org folder
  return hasValidOrgPrefix(object.name, activeOrgId) && 
         hasValidOrgPrefix(newPath, activeOrgId);
}

/**
 * Simulates storage policy check for DELETE operations.
 * Requirements: 2.7, 7.5 - Can only delete files in own org folder
 */
function canDeleteStorageObject(
  object: StorageObject,
  context: StorageContext
): boolean {
  const activeOrgId = getActiveOrgId(context);
  
  if (!activeOrgId) {
    return false;
  }
  
  if (object.bucket_id !== 'documents') {
    return false;
  }
  
  return hasValidOrgPrefix(object.name, activeOrgId);
}

/**
 * Filters storage objects based on RLS policies.
 * Returns only objects the user has access to.
 */
function filterStorageObjects(
  objects: StorageObject[],
  context: StorageContext
): StorageObject[] {
  return objects.filter(obj => canSelectStorageObject(obj, context));
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Storage Tenant Isolation - Property-Based Tests', () => {
  /**
   * Feature: supabase-backend, Property 3: Storage Tenant Isolation
   * Validates: Requirements 2.6, 2.7, 7.5
   */
  describe('Property 3: Storage Tenant Isolation', () => {
    it('should only allow access to files with matching organization prefix', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fileNameArbitrary,
          (user, activeOrgId, fileName) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: StorageContext = {
              currentUser: userWithOrg,
              memberships: [{
                id: crypto.randomUUID(),
                organization_id: activeOrgId,
                user_id: userWithOrg.id,
                role: 'member',
                status: 'active',
              }],
            };
            
            // Object in user's org folder
            const ownOrgObject: StorageObject = {
              id: crypto.randomUUID(),
              bucket_id: 'documents',
              name: `${activeOrgId}/${fileName}`,
              owner: userWithOrg.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: {},
            };
            
            // Object in different org folder
            const otherOrgId = crypto.randomUUID();
            const otherOrgObject: StorageObject = {
              id: crypto.randomUUID(),
              bucket_id: 'documents',
              name: `${otherOrgId}/${fileName}`,
              owner: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: {},
            };
            
            // Should allow access to own org files
            expect(canSelectStorageObject(ownOrgObject, context)).toBe(true);
            
            // Should deny access to other org files
            expect(canSelectStorageObject(otherOrgObject, context)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require organization prefix in file path for uploads', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fileNameArbitrary,
          (user, activeOrgId, fileName) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: StorageContext = {
              currentUser: userWithOrg,
              memberships: [{
                id: crypto.randomUUID(),
                organization_id: activeOrgId,
                user_id: userWithOrg.id,
                role: 'member',
                status: 'active',
              }],
            };
            
            // Valid path with org prefix
            const validPath = `${activeOrgId}/${fileName}`;
            
            // Invalid path without org prefix
            const invalidPath = fileName;
            
            // Invalid path with wrong org prefix
            const wrongOrgPath = `${crypto.randomUUID()}/${fileName}`;
            
            // Should allow upload to own org folder
            expect(canInsertStorageObject(validPath, 'documents', context)).toBe(true);
            
            // Should deny upload without org prefix
            expect(canInsertStorageObject(invalidPath, 'documents', context)).toBe(false);
            
            // Should deny upload to other org folder
            expect(canInsertStorageObject(wrongOrgPath, 'documents', context)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should deny all storage operations when user has no active organization', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fileNameArbitrary,
          storageOperationArbitrary,
          (user, orgId, fileName, operation) => {
            // User with no active organization
            const userWithoutOrg: User = {
              ...user,
              active_organization_id: null,
            };
            
            const context: StorageContext = {
              currentUser: userWithoutOrg,
              memberships: [],
            };
            
            const storageObject: StorageObject = {
              id: crypto.randomUUID(),
              bucket_id: 'documents',
              name: `${orgId}/${fileName}`,
              owner: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: {},
            };
            
            // All operations should be denied
            switch (operation) {
              case 'SELECT':
                expect(canSelectStorageObject(storageObject, context)).toBe(false);
                break;
              case 'INSERT':
                expect(canInsertStorageObject(storageObject.name, 'documents', context)).toBe(false);
                break;
              case 'UPDATE':
                expect(canUpdateStorageObject(storageObject, storageObject.name, context)).toBe(false);
                break;
              case 'DELETE':
                expect(canDeleteStorageObject(storageObject, context)).toBe(false);
                break;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter storage objects to only those in user active organization', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fc.array(organizationIdArbitrary, { minLength: 2, maxLength: 5 }),
          fc.array(fileNameArbitrary, { minLength: 3, maxLength: 10 }),
          (user, activeOrgId, otherOrgIds, fileNames) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: StorageContext = {
              currentUser: userWithOrg,
              memberships: [{
                id: crypto.randomUUID(),
                organization_id: activeOrgId,
                user_id: userWithOrg.id,
                role: 'member',
                status: 'active',
              }],
            };
            
            // Create objects across multiple organizations
            const allOrgIds = [activeOrgId, ...otherOrgIds];
            const objects: StorageObject[] = fileNames.map((fileName, index) => ({
              id: crypto.randomUUID(),
              bucket_id: 'documents',
              name: `${allOrgIds[index % allOrgIds.length]}/${fileName}`,
              owner: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: {},
            }));
            
            const filteredObjects = filterStorageObjects(objects, context);
            
            // All filtered objects must belong to user's active organization
            const allMatchActiveOrg = filteredObjects.every(obj => 
              extractOrgIdFromPath(obj.name) === activeOrgId
            );
            
            expect(allMatchActiveOrg).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent cross-tenant file access even with direct path', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          organizationIdArbitrary,
          fileNameArbitrary,
          (user, userOrgId, targetOrgId, fileName) => {
            // Skip if orgs happen to be the same
            if (userOrgId === targetOrgId) {
              return true;
            }
            
            const userWithOrg: User = {
              ...user,
              active_organization_id: userOrgId,
            };
            
            const context: StorageContext = {
              currentUser: userWithOrg,
              memberships: [{
                id: crypto.randomUUID(),
                organization_id: userOrgId,
                user_id: userWithOrg.id,
                role: 'member',
                status: 'active',
              }],
            };
            
            // File in another organization's folder
            const crossTenantObject: StorageObject = {
              id: crypto.randomUUID(),
              bucket_id: 'documents',
              name: `${targetOrgId}/${fileName}`,
              owner: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: {},
            };
            
            // All operations on cross-tenant files should be denied
            expect(canSelectStorageObject(crossTenantObject, context)).toBe(false);
            expect(canDeleteStorageObject(crossTenantObject, context)).toBe(false);
            expect(canUpdateStorageObject(crossTenantObject, crossTenantObject.name, context)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only allow operations on documents bucket', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fileNameArbitrary,
          fc.constantFrom('other-bucket', 'private', 'public', 'avatars'),
          (user, activeOrgId, fileName, wrongBucket) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: StorageContext = {
              currentUser: userWithOrg,
              memberships: [{
                id: crypto.randomUUID(),
                organization_id: activeOrgId,
                user_id: userWithOrg.id,
                role: 'member',
                status: 'active',
              }],
            };
            
            // Object with correct org prefix but wrong bucket
            const wrongBucketObject: StorageObject = {
              id: crypto.randomUUID(),
              bucket_id: wrongBucket,
              name: `${activeOrgId}/${fileName}`,
              owner: userWithOrg.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: {},
            };
            
            // Should deny access to wrong bucket
            expect(canSelectStorageObject(wrongBucketObject, context)).toBe(false);
            expect(canInsertStorageObject(wrongBucketObject.name, wrongBucket, context)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate organization prefix extraction from paths', () => {
      fc.assert(
        fc.property(
          organizationIdArbitrary,
          fileNameArbitrary,
          fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/), { minLength: 0, maxLength: 3 }),
          (orgId, fileName, subfolders) => {
            // Simple path: org_id/filename
            const simplePath = `${orgId}/${fileName}`;
            expect(extractOrgIdFromPath(simplePath)).toBe(orgId);
            
            // Nested path: org_id/subfolder/filename
            if (subfolders.length > 0) {
              const nestedPath = `${orgId}/${subfolders.join('/')}/${fileName}`;
              expect(extractOrgIdFromPath(nestedPath)).toBe(orgId);
            }
            
            // Invalid path without org prefix
            expect(extractOrgIdFromPath(fileName)).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce UPDATE policy requires both old and new paths in same org', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fileNameArbitrary,
          fileNameArbitrary,
          (user, activeOrgId, oldFileName, newFileName) => {
            const userWithOrg: User = {
              ...user,
              active_organization_id: activeOrgId,
            };
            
            const context: StorageContext = {
              currentUser: userWithOrg,
              memberships: [{
                id: crypto.randomUUID(),
                organization_id: activeOrgId,
                user_id: userWithOrg.id,
                role: 'member',
                status: 'active',
              }],
            };
            
            const existingObject: StorageObject = {
              id: crypto.randomUUID(),
              bucket_id: 'documents',
              name: `${activeOrgId}/${oldFileName}`,
              owner: userWithOrg.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              metadata: {},
            };
            
            // Valid update: same org folder
            const validNewPath = `${activeOrgId}/${newFileName}`;
            expect(canUpdateStorageObject(existingObject, validNewPath, context)).toBe(true);
            
            // Invalid update: moving to different org folder
            const otherOrgId = crypto.randomUUID();
            const invalidNewPath = `${otherOrgId}/${newFileName}`;
            expect(canUpdateStorageObject(existingObject, invalidNewPath, context)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
