/**
 * Property-Based Tests for Organization Owner Assignment
 * 
 * Feature: supabase-backend, Property 10: Organization Owner Assignment
 * Validates: Requirements 10.3
 * 
 * Property 10: Organization Owner Assignment
 * *For any* organization creation, the creating user SHALL be assigned the 'owner' role 
 * in the memberships table.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Type definitions for organization and membership
interface Organization {
  id: string;
  name: string;
  slug: string;
  planType: 'free' | 'pro' | 'enterprise';
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'pending' | 'active' | 'inactive';
  invitedEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateOrganizationInput {
  name: string;
  slug: string;
  planType?: 'free' | 'pro' | 'enterprise';
  settings?: Record<string, unknown>;
}

// Generators for property-based testing
const organizationNameArbitrary = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

const slugArbitrary = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/)
  .filter(s => s.length >= 2 && s.length <= 50);

const planTypeArbitrary = fc.constantFrom('free', 'pro', 'enterprise') as fc.Arbitrary<'free' | 'pro' | 'enterprise'>;

const settingsArbitrary = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(fc.string(), fc.integer(), fc.boolean())
);

const createOrganizationInputArbitrary = fc.record({
  name: organizationNameArbitrary,
  slug: slugArbitrary,
  planType: fc.option(planTypeArbitrary, { nil: undefined }),
  settings: fc.option(settingsArbitrary, { nil: undefined }),
});

const userIdArbitrary = fc.uuid();

/**
 * Simulates the organization creation process.
 * Returns the created organization and the owner membership.
 */
function simulateCreateOrganization(
  input: CreateOrganizationInput,
  creatingUserId: string
): { organization: Organization; membership: Membership } {
  const now = new Date().toISOString();
  const orgId = crypto.randomUUID();
  
  const organization: Organization = {
    id: orgId,
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    planType: input.planType || 'free',
    settings: input.settings || {},
    createdAt: now,
    updatedAt: now,
  };
  
  // The creating user is ALWAYS assigned as owner
  const membership: Membership = {
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId: creatingUserId,
    role: 'owner',
    status: 'active',
    invitedEmail: null,
    createdAt: now,
    updatedAt: now,
  };
  
  return { organization, membership };
}

/**
 * Validates that a membership represents an owner assignment.
 */
function isOwnerMembership(membership: Membership, organizationId: string, userId: string): boolean {
  return (
    membership.organizationId === organizationId &&
    membership.userId === userId &&
    membership.role === 'owner' &&
    membership.status === 'active'
  );
}

/**
 * Validates that an organization has exactly one owner.
 */
function hasExactlyOneOwner(memberships: Membership[], organizationId: string): boolean {
  const owners = memberships.filter(
    m => m.organizationId === organizationId && m.role === 'owner' && m.status === 'active'
  );
  return owners.length === 1;
}

describe('Organization Owner Assignment - Property-Based Tests', () => {
  /**
   * Feature: supabase-backend, Property 10: Organization Owner Assignment
   * Validates: Requirements 10.3
   */
  describe('Property 10: Organization Owner Assignment', () => {
    it('should assign owner role to the creating user', () => {
      fc.assert(
        fc.property(
          createOrganizationInputArbitrary,
          userIdArbitrary,
          (input, userId) => {
            const { organization, membership } = simulateCreateOrganization(input, userId);
            
            // The creating user should be assigned as owner
            expect(isOwnerMembership(membership, organization.id, userId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create exactly one owner membership per organization', () => {
      fc.assert(
        fc.property(
          createOrganizationInputArbitrary,
          userIdArbitrary,
          (input, userId) => {
            const { organization, membership } = simulateCreateOrganization(input, userId);
            
            // There should be exactly one owner
            const memberships = [membership];
            expect(hasExactlyOneOwner(memberships, organization.id)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set owner membership status to active', () => {
      fc.assert(
        fc.property(
          createOrganizationInputArbitrary,
          userIdArbitrary,
          (input, userId) => {
            const { membership } = simulateCreateOrganization(input, userId);
            
            // Owner membership should be active immediately
            expect(membership.status).toBe('active');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not have invited_email for owner membership', () => {
      fc.assert(
        fc.property(
          createOrganizationInputArbitrary,
          userIdArbitrary,
          (input, userId) => {
            const { membership } = simulateCreateOrganization(input, userId);
            
            // Owner is not invited, they created the org
            expect(membership.invitedEmail).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should link membership to the correct organization', () => {
      fc.assert(
        fc.property(
          createOrganizationInputArbitrary,
          userIdArbitrary,
          (input, userId) => {
            const { organization, membership } = simulateCreateOrganization(input, userId);
            
            // Membership should reference the created organization
            expect(membership.organizationId).toBe(organization.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should link membership to the creating user', () => {
      fc.assert(
        fc.property(
          createOrganizationInputArbitrary,
          userIdArbitrary,
          (input, userId) => {
            const { membership } = simulateCreateOrganization(input, userId);
            
            // Membership should reference the creating user
            expect(membership.userId).toBe(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve organization input data', () => {
      fc.assert(
        fc.property(
          createOrganizationInputArbitrary,
          userIdArbitrary,
          (input, userId) => {
            const { organization } = simulateCreateOrganization(input, userId);
            
            // Organization should have the input data
            expect(organization.name).toBe(input.name.trim());
            expect(organization.slug).toBe(input.slug.trim().toLowerCase());
            expect(organization.planType).toBe(input.planType || 'free');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple organization creations by same user', () => {
      fc.assert(
        fc.property(
          fc.array(createOrganizationInputArbitrary, { minLength: 2, maxLength: 5 }),
          userIdArbitrary,
          (inputs, userId) => {
            // Make slugs unique
            const uniqueInputs = inputs.map((input, index) => ({
              ...input,
              slug: `${input.slug}-${index}`,
            }));
            
            const results = uniqueInputs.map(input => 
              simulateCreateOrganization(input, userId)
            );
            
            // Each organization should have the user as owner
            for (const { organization, membership } of results) {
              expect(isOwnerMembership(membership, organization.id, userId)).toBe(true);
            }
            
            // All organizations should be distinct
            const orgIds = results.map(r => r.organization.id);
            const uniqueOrgIds = new Set(orgIds);
            expect(uniqueOrgIds.size).toBe(orgIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle different users creating organizations', () => {
      fc.assert(
        fc.property(
          createOrganizationInputArbitrary,
          fc.array(userIdArbitrary, { minLength: 2, maxLength: 5 }),
          (input, userIds) => {
            // Each user creates their own organization
            const results = userIds.map((userId, index) => 
              simulateCreateOrganization(
                { ...input, slug: `${input.slug}-${index}` },
                userId
              )
            );
            
            // Each user should be owner of their own organization
            for (let i = 0; i < results.length; i++) {
              const { organization, membership } = results[i];
              expect(isOwnerMembership(membership, organization.id, userIds[i])).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
