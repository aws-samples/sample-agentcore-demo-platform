/**
 * Scope Memory Repository
 * Data access for scope memories with full-text search support.
 */

import { prisma } from '../config/database.js';
import type { Prisma } from '@prisma/client';

export interface ScopeMemoryEntity {
  id: string;
  organization_id: string;
  business_scope_id: string;
  session_id: string | null;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_pinned: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ListMemoriesOptions {
  category?: string;
  q?: string;
  pinned?: boolean;
  limit?: number;
  offset?: number;
}

export class ScopeMemoryRepository {
  async findByScope(
    organizationId: string,
    scopeId: string,
    options: ListMemoriesOptions = {},
  ): Promise<ScopeMemoryEntity[]> {
    // Full-text search requires raw query
    if (options.q) {
      return this.searchByText(organizationId, scopeId, options);
    }

    const where: Prisma.scope_memoriesWhereInput = {
      organization_id: organizationId,
      business_scope_id: scopeId,
    };
    if (options.category) where.category = options.category;
    if (options.pinned !== undefined) where.is_pinned = options.pinned;

    return prisma.scope_memories.findMany({
      where,
      orderBy: [{ is_pinned: 'desc' }, { created_at: 'desc' }],
      take: options.limit ?? 100,
      skip: options.offset ?? 0,
    }) as Promise<ScopeMemoryEntity[]>;
  }

  private async searchByText(
    organizationId: string,
    scopeId: string,
    options: ListMemoriesOptions,
  ): Promise<ScopeMemoryEntity[]> {
    const categoryFilter = options.category ? `AND category = '${options.category.replace(/'/g, "''")}'` : '';
    const pinnedFilter = options.pinned !== undefined ? `AND is_pinned = ${options.pinned}` : '';
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    return prisma.$queryRawUnsafe<ScopeMemoryEntity[]>(
      `SELECT id, organization_id, business_scope_id, session_id, title, content,
              category, tags, is_pinned, created_by, created_at, updated_at
       FROM scope_memories
       WHERE organization_id = $1
         AND business_scope_id = $2
         AND search_vector @@ plainto_tsquery('english', $3)
         ${categoryFilter} ${pinnedFilter}
       ORDER BY is_pinned DESC, ts_rank(search_vector, plainto_tsquery('english', $3)) DESC
       LIMIT ${limit} OFFSET ${offset}`,
      organizationId,
      scopeId,
      options.q!,
    );
  }

  /**
   * Load memories for CLAUDE.md injection.
   *
   * Strategy:
   *   1. All pinned memories first (capped at 15K chars to prevent budget monopoly)
   *   2. Recent non-pinned, with per-category budgets:
   *      - lesson: 8K chars  (highest value — mistakes and corrections)
   *      - gap:    5K chars  (capability gaps worth surfacing)
   *      - pattern: 5K chars (recurring solution paths)
   *      - other:  2K chars  (uncategorized)
   *   3. Human-created memories take priority over auto-distilled within each bucket
   *   4. Total hard cap: 30K chars
   */
  async findForContext(scopeId: string): Promise<ScopeMemoryEntity[]> {
    const PINNED_CAP = 15_000;
    const TOTAL_CAP = 30_000;
    const CATEGORY_BUDGETS: Record<string, number> = {
      lesson: 8_000,
      gap: 5_000,
      pattern: 5_000,
    };
    const DEFAULT_BUDGET = 2_000;

    // 1. Pinned memories (capped)
    const pinned = await prisma.scope_memories.findMany({
      where: { business_scope_id: scopeId, is_pinned: true },
      orderBy: { created_at: 'desc' },
    }) as ScopeMemoryEntity[];

    const result: ScopeMemoryEntity[] = [];
    let totalChars = 0;

    for (const m of pinned) {
      const size = m.title.length + m.content.length + 50;
      if (totalChars + size > PINNED_CAP) break;
      result.push(m);
      totalChars += size;
    }

    // 2. Non-pinned memories, ordered: human-created first, then auto-distilled, newest first
    const recent = await prisma.scope_memories.findMany({
      where: { business_scope_id: scopeId, is_pinned: false },
      orderBy: { created_at: 'desc' },
      take: 80,
    }) as ScopeMemoryEntity[];

    // Sort: human-created (no 'auto-distilled' tag) before auto-distilled
    const isAuto = (m: ScopeMemoryEntity) => m.tags.includes('auto-distilled');
    recent.sort((a, b) => {
      const aAuto = isAuto(a) ? 1 : 0;
      const bAuto = isAuto(b) ? 1 : 0;
      if (aAuto !== bAuto) return aAuto - bAuto;
      return b.created_at.getTime() - a.created_at.getTime();
    });

    // Track per-category char usage
    const categoryUsed = new Map<string, number>();

    for (const m of recent) {
      if (totalChars >= TOTAL_CAP) break;

      const size = m.title.length + m.content.length + 50;
      const budget = CATEGORY_BUDGETS[m.category] ?? DEFAULT_BUDGET;
      const used = categoryUsed.get(m.category) ?? 0;

      if (used + size > budget) continue; // This category is full
      if (totalChars + size > TOTAL_CAP) break;

      result.push(m);
      totalChars += size;
      categoryUsed.set(m.category, used + size);
    }

    return result;
  }

  async findById(id: string, organizationId: string): Promise<ScopeMemoryEntity | null> {
    return prisma.scope_memories.findFirst({
      where: { id, organization_id: organizationId },
    }) as Promise<ScopeMemoryEntity | null>;
  }

  async create(
    data: Omit<ScopeMemoryEntity, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<ScopeMemoryEntity> {
    return prisma.scope_memories.create({
      data: {
        organization_id: data.organization_id,
        business_scope_id: data.business_scope_id,
        session_id: data.session_id,
        title: data.title,
        content: data.content,
        category: data.category,
        tags: data.tags,
        is_pinned: data.is_pinned,
        created_by: data.created_by,
      },
    }) as Promise<ScopeMemoryEntity>;
  }

  async update(
    id: string,
    organizationId: string,
    data: Partial<Pick<ScopeMemoryEntity, 'title' | 'content' | 'category' | 'tags' | 'is_pinned'>>,
  ): Promise<ScopeMemoryEntity | null> {
    const existing = await this.findById(id, organizationId);
    if (!existing) return null;

    const updateData: Prisma.scope_memoriesUncheckedUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.is_pinned !== undefined) updateData.is_pinned = data.is_pinned;

    return prisma.scope_memories.update({
      where: { id },
      data: updateData,
    }) as Promise<ScopeMemoryEntity>;
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const existing = await this.findById(id, organizationId);
    if (!existing) return false;
    await prisma.scope_memories.delete({ where: { id } });
    return true;
  }
}

export const scopeMemoryRepository = new ScopeMemoryRepository();
