/**
 * Industry Pack Deploy Service
 *
 * "领用" (provision/deploy) an industry pack scope into an organization's workspace.
 * Reads from the file-system based industry-packs/ directory and creates:
 *   - business_scopes record
 *   - agents records (with system_prompt)
 *   - skills records (with SKILL.md content written to local storage)
 *   - agent_skills junction records
 *   - scope_memories records
 *   - scope_briefings record (SOP)
 *   - workflows record (workflow DAG)
 *
 * This is a "fork" operation — the organization gets its own mutable copy.
 */

import { readFile, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { prisma } from '../config/database.js';
import { skillService } from './skill.service.js';
import { workflowService } from './workflow.service.js';

// ============================================================================
// Types
// ============================================================================

export interface DeployPackInput {
  /** Organization ID to deploy into */
  organizationId: string;
  /** User ID performing the deploy */
  userId: string;
  /** Pack ID (e.g. "customer-service") */
  packId: string;
  /** Scope directory name within the pack (e.g. "ticket-processing") */
  scopeDirName: string;
  /** Optional: custom name for the deployed scope (defaults to pack's scope name) */
  customName?: string;
}

export interface DeployResult {
  scopeId: string;
  scopeName: string;
  agentCount: number;
  skillCount: number;
  memoryCount: number;
  hasSop: boolean;
  hasWorkflow: boolean;
  workflowId?: string;
}

interface AgentDef {
  name: string;
  display_name: string;
  role?: string;
  system_prompt?: string;
  skills?: string[];
  status?: string;
}

interface MemoryEntry {
  title: string;
  content: string;
  category?: string;
  is_pinned?: boolean;
}

// ============================================================================
// Service
// ============================================================================

class PackDeployService {
  private getPacksBaseDir(): string {
    // industry-packs/ is at the repo root, backend is one level down
    return resolve(process.cwd(), '..', 'industry-packs');
  }

  /**
   * List all available packs and their scopes (for the UI to display what can be deployed)
   */
  async listAvailablePacks(): Promise<Array<{
    packId: string;
    industry: string;
    icon: string;
    scopes: Array<{ dirName: string; name: string; agentCount: number; description: string }>;
  }>> {
    const baseDir = this.getPacksBaseDir();
    const results: Array<{
      packId: string;
      industry: string;
      icon: string;
      scopes: Array<{ dirName: string; name: string; agentCount: number; description: string }>;
    }> = [];

    const entries = await readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('industry-pack-')) continue;

      const packDir = join(baseDir, entry.name);
      const manifestPath = join(packDir, 'manifest.json');
      const templatePath = join(packDir, 'template-input.json');

      if (!existsSync(manifestPath) && !existsSync(templatePath)) continue;

      let packId: string;
      let industry: string;
      let icon: string;
      let scopes: Array<{ dirName: string; name: string; agentCount: number; description: string }> = [];

      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
        packId = manifest.industry?.id || entry.name.replace('industry-pack-', '');
        industry = manifest.industry?.name || packId;
        icon = manifest.industry?.icon || '📦';
        scopes = (manifest.scopes || []).map((s: any) => ({
          dirName: s.dirName,
          name: s.name,
          agentCount: s.agents?.length || 0,
          description: '',
        }));
      } else {
        const template = JSON.parse(await readFile(templatePath, 'utf-8'));
        packId = template.id;
        industry = template.industry;
        icon = template.icon;
        scopes = (template.scopeSeeds || []).map((s: any) => ({
          dirName: s.name, // will be resolved later
          name: s.name,
          agentCount: s.agentCountHint || 0,
          description: s.description || '',
        }));
      }

      // Enrich scope descriptions from master-plan if available
      const masterPlanPath = join(packDir, 'master-plan.json');
      if (existsSync(masterPlanPath)) {
        try {
          const masterPlan = JSON.parse(await readFile(masterPlanPath, 'utf-8'));
          const planScopes = masterPlan.scopes || [];
          for (const scope of scopes) {
            const planScope = planScopes.find((ps: any) => ps.dirName === scope.dirName || ps.name === scope.name);
            if (planScope?.description) {
              scope.description = planScope.description.slice(0, 200);
            }
          }
        } catch { /* ignore */ }
      }

      results.push({ packId, industry, icon, scopes });
    }

    return results;
  }

  /**
   * Deploy (provision) a pack scope into an organization's workspace.
   */
  async deploy(input: DeployPackInput): Promise<DeployResult> {
    const { organizationId, userId, packId, scopeDirName, customName } = input;
    const baseDir = this.getPacksBaseDir();
    const packDir = join(baseDir, `industry-pack-${packId}`);

    if (!existsSync(packDir)) {
      throw new Error(`Pack not found: industry-pack-${packId}`);
    }

    const scopeDir = join(packDir, 'scopes', scopeDirName);
    if (!existsSync(scopeDir)) {
      throw new Error(`Scope not found: ${scopeDirName} in pack ${packId}`);
    }

    // Read scope.json for metadata
    const scopeJsonPath = join(scopeDir, 'scope.json');
    let scopeMeta: any = {};
    if (existsSync(scopeJsonPath)) {
      scopeMeta = JSON.parse(await readFile(scopeJsonPath, 'utf-8'));
    }

    // Read manifest for industry info
    let industryIcon = '📦';
    let industryColor = '#6366F1';
    const manifestPath = join(packDir, 'manifest.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
      industryIcon = manifest.industry?.icon || industryIcon;
      industryColor = manifest.industry?.color || industryColor;
    }

    const scopeName = customName || scopeMeta.name || scopeDirName;

    // Check if scope with same name already exists
    const existing = await prisma.business_scopes.findFirst({
      where: { organization_id: organizationId, name: scopeName, deleted_at: null },
    });
    if (existing) {
      // Idempotent behavior — but check if workflow needs to be backfilled
      const existingAgents = await prisma.agents.findMany({
        where: { organization_id: organizationId, business_scope_id: existing.id },
        select: { id: true, name: true },
      });

      let hasWorkflow = false;
      let workflowId: string | undefined;

      // Check if workflow already exists for this scope
      const existingWorkflow = await prisma.workflows.findFirst({
        where: { organization_id: organizationId, business_scope_id: existing.id },
        select: { id: true },
      });

      if (existingWorkflow) {
        hasWorkflow = true;
        workflowId = existingWorkflow.id;
      } else {
        // Backfill: create workflow if workflow-plan.json exists but wasn't imported
        const workflowPath = join(scopeDir, 'workflow', 'workflow-plan.json');
        if (existsSync(workflowPath)) {
          try {
            const workflowPlan = JSON.parse(await readFile(workflowPath, 'utf-8'));

            // Build agentRef → agentId mapping
            const agentRefMap = new Map<string, string>();
            for (const agent of existingAgents) {
              agentRefMap.set(agent.name, agent.id);
            }

            const nodes = (workflowPlan.nodes || []).map((node: any) => {
              const agentRef = node.metadata?.agentRef;
              const resolvedAgentId = agentRef ? agentRefMap.get(agentRef) : undefined;
              return {
                id: node.id,
                type: node.type || 'agent',
                label: node.title,
                description: node.prompt || '',
                position: node.position || { x: 0, y: 0 },
                agentId: resolvedAgentId || undefined,
                metadata: node.metadata || {},
                dependentTasks: node.dependentTasks || [],
              };
            });

            const connections = (workflowPlan.edges || []).map((edge: any) => ({
              id: `${edge.source}->${edge.target}`,
              from: edge.source,
              to: edge.target,
            }));

            const workflow = await workflowService.createWorkflow(
              {
                name: workflowPlan.title || `${scopeName} Workflow`,
                version: '1.0.0',
                business_scope_id: existing.id,
                is_official: true,
                nodes,
                connections,
              },
              organizationId,
              userId,
            );

            hasWorkflow = true;
            workflowId = workflow.id;
          } catch (err) {
            console.warn(`[pack-deploy] Failed to backfill workflow for ${scopeDirName}:`, err);
          }
        }
      }

      return {
        scopeId: existing.id,
        scopeName: existing.name,
        agentCount: existingAgents.length,
        skillCount: 0,
        memoryCount: 0,
        hasSop: false,
        hasWorkflow,
        workflowId,
      };
    }

    // ====================================================================
    // 1. Create business_scope
    // ====================================================================
    const scope = await prisma.business_scopes.create({
      data: {
        organization_id: organizationId,
        name: scopeName,
        description: scopeMeta.description || `Deployed from industry pack: ${packId}/${scopeDirName}`,
        icon: scopeMeta.icon || industryIcon,
        color: scopeMeta.color || industryColor,
        scope_type: 'business',
        settings: {
          source: 'industry-pack',
          pack_id: packId,
          scope_dir: scopeDirName,
          deployed_at: new Date().toISOString(),
          deployed_by: userId,
        },
      },
    });

    // ====================================================================
    // 2. Create agents
    // ====================================================================
    const agentsDir = join(scopeDir, 'agents');
    const agentFiles = existsSync(agentsDir)
      ? (await readdir(agentsDir)).filter(f => f.endsWith('.json'))
      : [];

    const createdAgents: Array<{ id: string; name: string; skillNames: string[] }> = [];

    for (const agentFile of agentFiles) {
      const agentDef: AgentDef = JSON.parse(
        await readFile(join(agentsDir, agentFile), 'utf-8'),
      );

      const agent = await prisma.agents.create({
        data: {
          organization_id: organizationId,
          business_scope_id: scope.id,
          name: agentDef.name,
          display_name: agentDef.display_name || agentDef.name,
          role: agentDef.role || null,
          avatar: (agentDef.display_name || agentDef.name).charAt(0),
          status: 'active',
          system_prompt: agentDef.system_prompt || null,
          model_config: { provider: 'Bedrock', modelId: 'claude-sonnet-4-20250514', agentType: 'Worker' },
          origin: 'industry_pack',
          metrics: {},
          tools: [],
          scope: [],
        },
      });

      createdAgents.push({
        id: agent.id,
        name: agent.name,
        skillNames: agentDef.skills || [],
      });
    }

    // ====================================================================
    // 3. Create skills and link to agents
    // ====================================================================
    const skillsDir = join(scopeDir, 'skills');
    let skillCount = 0;

    if (existsSync(skillsDir)) {
      const skillDirs = (await readdir(skillsDir, { withFileTypes: true }))
        .filter(d => d.isDirectory());

      for (const skillDir of skillDirs) {
        const skillMdPath = join(skillsDir, skillDir.name, 'SKILL.md');
        if (!existsSync(skillMdPath)) continue;

        const skillContent = await readFile(skillMdPath, 'utf-8');
        // Extract display name from first heading
        const headingMatch = skillContent.match(/^#\s+(.+)/m);
        const displayName = headingMatch?.[1] || skillDir.name;

        // Create skill
        const skill = await skillService.createScopeLevelSkill(
          organizationId,
          scope.id,
          {
            name: skillDir.name,
            display_name: displayName,
            description: `Skill from industry pack: ${packId}/${scopeDirName}`,
            tags: ['industry-pack', packId],
            metadata: {
              source: 'industry-pack',
              pack_id: packId,
              scope_dir: scopeDirName,
              skill_dir: skillDir.name,
            },
          },
        );

        // Write SKILL.md content
        await skillService.updateSkillContent(organizationId, skill.id, skillContent);
        skillCount++;

        // Link skill to agents that reference it
        for (const agent of createdAgents) {
          if (agent.skillNames.includes(skillDir.name)) {
            await skillService.assignSkillToAgent(organizationId, agent.id, skill.id, userId);
          }
        }
      }
    }

    // ====================================================================
    // 4. Import memories
    // ====================================================================
    const memoriesPath = join(scopeDir, 'memories', 'initial-memories.json');
    let memoryCount = 0;

    if (existsSync(memoriesPath)) {
      try {
        const memories: MemoryEntry[] = JSON.parse(await readFile(memoriesPath, 'utf-8'));
        for (const mem of memories) {
          await prisma.scope_memories.create({
            data: {
              organization_id: organizationId,
              business_scope_id: scope.id,
              title: mem.title,
              content: mem.content,
              category: mem.category || 'general',
              is_pinned: mem.is_pinned || false,
              created_by: userId,
            },
          });
          memoryCount++;
        }
      } catch (err) {
        console.warn(`[pack-deploy] Failed to import memories for ${scopeDirName}:`, err);
      }
    }

    // ====================================================================
    // 5. Import SOP as briefing
    // ====================================================================
    const sopPath = join(scopeDir, 'sop', 'sop.md');
    let hasSop = false;

    if (existsSync(sopPath)) {
      try {
        const sopContent = await readFile(sopPath, 'utf-8');
        await prisma.scope_briefings.create({
          data: {
            organization_id: organizationId,
            business_scope_id: scope.id,
            title: `${scopeName} — 标准操作流程 (SOP)`,
            content: sopContent,
            briefing_type: 'sop',
            is_active: true,
            created_by: userId,
          },
        });
        hasSop = true;
      } catch (err) {
        console.warn(`[pack-deploy] Failed to import SOP for ${scopeDirName}:`, err);
      }
    }

    // ====================================================================
    // 6. Import workflow
    // ====================================================================
    const workflowPath = join(scopeDir, 'workflow', 'workflow-plan.json');
    let hasWorkflow = false;
    let workflowId: string | undefined;

    if (existsSync(workflowPath)) {
      try {
        const workflowPlan = JSON.parse(await readFile(workflowPath, 'utf-8'));

        // Build agentRef → agentId mapping from created agents
        const agentRefMap = new Map<string, string>();
        for (const agent of createdAgents) {
          agentRefMap.set(agent.name, agent.id);
        }

        // Transform nodes: resolve agentRef to agentId and map to frontend-expected format
        const nodes = (workflowPlan.nodes || []).map((node: any) => {
          const agentRef = node.metadata?.agentRef;
          const resolvedAgentId = agentRef ? agentRefMap.get(agentRef) : undefined;
          return {
            id: node.id,
            type: node.type || 'agent',
            label: node.title,
            description: node.prompt || '',
            position: node.position || { x: 0, y: 0 },
            agentId: resolvedAgentId || undefined,
            metadata: node.metadata || {},
            dependentTasks: node.dependentTasks || [],
          };
        });

        // Edges mapped to frontend-expected format (from/to instead of source/target)
        const connections = (workflowPlan.edges || []).map((edge: any) => ({
          id: `${edge.source}->${edge.target}`,
          from: edge.source,
          to: edge.target,
        }));

        const workflow = await workflowService.createWorkflow(
          {
            name: workflowPlan.title || `${scopeName} Workflow`,
            version: '1.0.0',
            business_scope_id: scope.id,
            is_official: true,
            nodes,
            connections,
          },
          organizationId,
          userId,
        );

        hasWorkflow = true;
        workflowId = workflow.id;
      } catch (err) {
        console.warn(`[pack-deploy] Failed to import workflow for ${scopeDirName}:`, err);
      }
    }

    return {
      scopeId: scope.id,
      scopeName,
      agentCount: createdAgents.length,
      skillCount,
      memoryCount,
      hasSop,
      hasWorkflow,
      workflowId,
    };
  }

  /**
   * Check if a scope from a pack has already been deployed to an organization.
   */
  async isDeployed(organizationId: string, packId: string, scopeDirName: string): Promise<boolean> {
    const scope = await this.findDeployedScope(organizationId, packId, scopeDirName);
    return !!scope;
  }

  /**
   * Find an already-deployed scope by pack ID and scope dir name.
   */
  async findDeployedScope(organizationId: string, packId: string, scopeDirName: string): Promise<{ id: string; name: string } | null> {
    // Search by settings JSON field
    const scopes = await prisma.business_scopes.findMany({
      where: {
        organization_id: organizationId,
        deleted_at: null,
      },
      select: { id: true, name: true, settings: true },
    });

    for (const scope of scopes) {
      const settings = scope.settings as any;
      if (settings?.pack_id === packId && settings?.scope_dir === scopeDirName) {
        return { id: scope.id, name: scope.name };
      }
    }
    return null;
  }
}

export const packDeployService = new PackDeployService();
