/**
 * Scope Access Service
 *
 * Centralized logic for scope-level access control.
 * Determines whether a user can access a given business scope based on:
 *   1. Org-level role (owner/admin bypass all scope restrictions)
 *   2. Scope visibility ('open' = everyone, 'restricted' = members only)
 *   3. Scope membership role (admin/member/viewer)
 */

import { prisma } from '../config/database.js';
import { scopeMembershipRepository, type ScopeRole } from '../repositories/scopeMembership.repository.js';
import { AppError } from '../middleware/errorHandler.js';
import type { User } from '../types/index.js';

export type ScopeAccessLevel = 'admin' | 'member' | 'viewer' | 'none';

export class ScopeAccessService {
  /**
   * Determine a user's effective access level to a scope.
   * Org owners and admins always get 'admin' access.
   * For open scopes, all org members get at least 'member' access.
   * For restricted scopes, only explicit scope members have access.
   */
  async getAccessLevel(user: User, scopeId: string): Promise<ScopeAccessLevel> {
    // Org owners and admins bypass scope restrictions
    if (user.role === 'owner' || user.role === 'admin') {
      return 'admin';
    }

    // Look up scope visibility
    const scope = await prisma.business_scopes.findFirst({
      where: { id: scopeId, organization_id: user.orgId },
      select: { visibility: true },
    });

    if (!scope) return 'none';

    // Open scopes: all org members get 'member' access, but check for explicit higher role
    if (scope.visibility === 'open') {
      const membership = await scopeMembershipRepository.findByUserAndScope(user.id, scopeId);
      if (membership) return membership.role;
      // Default access for open scopes based on org role
      return user.role === 'viewer' ? 'viewer' : 'member';
    }

    // Restricted scopes: must have explicit membership
    const membership = await scopeMembershipRepository.findByUserAndScope(user.id, scopeId);
    return membership ? membership.role : 'none';
  }

  /**
   * Assert that a user has at least the required access level to a scope.
   * Throws 403 if access is insufficient.
   */
  async requireAccess(
    user: User,
    scopeId: string,
    minLevel: ScopeAccessLevel = 'viewer',
  ): Promise<void> {
    const level = await this.getAccessLevel(user, scopeId);
    if (!this.meetsMinimum(level, minLevel)) {
      throw AppError.forbidden('You do not have access to this business scope.');
    }
  }

  /**
   * Filter a list of scope IDs to only those the user can access.
   */
  async filterAccessibleScopes(user: User, scopeIds: string[]): Promise<string[]> {
    // Org owners/admins see everything
    if (user.role === 'owner' || user.role === 'admin') {
      return scopeIds;
    }

    // Get all scopes with their visibility
    const scopes = await prisma.business_scopes.findMany({
      where: { id: { in: scopeIds }, organization_id: user.orgId },
      select: { id: true, visibility: true },
    });

    // Get user's explicit scope memberships
    const memberships = await scopeMembershipRepository.findByUser(user.orgId, user.id);
    const memberScopeIds = new Set(memberships.map((m) => m.business_scope_id));

    return scopes
      .filter((s) => (s as { id: string; visibility: string }).visibility === 'open' || memberScopeIds.has(s.id))
      .map((s) => s.id);
  }

  /**
   * Get all scope IDs accessible to a user in their org.
   * Used by the business scope list endpoint.
   */
  async getAccessibleScopeIds(user: User): Promise<string[] | 'all'> {
    // Org owners/admins see everything
    if (user.role === 'owner' || user.role === 'admin') {
      return 'all';
    }

    // Get open scopes
    const openScopes = await prisma.business_scopes.findMany({
      where: { organization_id: user.orgId, visibility: 'open' },
      select: { id: true },
    });
    const openIds = openScopes.map((s: { id: string }) => s.id);

    // Get restricted scopes user is a member of
    const restrictedIds = await scopeMembershipRepository.getAccessibleScopeIds(user.orgId, user.id);

    // Combine and deduplicate
    return [...new Set([...openIds, ...restrictedIds])];
  }

  /**
   * Manage scope members: add, update role, remove.
   */
  async addMember(orgId: string, scopeId: string, userId: string, role: ScopeRole) {
    return scopeMembershipRepository.create(orgId, scopeId, userId, role);
  }

  async updateMemberRole(membershipId: string, role: ScopeRole) {
    return scopeMembershipRepository.updateRole(membershipId, role);
  }

  async removeMember(membershipId: string) {
    return scopeMembershipRepository.delete(membershipId);
  }

  async getScopeMembers(scopeId: string) {
    return scopeMembershipRepository.findByScope(scopeId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private meetsMinimum(actual: ScopeAccessLevel, required: ScopeAccessLevel): boolean {
    const levels: Record<ScopeAccessLevel, number> = { none: 0, viewer: 1, member: 2, admin: 3 };
    return levels[actual] >= levels[required];
  }
}

export const scopeAccessService = new ScopeAccessService();
