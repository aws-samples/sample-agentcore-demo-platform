/**
 * Organization Repository
 * Data access layer for Organization entities.
 * Note: Organizations are NOT multi-tenant entities - they ARE the tenants.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { prisma, type PrismaClient } from '../config/database.js';
import type { Prisma } from '@prisma/client';

/**
 * Organization entity type matching the Prisma schema
 */
export interface OrganizationEntity {
  id: string;
  name: string;
  slug: string;
  plan_type: string;
  settings: Prisma.JsonValue;
  created_at: Date;
  updated_at: Date;
}

/**
 * Options for findAll queries
 */
export interface OrganizationFindAllOptions {
  where?: Partial<Pick<OrganizationEntity, 'plan_type' | 'slug'>>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  skip?: number;
  take?: number;
}

/**
 * Organization Repository class.
 * Unlike other repositories, this doesn't extend BaseRepository because
 * organizations are the root tenant entities, not tenant-scoped entities.
 */
export class OrganizationRepository {
  protected prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Find all organizations.
   * This is typically restricted to admin users.
   *
   * @param options - Optional query options
   * @returns Array of organizations
   */
  async findAll(options?: OrganizationFindAllOptions): Promise<OrganizationEntity[]> {
    const { where, orderBy, skip, take } = options ?? {};

    const results = await this.prisma.organizations.findMany({
      where,
      orderBy: orderBy ?? { created_at: 'desc' },
      skip,
      take,
    });

    return results as OrganizationEntity[];
  }

  /**
   * Find an organization by ID.
   *
   * @param id - The organization ID
   * @returns The organization if found, null otherwise
   */
  async findById(id: string): Promise<OrganizationEntity | null> {
    const result = await this.prisma.organizations.findUnique({
      where: { id },
    });

    return result as OrganizationEntity | null;
  }

  /**
   * Find an organization by slug.
   *
   * @param slug - The organization slug
   * @returns The organization if found, null otherwise
   */
  async findBySlug(slug: string): Promise<OrganizationEntity | null> {
    const result = await this.prisma.organizations.findUnique({
      where: { slug },
    });

    return result as OrganizationEntity | null;
  }

  /**
   * Create a new organization.
   *
   * @param data - The organization data
   * @returns The created organization
   */
  async create(data: {
    name: string;
    slug: string;
    plan_type: string;
    settings: Record<string, unknown>;
  }): Promise<OrganizationEntity> {
    const result = await this.prisma.organizations.create({
      data: {
        name: data.name,
        slug: data.slug,
        plan_type: data.plan_type,
        settings: data.settings as Prisma.InputJsonValue,
      },
    });

    return result as OrganizationEntity;
  }

  /**
   * Update an organization.
   *
   * @param id - The organization ID
   * @param data - The data to update
   * @returns The updated organization, or null if not found
   */
  async update(
    id: string,
    data: {
      name?: string;
      slug?: string;
      plan_type?: string;
      settings?: Record<string, unknown>;
    }
  ): Promise<OrganizationEntity | null> {
    // First verify the organization exists
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updateData: Prisma.organizationsUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.plan_type !== undefined) updateData.plan_type = data.plan_type;
    if (data.settings !== undefined) updateData.settings = data.settings as Prisma.InputJsonValue;

    const result = await this.prisma.organizations.update({
      where: { id },
      data: updateData,
    });

    return result as OrganizationEntity;
  }

  /**
   * Delete an organization.
   * Note: This will cascade delete all related entities.
   *
   * @param id - The organization ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.findById(id);
    if (!existing) {
      return false;
    }

    await this.prisma.organizations.delete({
      where: { id },
    });

    return true;
  }

  /**
   * Check if an organization exists by ID.
   *
   * @param id - The organization ID
   * @returns True if the organization exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.organizations.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Check if a slug is already taken.
   *
   * @param slug - The slug to check
   * @param excludeId - Optional organization ID to exclude (for updates)
   * @returns True if the slug is taken
   */
  async isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
    const count = await this.prisma.organizations.count({
      where: {
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    return count > 0;
  }

  /**
   * Get organization with memberships included.
   *
   * @param id - The organization ID
   * @returns The organization with memberships, or null if not found
   */
  async findByIdWithMemberships(
    id: string
  ): Promise<(OrganizationEntity & { memberships: unknown[] }) | null> {
    const result = await this.prisma.organizations.findUnique({
      where: { id },
      include: { memberships: true },
    });

    return result as (OrganizationEntity & { memberships: unknown[] }) | null;
  }

  /**
   * Count organizations.
   *
   * @param where - Optional filter conditions
   * @returns The count of matching organizations
   */
  async count(where?: Partial<Pick<OrganizationEntity, 'plan_type' | 'slug'>>): Promise<number> {
    return this.prisma.organizations.count({ where });
  }
}

// Export singleton instance
export const organizationRepository = new OrganizationRepository();
