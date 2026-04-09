/**
 * Skill Service
 * Manages Claude Skills stored in S3 with metadata in PostgreSQL.
 */

import { createHash } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { skillRepository, type SkillEntity } from '../repositories/skill.repository.js';
import { agentRepository } from '../repositories/agent.repository.js';
import { businessScopeService } from './businessScope.service.js';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface CreateSkillInput {
  name: string;
  display_name: string;
  description?: string;
  version?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SkillSummary {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  version: string;
  status: string;
  hash_id: string;
  s3_prefix: string;
}

export interface SkillForRuntime {
  id: string;
  name: string;
  hash_id: string;
  s3_bucket: string;
  s3_prefix: string;
  version: string;
}

const SKILLS_BUCKET = process.env.SKILLS_S3_BUCKET || 'super-agent-skills';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: AWS_REGION });

function generateHashId(organizationId: string, name: string): string {
  const hash = createHash('sha256');
  hash.update(`${organizationId}:${name}:${Date.now()}`);
  return hash.digest('hex').substring(0, 16);
}

export class SkillService {
  async listSkills(organizationId: string): Promise<SkillSummary[]> {
    const skills = await skillRepository.findActiveSkills(organizationId);
    return skills.map(s => ({
      id: s.id, name: s.name, display_name: s.display_name,
      description: s.description, version: s.version, status: s.status,
      hash_id: s.hash_id, s3_prefix: s.s3_prefix,
    }));
  }

  async getSkill(organizationId: string, skillId: string): Promise<SkillEntity | null> {
    return skillRepository.findById(skillId, organizationId);
  }

  async getSkills(organizationId: string, skillIds: string[]): Promise<SkillEntity[]> {
    return skillRepository.findByIds(organizationId, skillIds);
  }

  async createSkill(organizationId: string, input: CreateSkillInput): Promise<SkillEntity> {
    const hashId = generateHashId(organizationId, input.name);
    return skillRepository.create(organizationId, {
      name: input.name, display_name: input.display_name,
      description: input.description || null, hash_id: hashId,
      s3_bucket: SKILLS_BUCKET, s3_prefix: `skills/${hashId}/`,
      version: input.version || '1.0.0', status: 'active',
      tags: input.tags || [], metadata: input.metadata || {},
    });
  }

  async updateSkill(organizationId: string, skillId: string, updates: Partial<CreateSkillInput>): Promise<SkillEntity | null> {
    const data: Record<string, unknown> = {};
    if (updates.display_name) data.display_name = updates.display_name;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.version) data.version = updates.version;
    if (updates.tags) data.tags = updates.tags;
    if (updates.metadata) data.metadata = updates.metadata;
    return skillRepository.update(skillId, organizationId, data);
  }

  async archiveSkill(organizationId: string, skillId: string): Promise<SkillEntity | null> {
    return skillRepository.update(skillId, organizationId, { status: 'archived' });
  }

  async deleteSkill(organizationId: string, skillId: string): Promise<boolean> {
    const skill = await skillRepository.findById(skillId, organizationId);
    if (!skill) return false;
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: skill.s3_bucket, Key: `${skill.s3_prefix}skill.zip` }));
    } catch (err) { console.warn(`Failed to delete S3 object for skill ${skillId}:`, err); }
    return skillRepository.delete(skillId, organizationId);
  }

  async getUploadUrl(organizationId: string, skillId: string): Promise<string | null> {
    const skill = await skillRepository.findById(skillId, organizationId);
    if (!skill) return null;
    return getSignedUrl(s3Client, new PutObjectCommand({ Bucket: skill.s3_bucket, Key: `${skill.s3_prefix}skill.zip`, ContentType: 'application/zip' }), { expiresIn: 3600 });
  }

  async getDownloadUrl(organizationId: string, skillId: string): Promise<string | null> {
    const skill = await skillRepository.findById(skillId, organizationId);
    if (!skill) return null;
    return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: skill.s3_bucket, Key: `${skill.s3_prefix}skill.zip` }), { expiresIn: 3600 });
  }

  async getAgentSkills(organizationId: string, agentId: string): Promise<SkillEntity[]> {
    return skillRepository.findByAgentId(organizationId, agentId);
  }

  async assignSkillToAgent(organizationId: string, agentId: string, skillId: string, assignedBy?: string): Promise<void> {
    const skill = await skillRepository.findById(skillId, organizationId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);
    await skillRepository.assignToAgent(agentId, skillId, assignedBy);
    await this.bumpScopeForAgent(organizationId, agentId);
  }

  async removeSkillFromAgent(_organizationId: string, agentId: string, skillId: string): Promise<void> {
    await skillRepository.removeFromAgent(agentId, skillId);
    await this.bumpScopeForAgent(_organizationId, agentId);
  }

  async setAgentSkills(organizationId: string, agentId: string, skillIds: string[], assignedBy?: string): Promise<void> {
    const skills = await skillRepository.findByIds(organizationId, skillIds);
    if (skills.length !== skillIds.length) throw new Error('One or more skills not found');
    await skillRepository.replaceAgentSkills(agentId, skillIds, assignedBy);
    await this.bumpScopeForAgent(organizationId, agentId);
  }

  /**
   * Bump config version for the business scope an agent belongs to.
   */
  private async bumpScopeForAgent(organizationId: string, agentId: string): Promise<void> {
    try {
      const agent = await agentRepository.findById(agentId, organizationId);
      if (agent?.business_scope_id) {
        await businessScopeService.bumpConfigVersion(agent.business_scope_id, organizationId);
      }
    } catch (err) {
      console.error(`Failed to bump config_version for agent ${agentId}'s scope:`, err);
    }
  }

  async getScopeSkills(organizationId: string, businessScopeId: string): Promise<SkillForRuntime[]> {
    const skills = await skillRepository.findByBusinessScope(organizationId, businessScopeId);
    return skills.map(s => ({ id: s.id, name: s.name, hash_id: s.hash_id, s3_bucket: s.s3_bucket, s3_prefix: s.s3_prefix, version: s.version }));
  }

  async skillExists(organizationId: string, skillId: string): Promise<boolean> {
    return (await skillRepository.findById(skillId, organizationId)) !== null;
  }

  async findByName(organizationId: string, name: string): Promise<SkillEntity | null> {
    return skillRepository.findByName(organizationId, name);
  }

  /**
   * Create a scope-level skill (attached to business scope, not to any agent).
   */
  async createScopeLevelSkill(
    organizationId: string,
    businessScopeId: string,
    input: CreateSkillInput & { skillType?: string },
  ): Promise<SkillEntity> {
    const hashId = generateHashId(organizationId, input.name);
    const skill = await skillRepository.create(organizationId, {
      name: input.name,
      display_name: input.display_name,
      description: input.description || null,
      hash_id: hashId,
      s3_bucket: SKILLS_BUCKET,
      s3_prefix: `skills/${hashId}/`,
      version: input.version || '1.0.0',
      status: 'active',
      skill_type: input.skillType || 'general',
      tags: input.tags || [],
      metadata: input.metadata || {},
    });

    // Set business_scope_id (Prisma create doesn't include it in the spread above)
    const updated = await skillRepository.update(skill.id, organizationId, {
      business_scope_id: businessScopeId,
    } as Partial<SkillEntity>);

    // Bump scope config version so active sessions pick up the new skill
    await businessScopeService.bumpConfigVersion(businessScopeId, organizationId);

    return updated || skill;
  }

  /**
   * Get all scope-level skills for a business scope.
   */
  async getScopeLevelSkills(organizationId: string, businessScopeId: string): Promise<SkillEntity[]> {
    return skillRepository.findScopeLevelSkills(organizationId, businessScopeId);
  }

  /**
   * Get all skills from all agents in a business scope (via agent_skills).
   * Returns deduplicated skill entities.
   */
  async getAllAgentSkillsForScope(organizationId: string, businessScopeId: string): Promise<SkillEntity[]> {
    const agents = await agentRepository.findByBusinessScope(organizationId, businessScopeId);
    const skillMap = new Map<string, SkillEntity>();
    for (const agent of agents) {
      const skills = await skillRepository.findByAgentId(organizationId, agent.id);
      for (const s of skills) {
        if (!skillMap.has(s.id)) skillMap.set(s.id, s);
      }
    }
    return Array.from(skillMap.values());
  }

  /**
   * Get scope-level API integration skills for a business scope.
   */
  async getScopeIntegrations(organizationId: string, businessScopeId: string): Promise<SkillEntity[]> {
    return skillRepository.findScopeLevelSkillsByType(organizationId, businessScopeId, 'api_integration');
  }

  /**
   * Delete a scope-level skill.
   */
  async deleteScopeLevelSkill(organizationId: string, skillId: string): Promise<boolean> {
    const skill = await skillRepository.findById(skillId, organizationId);
    if (!skill || !skill.business_scope_id) return false;

    const scopeId = skill.business_scope_id;
    const deleted = await this.deleteSkill(organizationId, skillId);
    if (deleted) {
      await businessScopeService.bumpConfigVersion(scopeId, organizationId);
    }
    return deleted;
  }

  /**
   * Update the SKILL.md content for a skill.
   * Writes to the local file path stored in metadata.localPath.
   */
  async updateSkillContent(organizationId: string, skillId: string, content: string): Promise<boolean> {
    const skill = await skillRepository.findById(skillId, organizationId);
    if (!skill) return false;

    const metadata = skill.metadata as Record<string, unknown> | null;
    const localPath = metadata?.localPath as string | undefined;

    if (!localPath) {
      // No local path - create one in data/skills/{hash_id}/
      const skillDir = join(process.cwd(), 'data', 'skills', skill.hash_id);
      await mkdir(skillDir, { recursive: true });
      const skillMdPath = join(skillDir, 'SKILL.md');
      await writeFile(skillMdPath, content, 'utf-8');
      
      // Update metadata with the new local path
      const newMetadata = { ...metadata, localPath: skillDir };
      await skillRepository.update(skillId, organizationId, { metadata: newMetadata });
      return true;
    }

    // Write to existing local path
    const skillMdPath = join(localPath, 'SKILL.md');
    await mkdir(dirname(skillMdPath), { recursive: true });
    await writeFile(skillMdPath, content, 'utf-8');
    return true;
  }
}


export const skillService = new SkillService();
