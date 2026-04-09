/**
 * Scope Membership Repository
 * Data access layer for scope-level access control.
 */

import { prisma } from '../config/database.js';

export type ScopeRole = 'admin' | 'member' | 'viewer';

export interface ScopeMembershipEntity {
  id: string;
  organization_id: string;
  business_scope_id: string;
  user_id: string;
  role: ScopeRole;
  created_at: Date;
  updated_at: Date;
}

export class ScopeMembershipRepository {
  /**
   * Check if a user has access to a scope.
   * Returns the membership if found, null otherwise.
   */
  async findByUserAndScope(
    userId: string,
    scopeId: string,
  ): Promise<ScopeMembershipEntity | null> {
    return prisma.scope_memberships.findUnique({
      where: { business_scope_id_user_id: { business_scope_id: scopeId, user_id: userId } },
    }) as Promise<ScopeMembershipEntity | null>;
  }

  /**
   * Get all scope memberships for a user within an org.
   */
  async findByUser(orgId: string, userId: string): Promise<ScopeMembershipEntity[]> {
    return prisma.scope_memberships.findMany({
      where: { organization_id: orgId, user_id: userId },
    }) as Promise<ScopeMembershipEntity[]>;
  }

  /**
   * Get all members of a scope.
   */
  async findByScope(scopeId: string): Promise<ScopeMembershipEntity[]> {
    return prisma.scope_memberships.findMany({
      where: { business_scope_id: scopeId },
      orderBy: { created_at: 'desc' },
    }) as Promise<ScopeMembershipEntity[]>;
  }

  /**
   * Get scope IDs a user has access to within an org.
   */
  async getAccessibleScopeIds(orgId: string, userId: string): Promise<string[]> {
    const memberships = await prisma.scope_memberships.findMany({
      where: { organization_id: orgId, user_id: userId },
      select: { business_scope_id: true },
    });
    return memberships.map((m: { business_scope_id: string }) => m.business_scope_id);
  }

  /**
   * Add a user to a scope.
   */
  async create(
    orgId: string,
    scopeId: string,
    userId: string,
    role: ScopeRole = 'viewer',
  ): Promise<ScopeMembershipEntity> {
    return prisma.scope_memberships.create({
      data: {
        organization_id: orgId,
        business_scope_id: scopeId,
        user_id: userId,
        role,
      },
    }) as Promise<ScopeMembershipEntity>;
  }

  /**
   * Update a user's role in a scope.
   */
  async updateRole(id: string, role: ScopeRole): Promise<ScopeMembershipEntity> {
    return prisma.scope_memberships.update({
      where: { id },
      data: { role },
    }) as Promise<ScopeMembershipEntity>;
  }

  /**
   * Remove a user from a scope.
   */
  async delete(id: string): Promise<void> {
    await prisma.scope_memberships.delete({ where: { id } });
  }

  /**
   * Remove a user from a scope by user+scope composite key.
   */
  async deleteByUserAndScope(scopeId: string, userId: string): Promise<void> {
    await prisma.scope_memberships.delete({
      where: { business_scope_id_user_id: { business_scope_id: scopeId, user_id: userId } },
    });
  }

  /**
   * Bulk add members to a scope.
   */
  async createMany(
    orgId: string,
    scopeId: string,
    members: Array<{ userId: string; role: ScopeRole }>,
  ): Promise<number> {
    const result = await prisma.scope_memberships.createMany({
      data: members.map((m) => ({
        organization_id: orgId,
        business_scope_id: scopeId,
        user_id: m.userId,
        role: m.role,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }
}

export const scopeMembershipRepository = new ScopeMembershipRepository();
