/**
 * Property-based tests for Authentication
 *
 * Feature: unified-ecs-backend
 * Property 1: JWT Token Round-Trip
 * Validates: Requirements 2.1, 2.4
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createToken, verifyToken } from '../../src/middleware/auth.js';
import type { UserRole } from '../../src/types/index.js';

describe('Auth Service Properties', () => {
  /**
   * Feature: unified-ecs-backend, Property 1: JWT Token Round-Trip
   * Validates: Requirements 2.1, 2.4
   *
   * For any valid user claims (user_id, email, org_id, role),
   * encoding them into a JWT token and then decoding that token
   * should produce the same claims.
   */
  it('should preserve claims through JWT encode/decode round-trip', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.uuid(),
          email: fc.emailAddress(),
          organizationId: fc.uuid(),
          role: fc.constantFrom<UserRole>('owner', 'admin', 'member', 'viewer'),
        }),
        (claims) => {
          // Encode claims into JWT
          const token = createToken(claims);

          // Decode the token
          const decoded = verifyToken(token);

          // Verify round-trip preserves all claims
          expect(decoded.sub).toBe(claims.userId);
          expect(decoded.email).toBe(claims.email);
          expect(decoded.orgId).toBe(claims.organizationId);
          expect(decoded.role).toBe(claims.role);
        }
      ),
      { numRuns: 100 }
    );
  });
});
