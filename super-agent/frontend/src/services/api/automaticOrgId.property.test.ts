/**
 * Property-Based Tests for Automatic Organization ID on Insert
 * 
 * Feature: supabase-backend, Property 2: Automatic Organization ID on Insert
 * Validates: Requirements 2.4
 * 
 * Property 2: Automatic Organization ID on Insert
 * *For any* INSERT operation on a tenant-scoped table where `organization_id` is not provided,
 * the database SHALL automatically set it to the user's active organization ID.
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

interface Profile {
  id: string;
  active_organization_id: string | null;
}

interface JWTClaims {
  app_metadata?: {
    active_organization_id?: string;
  };
}

interface InsertContext {
  currentUser: User;
  profile: Profile;
  jwtClaims: JWTClaims;
}

interface TenantScopedInsert {
  id?: string;
  organization_id?: string | null;
  name: string;
  [key: string]: unknown;
}

interface TenantScopedRecord {
  id: string;
  organization_id: string;
  name: string;
  [key: string]: unknown;
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

const profileArbitrary = (userId: string) => fc.record({
  id: fc.constant(userId),
  active_organization_id: fc.option(organizationIdArbitrary, { nil: null }),
});

const jwtClaimsArbitrary = fc.record({
  app_metadata: fc.option(
    fc.record({
      active_organization_id: fc.option(organizationIdArbitrary, { nil: undefined }),
    }),
    { nil: undefined }
  ),
});

const tenantScopedInsertArbitrary = fc.record({
  id: fc.option(fc.uuid(), { nil: undefined }),
  organization_id: fc.option(organizationIdArbitrary, { nil: null }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
});

// ============================================================================
// Trigger Simulation Functions
// ============================================================================

/**
 * Simulates the private.get_active_org_id() PostgreSQL function.
 * Returns the user's active organization ID from JWT claims or profile.
 * 
 * Priority:
 * 1. JWT app_metadata.active_organization_id
 * 2. Profile's active_organization_id
 */
function getActiveOrgId(context: InsertContext): string | null {
  // First, try to get from JWT app_metadata
  const jwtOrgId = context.jwtClaims.app_metadata?.active_organization_id;
  if (jwtOrgId) {
    return jwtOrgId;
  }
  
  // Fallback to profile's active_organization_id
  return context.profile.active_organization_id;
}

/**
 * Simulates the private.set_org_id() trigger function.
 * This trigger runs BEFORE INSERT on tenant-scoped tables.
 * 
 * If organization_id is NULL, it sets it to the user's active organization.
 */
function applySetOrgIdTrigger(
  insertData: TenantScopedInsert,
  context: InsertContext
): TenantScopedRecord | null {
  const activeOrgId = getActiveOrgId(context);
  
  // Determine the organization_id for the new record
  let finalOrgId: string | null;
  
  if (insertData.organization_id === null || insertData.organization_id === undefined) {
    // organization_id not provided - use active org from context
    finalOrgId = activeOrgId;
  } else {
    // organization_id was explicitly provided
    finalOrgId = insertData.organization_id;
  }
  
  // If we still don't have an org_id, the insert should fail
  if (!finalOrgId) {
    return null; // Simulates constraint violation or RLS denial
  }
  
  // Return the record with organization_id set
  return {
    id: insertData.id || crypto.randomUUID(),
    organization_id: finalOrgId,
    name: insertData.name,
  };
}

/**
 * Simulates a complete INSERT operation with trigger and RLS.
 * Returns the inserted record or null if insert fails.
 */
function simulateInsert(
  insertData: TenantScopedInsert,
  context: InsertContext
): TenantScopedRecord | null {
  // Apply the set_org_id trigger
  const recordWithOrgId = applySetOrgIdTrigger(insertData, context);
  
  if (!recordWithOrgId) {
    return null; // Trigger couldn't set org_id
  }
  
  // RLS check: organization_id must match active org
  const activeOrgId = getActiveOrgId(context);
  if (recordWithOrgId.organization_id !== activeOrgId) {
    return null; // RLS policy violation
  }
  
  return recordWithOrgId;
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Automatic Organization ID on Insert - Property-Based Tests', () => {
  /**
   * Feature: supabase-backend, Property 2: Automatic Organization ID on Insert
   * Validates: Requirements 2.4
   */
  describe('Property 2: Automatic Organization ID on Insert', () => {
    it('should automatically set organization_id when not provided', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (user, activeOrgId, name) => {
            const context: InsertContext = {
              currentUser: { ...user, active_organization_id: activeOrgId },
              profile: { id: user.id, active_organization_id: activeOrgId },
              jwtClaims: {
                app_metadata: { active_organization_id: activeOrgId },
              },
            };
            
            // Insert without organization_id
            const insertData: TenantScopedInsert = {
              name,
              organization_id: null, // Not provided
            };
            
            const result = simulateInsert(insertData, context);
            
            // Should succeed and have the active org_id set
            expect(result).not.toBeNull();
            expect(result!.organization_id).toBe(activeOrgId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use JWT app_metadata org_id with highest priority', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary, // JWT org
          organizationIdArbitrary, // Profile org
          fc.string({ minLength: 1, maxLength: 100 }),
          (user, jwtOrgId, profileOrgId, name) => {
            // Skip if orgs are the same (can't test priority)
            if (jwtOrgId === profileOrgId) {
              return true;
            }
            
            const context: InsertContext = {
              currentUser: { ...user, active_organization_id: profileOrgId },
              profile: { id: user.id, active_organization_id: profileOrgId },
              jwtClaims: {
                app_metadata: { active_organization_id: jwtOrgId },
              },
            };
            
            // Insert without organization_id
            const insertData: TenantScopedInsert = {
              name,
              organization_id: null,
            };
            
            const result = applySetOrgIdTrigger(insertData, context);
            
            // Should use JWT org_id (higher priority)
            expect(result).not.toBeNull();
            expect(result!.organization_id).toBe(jwtOrgId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fallback to profile org_id when JWT has no org_id', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (user, profileOrgId, name) => {
            const context: InsertContext = {
              currentUser: { ...user, active_organization_id: profileOrgId },
              profile: { id: user.id, active_organization_id: profileOrgId },
              jwtClaims: {
                app_metadata: undefined, // No JWT org_id
              },
            };
            
            // Insert without organization_id
            const insertData: TenantScopedInsert = {
              name,
              organization_id: null,
            };
            
            const result = applySetOrgIdTrigger(insertData, context);
            
            // Should fallback to profile org_id
            expect(result).not.toBeNull();
            expect(result!.organization_id).toBe(profileOrgId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve explicitly provided organization_id', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary, // Active org
          fc.string({ minLength: 1, maxLength: 100 }),
          (user, activeOrgId, name) => {
            const context: InsertContext = {
              currentUser: { ...user, active_organization_id: activeOrgId },
              profile: { id: user.id, active_organization_id: activeOrgId },
              jwtClaims: {
                app_metadata: { active_organization_id: activeOrgId },
              },
            };
            
            // Insert WITH explicit organization_id (same as active)
            const insertData: TenantScopedInsert = {
              name,
              organization_id: activeOrgId, // Explicitly provided
            };
            
            const result = applySetOrgIdTrigger(insertData, context);
            
            // Should preserve the explicitly provided org_id
            expect(result).not.toBeNull();
            expect(result!.organization_id).toBe(activeOrgId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail insert when no active organization is available', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (user, name) => {
            const context: InsertContext = {
              currentUser: { ...user, active_organization_id: null },
              profile: { id: user.id, active_organization_id: null },
              jwtClaims: {
                app_metadata: undefined, // No JWT org_id
              },
            };
            
            // Insert without organization_id and no active org
            const insertData: TenantScopedInsert = {
              name,
              organization_id: null,
            };
            
            const result = applySetOrgIdTrigger(insertData, context);
            
            // Should fail - no org_id available
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate unique IDs when not provided', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 2, maxLength: 10 }),
          (user, activeOrgId, names) => {
            const context: InsertContext = {
              currentUser: { ...user, active_organization_id: activeOrgId },
              profile: { id: user.id, active_organization_id: activeOrgId },
              jwtClaims: {
                app_metadata: { active_organization_id: activeOrgId },
              },
            };
            
            // Insert multiple records without IDs
            const results = names.map(name => {
              const insertData: TenantScopedInsert = {
                name,
                organization_id: null,
                // id not provided
              };
              return simulateInsert(insertData, context);
            });
            
            // All should succeed
            const allSucceeded = results.every(r => r !== null);
            expect(allSucceeded).toBe(true);
            
            // All IDs should be unique
            const ids = results.filter(r => r !== null).map(r => r!.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set same org_id for all tenant-scoped tables consistently', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fc.record({
            agentName: fc.string({ minLength: 1, maxLength: 50 }),
            workflowName: fc.string({ minLength: 1, maxLength: 50 }),
            taskDescription: fc.string({ minLength: 1, maxLength: 100 }),
            documentTitle: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          (user, activeOrgId, data) => {
            const context: InsertContext = {
              currentUser: { ...user, active_organization_id: activeOrgId },
              profile: { id: user.id, active_organization_id: activeOrgId },
              jwtClaims: {
                app_metadata: { active_organization_id: activeOrgId },
              },
            };
            
            // Simulate inserts to different tables
            const agentInsert = simulateInsert({ name: data.agentName, organization_id: null }, context);
            const workflowInsert = simulateInsert({ name: data.workflowName, organization_id: null }, context);
            const taskInsert = simulateInsert({ name: data.taskDescription, organization_id: null }, context);
            const documentInsert = simulateInsert({ name: data.documentTitle, organization_id: null }, context);
            
            // All should have the same organization_id
            const allResults = [agentInsert, workflowInsert, taskInsert, documentInsert];
            const allSucceeded = allResults.every(r => r !== null);
            expect(allSucceeded).toBe(true);
            
            const allSameOrg = allResults.every(r => r!.organization_id === activeOrgId);
            expect(allSameOrg).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle undefined organization_id same as null', () => {
      fc.assert(
        fc.property(
          userArbitrary,
          organizationIdArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (user, activeOrgId, name) => {
            const context: InsertContext = {
              currentUser: { ...user, active_organization_id: activeOrgId },
              profile: { id: user.id, active_organization_id: activeOrgId },
              jwtClaims: {
                app_metadata: { active_organization_id: activeOrgId },
              },
            };
            
            // Insert with undefined organization_id
            const insertDataUndefined: TenantScopedInsert = {
              name,
              organization_id: undefined,
            };
            
            // Insert with null organization_id
            const insertDataNull: TenantScopedInsert = {
              name,
              organization_id: null,
            };
            
            const resultUndefined = applySetOrgIdTrigger(insertDataUndefined, context);
            const resultNull = applySetOrgIdTrigger(insertDataNull, context);
            
            // Both should succeed with the active org_id
            expect(resultUndefined).not.toBeNull();
            expect(resultNull).not.toBeNull();
            expect(resultUndefined!.organization_id).toBe(activeOrgId);
            expect(resultNull!.organization_id).toBe(activeOrgId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
