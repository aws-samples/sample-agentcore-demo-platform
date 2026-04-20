/**
 * Showcase Repository
 * Data access layer for the "企业Agent大赏" module.
 */

import { prisma } from '../config/database.js';

export interface ShowcaseIndustryEntity {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ShowcaseDomainEntity {
  id: string;
  organization_id: string;
  industry_id: string;
  name: string;
  name_en: string | null;
  icon: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface ShowcaseCaseEntity {
  id: string;
  organization_id: string;
  domain_id: string;
  title: string;
  description: string | null;
  initial_prompt: string | null;
  session_id: string | null;
  agent_id: string | null;
  workflow_id: string | null;
  scope_id: string | null;
  run_config: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

class ShowcaseRepository {
  /**
   * Get all industries with their domains and cases (full tree).
   */
  async getFullTree(organizationId: string) {
    return prisma.showcase_industries.findMany({
      where: { organization_id: organizationId, is_active: true },
      orderBy: { sort_order: 'asc' },
      include: {
        domains: {
          orderBy: { sort_order: 'asc' },
          include: {
            cases: {
              where: { is_active: true },
              orderBy: { sort_order: 'asc' },
            },
          },
        },
      },
    });
  }

  /**
   * Get industries list (tabs).
   */
  async getIndustries(organizationId: string) {
    return prisma.showcase_industries.findMany({
      where: { organization_id: organizationId, is_active: true },
      orderBy: { sort_order: 'asc' },
    });
  }

  /**
   * Get domains + cases for a specific industry.
   */
  async getDomainsWithCases(organizationId: string, industryId: string) {
    return prisma.showcase_domains.findMany({
      where: { organization_id: organizationId, industry_id: industryId },
      orderBy: { sort_order: 'asc' },
      include: {
        cases: {
          where: { is_active: true },
          orderBy: { sort_order: 'asc' },
        },
      },
    });
  }

  // ---- CRUD: Industries ----

  async createIndustry(data: {
    organization_id: string;
    name: string;
    slug: string;
    sort_order?: number;
  }) {
    return prisma.showcase_industries.create({ data });
  }

  async updateIndustry(id: string, orgId: string, data: Partial<Pick<ShowcaseIndustryEntity, 'name' | 'slug' | 'sort_order' | 'is_active'>>) {
    const existing = await prisma.showcase_industries.findFirst({ where: { id, organization_id: orgId } });
    if (!existing) return null;
    return prisma.showcase_industries.update({ where: { id }, data });
  }

  async deleteIndustry(id: string, orgId: string) {
    const existing = await prisma.showcase_industries.findFirst({ where: { id, organization_id: orgId } });
    if (!existing) return false;
    await prisma.showcase_industries.delete({ where: { id } });
    return true;
  }

  // ---- CRUD: Domains ----

  async createDomain(data: {
    organization_id: string;
    industry_id: string;
    name: string;
    name_en?: string;
    icon?: string;
    sort_order?: number;
  }) {
    return prisma.showcase_domains.create({ data });
  }

  async updateDomain(id: string, orgId: string, data: Partial<Pick<ShowcaseDomainEntity, 'name' | 'name_en' | 'icon' | 'sort_order'>>) {
    const existing = await prisma.showcase_domains.findFirst({ where: { id, organization_id: orgId } });
    if (!existing) return null;
    return prisma.showcase_domains.update({ where: { id }, data });
  }

  async deleteDomain(id: string, orgId: string) {
    const existing = await prisma.showcase_domains.findFirst({ where: { id, organization_id: orgId } });
    if (!existing) return false;
    await prisma.showcase_domains.delete({ where: { id } });
    return true;
  }

  // ---- CRUD: Cases ----

  async createCase(data: {
    organization_id: string;
    domain_id: string;
    title: string;
    description?: string;
    initial_prompt?: string;
    session_id?: string;
    agent_id?: string;
    workflow_id?: string;
    scope_id?: string;
    run_config?: Record<string, unknown>;
    sort_order?: number;
    created_by?: string;
  }) {
    return prisma.showcase_cases.create({ data });
  }

  async updateCase(id: string, orgId: string, data: Partial<Pick<ShowcaseCaseEntity, 'title' | 'description' | 'initial_prompt' | 'session_id' | 'agent_id' | 'workflow_id' | 'scope_id' | 'run_config' | 'sort_order' | 'is_active'>>) {
    const existing = await prisma.showcase_cases.findFirst({ where: { id, organization_id: orgId } });
    if (!existing) return null;
    return prisma.showcase_cases.update({ where: { id }, data });
  }

  async deleteCase(id: string, orgId: string) {
    const existing = await prisma.showcase_cases.findFirst({ where: { id, organization_id: orgId } });
    if (!existing) return false;
    await prisma.showcase_cases.delete({ where: { id } });
    return true;
  }
}

export const showcaseRepository = new ShowcaseRepository();
