/**
 * Document Group Repository
 * Data access for document groups, files, and scope assignments.
 */

import { prisma } from '../config/database.js';

export interface DocGroupEntity {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  storage_path: string;
  created_at: Date;
  updated_at: Date;
}

export interface DocGroupFileEntity {
  id: string;
  document_group_id: string;
  organization_id: string;
  original_filename: string;
  stored_filename: string;
  file_size: bigint;
  mime_type: string;
  uploaded_by: string | null;
  created_at: Date;
}

export interface ScopeDocGroupEntity {
  id: string;
  organization_id: string;
  business_scope_id: string;
  document_group_id: string;
  created_at: Date;
}

export class DocumentGroupRepository {
  // ── Group CRUD ──

  async listGroups(orgId: string): Promise<(DocGroupEntity & { _count: { files: number } })[]> {
    return prisma.document_groups.findMany({
      where: { organization_id: orgId },
      include: { _count: { select: { files: true } } },
      orderBy: { name: 'asc' },
    }) as any;
  }

  async getGroup(id: string, orgId: string): Promise<DocGroupEntity | null> {
    return prisma.document_groups.findFirst({
      where: { id, organization_id: orgId },
    }) as Promise<DocGroupEntity | null>;
  }

  async createGroup(orgId: string, data: { name: string; description?: string; storage_path: string }): Promise<DocGroupEntity> {
    return prisma.document_groups.create({
      data: { organization_id: orgId, ...data },
    }) as Promise<DocGroupEntity>;
  }

  async updateGroup(id: string, orgId: string, data: { name?: string; description?: string }): Promise<DocGroupEntity | null> {
    const existing = await this.getGroup(id, orgId);
    if (!existing) return null;
    return prisma.document_groups.update({ where: { id }, data }) as Promise<DocGroupEntity>;
  }

  async deleteGroup(id: string, orgId: string): Promise<boolean> {
    const existing = await this.getGroup(id, orgId);
    if (!existing) return false;
    await prisma.document_groups.delete({ where: { id } });
    return true;
  }

  // ── Files ──

  async listFiles(groupId: string, orgId: string): Promise<DocGroupFileEntity[]> {
    return prisma.document_group_files.findMany({
      where: { document_group_id: groupId, organization_id: orgId },
      orderBy: { created_at: 'desc' },
    }) as Promise<DocGroupFileEntity[]>;
  }

  async createFile(data: Omit<DocGroupFileEntity, 'id' | 'created_at'>): Promise<DocGroupFileEntity> {
    return prisma.document_group_files.create({ data }) as Promise<DocGroupFileEntity>;
  }

  async getFile(fileId: string, orgId: string): Promise<DocGroupFileEntity | null> {
    return prisma.document_group_files.findFirst({
      where: { id: fileId, organization_id: orgId },
    }) as Promise<DocGroupFileEntity | null>;
  }

  async deleteFile(fileId: string, orgId: string): Promise<boolean> {
    const existing = await this.getFile(fileId, orgId);
    if (!existing) return false;
    await prisma.document_group_files.delete({ where: { id: fileId } });
    return true;
  }

  // ── Scope assignments ──

  async listScopeAssignments(scopeId: string, orgId: string): Promise<(ScopeDocGroupEntity & { document_group: DocGroupEntity & { _count: { files: number } } })[]> {
    return prisma.scope_document_groups.findMany({
      where: { business_scope_id: scopeId, organization_id: orgId },
      include: { document_group: { include: { _count: { select: { files: true } } } } },
      orderBy: { created_at: 'desc' },
    }) as any;
  }

  async assignToScope(orgId: string, scopeId: string, groupId: string): Promise<ScopeDocGroupEntity> {
    return prisma.scope_document_groups.create({
      data: { organization_id: orgId, business_scope_id: scopeId, document_group_id: groupId },
    }) as Promise<ScopeDocGroupEntity>;
  }

  async unassignFromScope(id: string, orgId: string): Promise<boolean> {
    const existing = await prisma.scope_document_groups.findFirst({
      where: { id, organization_id: orgId },
    });
    if (!existing) return false;
    await prisma.scope_document_groups.delete({ where: { id } });
    return true;
  }

  /** Get all document groups accessible by a scope (for workspace provisioning). */
  async getGroupsForScope(scopeId: string): Promise<(DocGroupEntity & { files: DocGroupFileEntity[] })[]> {
    const assignments = await prisma.scope_document_groups.findMany({
      where: { business_scope_id: scopeId },
      include: {
        document_group: {
          include: { files: true },
        },
      },
    });
    return assignments.map(a => a.document_group) as any;
  }
}

export const documentGroupRepository = new DocumentGroupRepository();
