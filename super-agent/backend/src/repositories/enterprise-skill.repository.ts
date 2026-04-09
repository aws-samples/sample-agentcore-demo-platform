/**
 * Enterprise Skill Marketplace Repository
 * Data access layer for the enterprise skill catalog and votes.
 */

import { prisma } from '../config/database.js';

export interface SkillMarketplaceEntity {
  id: string;
  organization_id: string;
  skill_id: string;
  published_by: string;
  status: string;
  visibility: string;
  install_count: number;
  vote_score: number;
  category: string | null;
  source: string;
  source_ref: string | null;
  published_at: Date;
  updated_at: Date;
}

export interface SkillVoteEntity {
  id: string;
  skill_marketplace_id: string;
  user_id: string;
  vote: number;
  created_at: Date;
}

export interface EnterpriseSkillWithDetails extends SkillMarketplaceEntity {
  skill: {
    id: string;
    name: string;
    display_name: string;
    description: string | null;
    version: string;
    tags: unknown;
    metadata: unknown;
    hash_id: string;
    s3_bucket: string;
    s3_prefix: string;
  };
}

export type SortOption = 'popular' | 'recent' | 'top-rated';

export class EnterpriseSkillRepository {
  /**
   * Browse published enterprise skills with search, category filter, and sorting.
   */
  async browse(
    organizationId: string,
    options: {
      query?: string;
      category?: string;
      sort?: SortOption;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{ items: EnterpriseSkillWithDetails[]; total: number }> {
    const { query, category, sort = 'popular', page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      organization_id: organizationId,
      status: 'published',
    };
    if (category) where.category = category;

    // Text search on skill name/description
    if (query) {
      where.skill = {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { display_name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      };
    }

    let orderBy: Record<string, string>;
    switch (sort) {
      case 'recent':
        orderBy = { published_at: 'desc' };
        break;
      case 'top-rated':
        orderBy = { vote_score: 'desc' };
        break;
      case 'popular':
      default:
        orderBy = { install_count: 'desc' };
        break;
    }

    const [items, total] = await Promise.all([
      prisma.skill_marketplace.findMany({
        where,
        include: { skill: true },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.skill_marketplace.count({ where }),
    ]);

    return {
      items: items as unknown as EnterpriseSkillWithDetails[],
      total,
    };
  }

  /**
   * Find a marketplace entry by ID.
   */
  async findById(id: string, organizationId: string): Promise<EnterpriseSkillWithDetails | null> {
    const result = await prisma.skill_marketplace.findFirst({
      where: { id, organization_id: organizationId },
      include: { skill: true },
    });
    return result as unknown as EnterpriseSkillWithDetails | null;
  }

  /**
   * Find a marketplace entry by skill ID.
   */
  async findBySkillId(skillId: string, organizationId: string): Promise<SkillMarketplaceEntity | null> {
    return prisma.skill_marketplace.findFirst({
      where: { skill_id: skillId, organization_id: organizationId },
    }) as Promise<SkillMarketplaceEntity | null>;
  }

  /**
   * Publish a skill to the enterprise marketplace.
   */
  async publish(
    organizationId: string,
    data: {
      skillId: string;
      publishedBy: string;
      category?: string;
      visibility?: string;
      source?: string;
      sourceRef?: string;
    },
  ): Promise<SkillMarketplaceEntity> {
    return prisma.skill_marketplace.create({
      data: {
        organization_id: organizationId,
        skill_id: data.skillId,
        published_by: data.publishedBy,
        category: data.category ?? null,
        visibility: data.visibility ?? 'organization',
        source: data.source ?? 'internal',
        source_ref: data.sourceRef ?? null,
        status: 'published',
      },
    }) as Promise<SkillMarketplaceEntity>;
  }

  /**
   * Update a marketplace entry.
   */
  async update(
    id: string,
    organizationId: string,
    data: Partial<Pick<SkillMarketplaceEntity, 'status' | 'category' | 'visibility'>>,
  ): Promise<SkillMarketplaceEntity | null> {
    const existing = await prisma.skill_marketplace.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!existing) return null;
    return prisma.skill_marketplace.update({
      where: { id },
      data,
    }) as Promise<SkillMarketplaceEntity>;
  }

  /**
   * Increment install count.
   */
  async incrementInstallCount(id: string): Promise<void> {
    await prisma.skill_marketplace.update({
      where: { id },
      data: { install_count: { increment: 1 } },
    });
  }

  /**
   * Upsert a vote and recalculate vote_score.
   */
  async upsertVote(
    marketplaceId: string,
    userId: string,
    vote: 1 | -1,
  ): Promise<{ voteScore: number }> {
    await prisma.skill_votes.upsert({
      where: {
        unique_vote_per_user: {
          skill_marketplace_id: marketplaceId,
          user_id: userId,
        },
      },
      create: {
        skill_marketplace_id: marketplaceId,
        user_id: userId,
        vote,
      },
      update: { vote },
    });

    // Recalculate vote score
    const result = await prisma.skill_votes.aggregate({
      where: { skill_marketplace_id: marketplaceId },
      _sum: { vote: true },
    });
    const voteScore = result._sum.vote ?? 0;

    await prisma.skill_marketplace.update({
      where: { id: marketplaceId },
      data: { vote_score: voteScore },
    });

    return { voteScore };
  }

  /**
   * Get a user's vote on a marketplace skill.
   */
  async getUserVote(marketplaceId: string, userId: string): Promise<number | null> {
    const vote = await prisma.skill_votes.findFirst({
      where: { skill_marketplace_id: marketplaceId, user_id: userId },
    });
    return vote?.vote ?? null;
  }

  /**
   * Get distinct categories for an org's marketplace.
   */
  async getCategories(organizationId: string): Promise<string[]> {
    const results = await prisma.skill_marketplace.findMany({
      where: { organization_id: organizationId, status: 'published', category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return results.map(r => r.category!).filter(Boolean);
  }
}

export const enterpriseSkillRepository = new EnterpriseSkillRepository();
