/**
 * Property-based tests for Role-Based Access Control
 *
 * Feature: unified-ecs-backend
 * Property 6: Role-Based Access Control
 * Validates: Requirements 2.6, 2.7
 *
 * For any user with role 'viewer' and any modification request
 * (POST, PUT, PATCH, DELETE on non-read endpoints), the API should
 * return a 403 Forbidden response.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { requireRole, requireModifyAccess, requireAdminAccess, requireOwnerAccess } from '../../src/middleware/auth.js';
import type { UserRole } from '../../src/types/index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

describe('Role-Based Access Control Properties', () => {
  /**
   * Create a mock FastifyRequest with the specified user role
   */
  const createMockRequest = (role: UserRole | null): FastifyRequest => {
    const request = {
      id: 'test-request-id',
      user: role ? { id: 'user-1', email: 'test@example.com', orgId: 'org-1', role } : undefined,
    } as unknown as FastifyRequest;
    return request;
  };

  /**
   * Create a mock FastifyReply that captures the response
   */
  const createMockReply = () => {
    let statusCode: number | undefined;
    let responseBody: unknown;

    const reply = {
      status: vi.fn((code: number) => {
        statusCode = code;
        return reply;
      }),
      send: vi.fn((body: unknown) => {
        responseBody = body;
        return reply;
      }),
      getStatusCode: () => statusCode,
      getResponseBody: () => responseBody,
    };

    return reply as unknown as FastifyReply & {
      getStatusCode: () => number | undefined;
      getResponseBody: () => unknown;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Generator for all valid user roles
   */
  const allRolesArbitrary = fc.constantFrom<UserRole>('owner', 'admin', 'member', 'viewer');

  /**
   * Generator for roles that can modify (non-viewer)
   */
  const modifyRolesArbitrary = fc.constantFrom<UserRole>('owner', 'admin', 'member');

  /**
   * Generator for admin roles
   */
  const adminRolesArbitrary = fc.constantFrom<UserRole>('owner', 'admin');

  /**
   * Feature: unified-ecs-backend, Property 6: Role-Based Access Control
   * Validates: Requirements 2.6, 2.7
   *
   * For any user with role 'viewer', the requireModifyAccess guard
   * should return 403 Forbidden.
   */
  it('should deny viewer role from modification operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant('viewer' as UserRole),
        async (role) => {
          const request = createMockRequest(role);
          const reply = createMockReply();

          await requireModifyAccess(request, reply);

          // Viewer should be denied
          expect(reply.getStatusCode()).toBe(403);
          const body = reply.getResponseBody() as { error: string; code: string };
          expect(body.code).toBe('FORBIDDEN');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 6: Role-Based Access Control
   * Validates: Requirements 2.6
   *
   * For any user with role 'owner', 'admin', or 'member', the requireModifyAccess
   * guard should allow access (not return 403).
   */
  it('should allow non-viewer roles for modification operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        modifyRolesArbitrary,
        async (role) => {
          const request = createMockRequest(role);
          const reply = createMockReply();

          await requireModifyAccess(request, reply);

          // Non-viewer roles should be allowed (no status set means allowed)
          expect(reply.getStatusCode()).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 6: Role-Based Access Control
   * Validates: Requirements 2.6, 2.7
   *
   * For any user with role 'viewer' or 'member', the requireAdminAccess guard
   * should return 403 Forbidden.
   */
  it('should deny non-admin roles from admin operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<UserRole>('viewer', 'member'),
        async (role) => {
          const request = createMockRequest(role);
          const reply = createMockReply();

          await requireAdminAccess(request, reply);

          // Non-admin roles should be denied
          expect(reply.getStatusCode()).toBe(403);
          const body = reply.getResponseBody() as { error: string; code: string };
          expect(body.code).toBe('FORBIDDEN');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 6: Role-Based Access Control
   * Validates: Requirements 2.6
   *
   * For any user with role 'owner' or 'admin', the requireAdminAccess guard
   * should allow access.
   */
  it('should allow admin roles for admin operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        adminRolesArbitrary,
        async (role) => {
          const request = createMockRequest(role);
          const reply = createMockReply();

          await requireAdminAccess(request, reply);

          // Admin roles should be allowed
          expect(reply.getStatusCode()).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 6: Role-Based Access Control
   * Validates: Requirements 2.6, 2.7
   *
   * For any user with role other than 'owner', the requireOwnerAccess guard
   * should return 403 Forbidden.
   */
  it('should deny non-owner roles from owner-only operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<UserRole>('admin', 'member', 'viewer'),
        async (role) => {
          const request = createMockRequest(role);
          const reply = createMockReply();

          await requireOwnerAccess(request, reply);

          // Non-owner roles should be denied
          expect(reply.getStatusCode()).toBe(403);
          const body = reply.getResponseBody() as { error: string; code: string };
          expect(body.code).toBe('FORBIDDEN');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 6: Role-Based Access Control
   * Validates: Requirements 2.6
   *
   * For any user with role 'owner', the requireOwnerAccess guard
   * should allow access.
   */
  it('should allow owner role for owner-only operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant('owner' as UserRole),
        async (role) => {
          const request = createMockRequest(role);
          const reply = createMockReply();

          await requireOwnerAccess(request, reply);

          // Owner should be allowed
          expect(reply.getStatusCode()).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 6: Role-Based Access Control
   * Validates: Requirements 2.6, 2.7
   *
   * For any unauthenticated request (no user), all role guards
   * should return 403 Forbidden.
   */
  it('should deny unauthenticated requests for all role guards', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('modify', 'admin', 'owner'),
        async (guardType) => {
          const request = createMockRequest(null);
          const reply = createMockReply();

          // Select the appropriate guard
          const guard = guardType === 'modify' 
            ? requireModifyAccess 
            : guardType === 'admin' 
              ? requireAdminAccess 
              : requireOwnerAccess;

          await guard(request, reply);

          // Unauthenticated should be denied
          expect(reply.getStatusCode()).toBe(403);
          const body = reply.getResponseBody() as { error: string; code: string };
          expect(body.code).toBe('FORBIDDEN');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 6: Role-Based Access Control
   * Validates: Requirements 2.6, 2.7
   *
   * For any custom role requirement, only users with matching roles
   * should be allowed access.
   */
  it('should correctly enforce custom role requirements', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(allRolesArbitrary, { minLength: 1, maxLength: 4 }), // allowed roles
        allRolesArbitrary, // user role
        async (allowedRoles, userRole) => {
          // Ensure unique allowed roles
          const uniqueAllowedRoles = [...new Set(allowedRoles)] as UserRole[];
          
          const request = createMockRequest(userRole);
          const reply = createMockReply();

          const guard = requireRole(...uniqueAllowedRoles);
          await guard(request, reply);

          if (uniqueAllowedRoles.includes(userRole)) {
            // User role is in allowed list - should be allowed
            expect(reply.getStatusCode()).toBeUndefined();
          } else {
            // User role is not in allowed list - should be denied
            expect(reply.getStatusCode()).toBe(403);
            const body = reply.getResponseBody() as { error: string; code: string };
            expect(body.code).toBe('FORBIDDEN');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 6: Role-Based Access Control
   * Validates: Requirements 2.6, 2.7
   *
   * Role hierarchy property: If a role is allowed for a less privileged operation,
   * it should also be allowed for more privileged operations that include it.
   * owner > admin > member > viewer
   */
  it('should maintain role hierarchy consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        allRolesArbitrary,
        async (role) => {
          const request = createMockRequest(role);
          
          // Test each guard level
          const modifyReply = createMockReply();
          const adminReply = createMockReply();
          const ownerReply = createMockReply();

          await requireModifyAccess(request, modifyReply);
          await requireAdminAccess(request, adminReply);
          await requireOwnerAccess(request, ownerReply);

          const modifyAllowed = modifyReply.getStatusCode() === undefined;
          const adminAllowed = adminReply.getStatusCode() === undefined;
          const ownerAllowed = ownerReply.getStatusCode() === undefined;

          // Hierarchy: if owner is allowed, admin should be allowed
          // if admin is allowed, modify should be allowed
          if (ownerAllowed) {
            expect(adminAllowed).toBe(true);
            expect(modifyAllowed).toBe(true);
          }
          if (adminAllowed) {
            expect(modifyAllowed).toBe(true);
          }

          // Verify expected access based on role
          switch (role) {
            case 'owner':
              expect(ownerAllowed).toBe(true);
              expect(adminAllowed).toBe(true);
              expect(modifyAllowed).toBe(true);
              break;
            case 'admin':
              expect(ownerAllowed).toBe(false);
              expect(adminAllowed).toBe(true);
              expect(modifyAllowed).toBe(true);
              break;
            case 'member':
              expect(ownerAllowed).toBe(false);
              expect(adminAllowed).toBe(false);
              expect(modifyAllowed).toBe(true);
              break;
            case 'viewer':
              expect(ownerAllowed).toBe(false);
              expect(adminAllowed).toBe(false);
              expect(modifyAllowed).toBe(false);
              break;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
