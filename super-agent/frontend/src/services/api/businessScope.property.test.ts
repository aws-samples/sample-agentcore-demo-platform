/**
 * Property-Based Tests for Business Scope Uniqueness
 * 
 * Feature: supabase-backend, Property 18: Business Scope Uniqueness
 * Validates: Requirements 4.3
 * 
 * Property 18: Business Scope Uniqueness
 * *For any* business scope creation within an organization, the name SHALL be 
 * unique within that organization.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Type definitions for business scope
interface BusinessScope {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Generators for property-based testing
const organizationIdArbitrary = fc.uuid();

const businessScopeNameArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0); // Ensure non-empty after trim

// Generate a valid hex color string
const hexColorArbitrary = fc.array(
  fc.integer({ min: 0, max: 15 }).map(n => n.toString(16)),
  { minLength: 6, maxLength: 6 }
).map(arr => `#${arr.join('')}`);

// Generate valid ISO date strings using timestamp approach
const isoDateArbitrary = fc.integer({
  min: new Date('2020-01-01').getTime(),
  max: new Date('2030-12-31').getTime()
}).map(timestamp => new Date(timestamp).toISOString());

const businessScopeArbitrary = fc.record({
  id: fc.uuid(),
  organization_id: organizationIdArbitrary,
  name: businessScopeNameArbitrary,
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  icon: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  color: fc.option(hexColorArbitrary, { nil: null }),
  is_default: fc.boolean(),
  created_at: isoDateArbitrary,
  updated_at: isoDateArbitrary,
});

/**
 * Simulates the business scope uniqueness constraint at the database level.
 * This function validates that no two scopes in the same organization have the same name.
 */
function validateBusinessScopeUniqueness(scopes: BusinessScope[]): boolean {
  const scopesByOrg = new Map<string, Set<string>>();
  
  for (const scope of scopes) {
    const orgScopes = scopesByOrg.get(scope.organization_id) || new Set<string>();
    
    // Check if name already exists in this organization
    if (orgScopes.has(scope.name.toLowerCase())) {
      return false; // Duplicate found - constraint violated
    }
    
    orgScopes.add(scope.name.toLowerCase());
    scopesByOrg.set(scope.organization_id, orgScopes);
  }
  
  return true; // All scopes are unique within their organizations
}

/**
 * Simulates attempting to insert a business scope with uniqueness validation.
 * Returns true if insert would succeed, false if it would violate uniqueness.
 */
function canInsertBusinessScope(
  existingScopes: BusinessScope[],
  newScope: BusinessScope
): boolean {
  const orgScopes = existingScopes.filter(
    s => s.organization_id === newScope.organization_id
  );
  
  // Check if any existing scope in the same org has the same name (case-insensitive)
  return !orgScopes.some(
    s => s.name.toLowerCase() === newScope.name.toLowerCase()
  );
}

describe('Business Scope Uniqueness - Property-Based Tests', () => {
  /**
   * Feature: supabase-backend, Property 18: Business Scope Uniqueness
   * Validates: Requirements 4.3
   */
  describe('Property 18: Business Scope Uniqueness', () => {
    it('should reject duplicate scope names within the same organization', () => {
      fc.assert(
        fc.property(
          businessScopeArbitrary,
          fc.uuid(), // Different org ID
          (scope, differentOrgId) => {
            // Create a duplicate scope with same name in same org
            const duplicateScope: BusinessScope = {
              ...scope,
              id: crypto.randomUUID(), // Different ID
            };
            
            const existingScopes = [scope];
            
            // Attempting to insert duplicate should fail
            const canInsert = canInsertBusinessScope(existingScopes, duplicateScope);
            expect(canInsert).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow same scope name in different organizations', () => {
      fc.assert(
        fc.property(
          businessScopeArbitrary,
          fc.uuid(), // Different org ID
          (scope, differentOrgId) => {
            // Create a scope with same name but different organization
            const scopeInDifferentOrg: BusinessScope = {
              ...scope,
              id: crypto.randomUUID(),
              organization_id: differentOrgId,
            };
            
            const existingScopes = [scope];
            
            // Should be able to insert same name in different org
            const canInsert = canInsertBusinessScope(existingScopes, scopeInDifferentOrg);
            expect(canInsert).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow different scope names in the same organization', () => {
      fc.assert(
        fc.property(
          businessScopeArbitrary,
          businessScopeNameArbitrary,
          (scope, differentName) => {
            // Skip if names happen to be the same
            if (differentName.toLowerCase() === scope.name.toLowerCase()) {
              return true;
            }
            
            // Create a scope with different name in same org
            const differentScope: BusinessScope = {
              ...scope,
              id: crypto.randomUUID(),
              name: differentName,
            };
            
            const existingScopes = [scope];
            
            // Should be able to insert different name in same org
            const canInsert = canInsertBusinessScope(existingScopes, differentScope);
            expect(canInsert).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate uniqueness across multiple scopes in an organization', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // Organization ID
          fc.array(businessScopeNameArbitrary, { minLength: 1, maxLength: 10 }),
          (orgId, names) => {
            // Create scopes with unique names
            const uniqueNames = [...new Set(names.map(n => n.toLowerCase()))];
            const scopes: BusinessScope[] = uniqueNames.map((name, index) => ({
              id: crypto.randomUUID(),
              organization_id: orgId,
              name: names[index] || name, // Use original casing
              description: null,
              icon: null,
              color: null,
              is_default: index === 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }));
            
            // All scopes should pass uniqueness validation
            const isValid = validateBusinessScopeUniqueness(scopes);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect uniqueness violations in a collection of scopes', () => {
      fc.assert(
        fc.property(
          businessScopeArbitrary,
          (scope) => {
            // Create a collection with a duplicate
            const duplicateScope: BusinessScope = {
              ...scope,
              id: crypto.randomUUID(),
            };
            
            const scopesWithDuplicate = [scope, duplicateScope];
            
            // Should detect the uniqueness violation
            const isValid = validateBusinessScopeUniqueness(scopesWithDuplicate);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle case-insensitive name comparison', () => {
      fc.assert(
        fc.property(
          businessScopeArbitrary,
          (scope) => {
            // Create a scope with same name but different case
            const upperCaseScope: BusinessScope = {
              ...scope,
              id: crypto.randomUUID(),
              name: scope.name.toUpperCase(),
            };
            
            const lowerCaseScope: BusinessScope = {
              ...scope,
              id: crypto.randomUUID(),
              name: scope.name.toLowerCase(),
            };
            
            const existingScopes = [scope];
            
            // Both should be rejected as duplicates (case-insensitive)
            const canInsertUpper = canInsertBusinessScope(existingScopes, upperCaseScope);
            const canInsertLower = canInsertBusinessScope(existingScopes, lowerCaseScope);
            
            expect(canInsertUpper).toBe(false);
            expect(canInsertLower).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty scope collections', () => {
      fc.assert(
        fc.property(
          businessScopeArbitrary,
          (scope) => {
            const existingScopes: BusinessScope[] = [];
            
            // Should always be able to insert into empty collection
            const canInsert = canInsertBusinessScope(existingScopes, scope);
            expect(canInsert).toBe(true);
            
            // Empty collection should pass validation
            const isValid = validateBusinessScopeUniqueness(existingScopes);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
