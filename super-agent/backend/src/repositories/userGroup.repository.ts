/**
 * User Group Repository
 * Data access for user groups, members, and resource access grants.
 */

import { prisma } from '../config/database.js';

export interface UserGroupEntity {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserGroupMemberEntity {
  id: string;
  group_id: string;
  user_id: string;
  added_by: string | null;
  created_at: Date;
}

export interface UserGroupWithMembers extends UserGroupEntity {
  members: Array<UserGroupMemberEntity & {
    user?: { id: string; full_name: string | null; username: string | null };
  }>;
  _count?: { members: number };
}

export class UserGroupRepository {
  async findAll(organizationId: string): Promise<UserGroupWithMembers[]> {
    return prisma.user_groups.findMany({
      where: { organization_id: organizationId },
      include: {
        members: {
          include: {
            group: false,
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    }) as unknown as Promise<UserGroupWithMembers[]>;
  }

  async findById(id: string, organizationId: string): Promise<UserGroupWithMembers | null> {
    return prisma.user_groups.findFirst({
      where: { id, organization_id: organizationId },
      include: {
        members: true,
        _count: { select: { members: true } },
      },
    }) as unknown as Promise<UserGroupWithMembers | null>;
  }

  async create(data: {
    organization_id: string;
    name: string;
    description?: string;
    created_by?: string;
  }): Promise<UserGroupEntity> {
    return prisma.user_groups.create({ data }) as unknown as Promise<UserGroupEntity>;
  }

  async update(id: string, organizationId: string, data: {
    name?: string;
    description?: string;
  }): Promise<UserGroupEntity | null> {
    const existing = await prisma.user_groups.findFirst({ where: { id, organization_id: organizationId } });
    if (!existing) return null;
    return prisma.user_groups.update({ where: { id }, data }) as unknown as Promise<UserGroupEntity>;
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const existing = await prisma.user_groups.findFirst({ where: { id, organization_id: organizationId } });
    if (!existing) return false;
    await prisma.user_groups.delete({ where: { id } });
    return true;
  }

  // ── Member management ──

  async addMember(groupId: string, userId: string, addedBy?: string): Promise<UserGroupMemberEntity> {
    return prisma.user_group_members.upsert({
      where: { unique_group_member: { group_id: groupId, user_id: userId } },
      update: {},
      create: { group_id: groupId, user_id: userId, added_by: addedBy ?? null },
    }) as unknown as Promise<UserGroupMemberEntity>;
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    await prisma.user_group_members.deleteMany({
      where: { group_id: groupId, user_id: userId },
    });
  }

  async getGroupsForUser(organizationId: string, userId: string): Promise<UserGroupEntity[]> {
    return prisma.user_groups.findMany({
      where: {
        organization_id: organizationId,
        members: { some: { user_id: userId } },
      },
      orderBy: { name: 'asc' },
    }) as unknown as Promise<UserGroupEntity[]>;
  }

  // ── Skill access grants ──

  async grantSkillAccess(skillId: string, groupIds: string[], grantedBy?: string): Promise<void> {
    // Remove existing grants for this skill, then re-create
    await prisma.skill_group_access.deleteMany({ where: { skill_id: skillId } });
    if (groupIds.length === 0) return;
    await prisma.skill_group_access.createMany({
      data: groupIds.map(gid => ({ skill_id: skillId, group_id: gid, granted_by: grantedBy ?? null })),
      skipDuplicates: true,
    });
  }

  async getSkillGroupIds(skillId: string): Promise<string[]> {
    const rows = await prisma.skill_group_access.findMany({
      where: { skill_id: skillId },
      select: { group_id: true },
    });
    return rows.map(r => r.group_id);
  }

  async getAccessibleSkillIds(organizationId: string, userId: string): Promise<string[]> {
    // Skills accessible to this user via their group memberships
    const rows = await prisma.$queryRaw<Array<{ skill_id: string }>>`
      SELECT DISTINCT sga.skill_id
      FROM skill_group_access sga
      JOIN user_group_members ugm ON ugm.group_id = sga.group_id
      JOIN user_groups ug ON ug.id = sga.group_id AND ug.organization_id = ${organizationId}::uuid
      WHERE ugm.user_id = ${userId}::uuid
    `;
    return rows.map(r => r.skill_id);
  }

  // ── MCP access grants ──

  async grantMcpAccess(mcpServerId: string, groupIds: string[], grantedBy?: string): Promise<void> {
    await prisma.mcp_group_access.deleteMany({ where: { mcp_server_id: mcpServerId } });
    if (groupIds.length === 0) return;
    await prisma.mcp_group_access.createMany({
      data: groupIds.map(gid => ({ mcp_server_id: mcpServerId, group_id: gid, granted_by: grantedBy ?? null })),
      skipDuplicates: true,
    });
  }

  async getMcpGroupIds(mcpServerId: string): Promise<string[]> {
    const rows = await prisma.mcp_group_access.findMany({
      where: { mcp_server_id: mcpServerId },
      select: { group_id: true },
    });
    return rows.map(r => r.group_id);
  }

  async getAccessibleMcpIds(organizationId: string, userId: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<Array<{ mcp_server_id: string }>>`
      SELECT DISTINCT mga.mcp_server_id
      FROM mcp_group_access mga
      JOIN user_group_members ugm ON ugm.group_id = mga.group_id
      JOIN user_groups ug ON ug.id = mga.group_id AND ug.organization_id = ${organizationId}::uuid
      WHERE ugm.user_id = ${userId}::uuid
    `;
    return rows.map(r => r.mcp_server_id);
  }
}

export const userGroupRepository = new UserGroupRepository();
