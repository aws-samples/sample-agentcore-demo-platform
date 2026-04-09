/**
 * Authorization Service
 *
 * Provides fine-grained, resource-level permission checks on top of the
 * existing role-based access control system.
 *
 * Usage:
 *   authorizationService.authorize(user, 'agents:delete', { resourceOwnerId })
 *   authorizationService.can(user, 'workflows:execute')
 */

import { AppError } from '../middleware/errorHandler.js';
import type { User, UserRole } from '../types/index.js';
import {
  PERMISSIONS_BY_ROLE,
  OWNER_ONLY_PERMISSIONS,
  OWNERSHIP_BYPASS_ROLES,
  type Permission,
} from './permissions.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuthorizationContext {
  /** The user ID of the resource owner (for ownership-restricted permissions). */
  resourceOwnerId?: string;
  /** Optional org ID to verify the resource belongs to the user's org. */
  resourceOrgId?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class AuthorizationService {
  /**
   * Check if a user has a permission, returning a boolean.
   * Does not throw — use this for conditional UI/logic branching.
   */
  can(user: User, permission: Permission, ctx?: AuthorizationContext): boolean {
    const rolePermissions = PERMISSIONS_BY_ROLE[user.role];
    if (!rolePermissions) return false;

    // Check base role permission
    if (!rolePermissions.has(permission)) return false;

    // If the permission is ownership-restricted and the user's role doesn't
    // bypass ownership checks, verify they own the resource.
    if (
      OWNER_ONLY_PERMISSIONS.has(permission) &&
      !OWNERSHIP_BYPASS_ROLES.has(user.role) &&
      ctx?.resourceOwnerId !== undefined
    ) {
      return user.id === ctx.resourceOwnerId;
    }

    // Verify resource belongs to the user's org (if provided)
    if (ctx?.resourceOrgId !== undefined && ctx.resourceOrgId !== user.orgId) {
      return false;
    }

    return true;
  }

  /**
   * Assert that a user has a permission.
   * Throws AppError.forbidden if the check fails.
   */
  authorize(user: User, permission: Permission, ctx?: AuthorizationContext): void {
    if (!this.can(user, permission, ctx)) {
      const [resource, action] = permission.split(':');
      throw AppError.forbidden(
        `You do not have permission to ${action} ${resource}.`
      );
    }
  }

  /**
   * Check multiple permissions at once (AND logic — all must pass).
   */
  canAll(user: User, permissions: Permission[], ctx?: AuthorizationContext): boolean {
    return permissions.every((p) => this.can(user, p, ctx));
  }

  /**
   * Check multiple permissions at once (OR logic — at least one must pass).
   */
  canAny(user: User, permissions: Permission[], ctx?: AuthorizationContext): boolean {
    return permissions.some((p) => this.can(user, p, ctx));
  }

  /**
   * Returns all permissions granted to a role.
   */
  getPermissionsForRole(role: UserRole): Permission[] {
    return Array.from(PERMISSIONS_BY_ROLE[role] ?? []);
  }
}

export const authorizationService = new AuthorizationService();
