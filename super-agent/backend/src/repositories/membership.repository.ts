/**
 * Membership Repository
 * Data access layer for Membership entities with multi-tenancy support.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { BaseRepository, type FindAllOptions } from './base.repository.js';
import type { MembershipFilter } from '../schemas/membership.schema.js';

/**
 * Membership entity type matching the Prisma schema
 */
export interface MembershipEntity {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'pending' | 'active' | 'inactive';
  invited_email: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Membership Repository class extending BaseRepository with membership-specific methods.
 * Provides multi-tenancy filtering for all operations.
 */
export class MembershipRepository extends BaseRepository<MembershipEntity> {
  constructor() {
    super('memberships');
  }

  /**
   * Find all memberships with optional filters.
   * Supports filtering by role, status, and user_id.
   *
   * @param organizationId - The organization ID to filter by
   * @param filters - Optional filters (role, status, user_id)
   * @param options - Optional query options (pagination, ordering)
   * @returns Array of memberships matching the criteria
   */
  async findAllWithFilters(
    organizationId: string,
    filters?: MembershipFilter,
    options?: Omit<FindAllOptions<MembershipEntity>, 'where'>
  ): Promise<MembershipEntity[]> {
    const where: Partial<MembershipEntity> = {};

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.user_id) {
      where.user_id = filters.user_id;
    }

    return this.findAll(organizationId, {
      ...options,
      where,
    });
  }

  /**
   * Find a membership by user ID within an organization.
   *
   * @param organizationId - The organization ID
   * @param userId - The user ID
   * @returns The membership if found, null otherwise
   */
  async findByUserId(organizationId: string, userId: string): Promise<MembershipEntity | null> {
    return this.findFirst(organizationId, { user_id: userId });
  }

  /**
   * Find a membership by invited email within an organization.
   * Used for pending invitations.
   *
   * @param organizationId - The organization ID
   * @param email - The invited email
   * @returns The membership if found, null otherwise
   */
  async findByInvitedEmail(
    organizationId: string,
    email: string
  ): Promise<MembershipEntity | null> {
    return this.findFirst(organizationId, { invited_email: email });
  }

  /**
   * Find memberships by role.
   *
   * @param organizationId - The organization ID
   * @param role - The role to filter by
   * @returns Array of memberships with the specified role
   */
  async findByRole(
    organizationId: string,
    role: MembershipEntity['role']
  ): Promise<MembershipEntity[]> {
    return this.findAll(organizationId, {
      where: { role },
    });
  }

  /**
   * Find memberships by status.
   *
   * @param organizationId - The organization ID
   * @param status - The status to filter by
   * @returns Array of memberships with the specified status
   */
  async findByStatus(
    organizationId: string,
    status: MembershipEntity['status']
  ): Promise<MembershipEntity[]> {
    return this.findAll(organizationId, {
      where: { status },
    });
  }

  /**
   * Find all active memberships.
   *
   * @param organizationId - The organization ID
   * @returns Array of active memberships
   */
  async findActive(organizationId: string): Promise<MembershipEntity[]> {
    return this.findByStatus(organizationId, 'active');
  }

  /**
   * Find all pending invitations.
   *
   * @param organizationId - The organization ID
   * @returns Array of pending memberships
   */
  async findPending(organizationId: string): Promise<MembershipEntity[]> {
    return this.findByStatus(organizationId, 'pending');
  }

  /**
   * Update membership role.
   *
   * @param id - The membership ID
   * @param organizationId - The organization ID
   * @param role - The new role
   * @returns The updated membership, or null if not found
   */
  async updateRole(
    id: string,
    organizationId: string,
    role: MembershipEntity['role']
  ): Promise<MembershipEntity | null> {
    return this.update(id, organizationId, { role });
  }

  /**
   * Update membership status.
   *
   * @param id - The membership ID
   * @param organizationId - The organization ID
   * @param status - The new status
   * @returns The updated membership, or null if not found
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: MembershipEntity['status']
  ): Promise<MembershipEntity | null> {
    return this.update(id, organizationId, { status });
  }

  /**
   * Activate a pending membership.
   * Sets status to 'active' and clears invited_email.
   *
   * @param id - The membership ID
   * @param organizationId - The organization ID
   * @param userId - The user ID to associate
   * @returns The updated membership, or null if not found
   */
  async activate(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<MembershipEntity | null> {
    return this.update(id, organizationId, {
      status: 'active',
      user_id: userId,
      invited_email: null,
    });
  }

  /**
   * Deactivate a membership.
   *
   * @param id - The membership ID
   * @param organizationId - The organization ID
   * @returns The updated membership, or null if not found
   */
  async deactivate(id: string, organizationId: string): Promise<MembershipEntity | null> {
    return this.updateStatus(id, organizationId, 'inactive');
  }

  /**
   * Check if a user is a member of an organization.
   *
   * @param organizationId - The organization ID
   * @param userId - The user ID
   * @returns True if the user is a member
   */
  async isMember(organizationId: string, userId: string): Promise<boolean> {
    const membership = await this.findByUserId(organizationId, userId);
    return membership !== null && membership.status === 'active';
  }

  /**
   * Check if a user has a specific role in an organization.
   *
   * @param organizationId - The organization ID
   * @param userId - The user ID
   * @param roles - The roles to check
   * @returns True if the user has one of the specified roles
   */
  async hasRole(
    organizationId: string,
    userId: string,
    roles: MembershipEntity['role'][]
  ): Promise<boolean> {
    const membership = await this.findByUserId(organizationId, userId);
    return membership !== null && membership.status === 'active' && roles.includes(membership.role);
  }

  /**
   * Get the owner of an organization.
   *
   * @param organizationId - The organization ID
   * @returns The owner membership, or null if not found
   */
  async getOwner(organizationId: string): Promise<MembershipEntity | null> {
    const owners = await this.findByRole(organizationId, 'owner');
    return owners[0] ?? null;
  }

  /**
   * Count members by role.
   *
   * @param organizationId - The organization ID
   * @param role - The role to count
   * @returns The count of members with the specified role
   */
  async countByRole(organizationId: string, role: MembershipEntity['role']): Promise<number> {
    return this.count(organizationId, { role });
  }

  /**
   * Count active members.
   *
   * @param organizationId - The organization ID
   * @returns The count of active members
   */
  async countActive(organizationId: string): Promise<number> {
    return this.count(organizationId, { status: 'active' });
  }
}

// Export singleton instance
export const membershipRepository = new MembershipRepository();
