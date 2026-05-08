/**
 * Batch Generation Orchestrator
 *
 * Standalone offline tool that generates a complete industry solution pack
 * using Claude Code workspace sessions (Opus model).
 *
 * This is an ADDITIVE module — it does NOT modify any existing code.
 * It imports the existing ClaudeAgentRuntime as a read-only dependency.
 */

import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

import { ClaudeAgentRuntime } from '../services/agent-runtime-claude.js';
import type { AgentConfig } from '../services/agent-runtime.js';
import type { IndustryTemplate, ProgressCallback } from './types.js';
import {
  MASTER_PLANNER_SYSTEM_PROMPT,
  buildMasterPlannerMessage,
  SCOPE_GENERATOR_SYSTEM_PROMPT,
  buildScopeGeneratorMessage,
  TWIN_GENERATOR_SYSTEM_PROMPT,
  buildTwinGeneratorMessage,
  VALIDATOR_SYSTEM_PROMPT,
  PACKAGER_SYSTEM_PROMPT,
} from './prompts.js';

const runtime = new ClaudeAgentRuntime();

export class BatchGenerationOrchestrator {
  /**
   * Generate a complete industry solution pack.
   *
   * @param template  - The industry template seed
   * @param outputDir - Parent directory; pack will be created as a subdirectory
   * @param onProgress - Optional progress callback
   * @returns Path to the generated pack directory
   */
  async generate(
    template: IndustryTemplate,
    outputDir: string,
    onProgress?: ProgressCallback,
  ): Promise<string> {
    const packDir = join(outputDir, `industry-pack-${template.id}`);
    await mkdir(packDir, { recursive: true });

    // Write template input for the planner to read
    await writeFile(
      join(packDir, 'template-input.json'),
      JSON.stringify(template, null, 2),
    );

    // ==================================================================
    // Step 1: Master Planner
    // ==================================================================
    onProgress?.('step-1', 'Master Planner: analyzing industry, planning Scopes and Agent matrix');

    await this.runWorkspaceTask({
      taskId: 'master-planner',
      workspacePath: packDir,
      systemPrompt: MASTER_PLANNER_SYSTEM_PROMPT,
      message: buildMasterPlannerMessage(template),
    });

    const masterPlanPath = join(packDir, 'master-plan.json');
    if (!existsSync(masterPlanPath)) {
      throw new Error('Master Planner failed to produce master-plan.json');
    }
    const masterPlan = JSON.parse(await readFile(masterPlanPath, 'utf-8'));
    const scopes: Array<Record<string, unknown>> = masterPlan.scopes ?? [];

    console.log(`[batch-gen] Master plan: ${scopes.length} scopes planned`);

    // ==================================================================
    // Step 2: Generate each Scope
    // ==================================================================
    for (let i = 0; i < scopes.length; i++) {
      const scopePlan = scopes[i]!;
      const dirName = scopePlan.dirName as string;
      const scopeName = scopePlan.name as string;
      onProgress?.('step-2', `Scope ${i + 1}/${scopes.length}: ${scopeName}`);

      const scopeDir = join(packDir, 'scopes', dirName);
      // Create directory structure
      for (const sub of ['agents', 'skills', 'workflow', 'sop', 'memories']) {
        await mkdir(join(scopeDir, sub), { recursive: true });
      }

      // Write inputs for the scope generator
      await writeFile(join(scopeDir, 'scope-plan-input.json'), JSON.stringify(scopePlan, null, 2));
      await writeFile(join(scopeDir, 'master-plan-ref.json'), JSON.stringify(masterPlan, null, 2));

      await this.runWorkspaceTask({
        taskId: `scope-gen-${dirName}`,
        workspacePath: scopeDir,
        systemPrompt: SCOPE_GENERATOR_SYSTEM_PROMPT,
        message: buildScopeGeneratorMessage(scopePlan, template),
      });

      console.log(`[batch-gen] Scope "${scopeName}" generated`);
    }

    // ==================================================================
    // Step 3: Digital Twins
    // ==================================================================
    const twins = template.twinSeeds ?? [];
    if (twins.length > 0) {
      const twinsDir = join(packDir, 'digital-twins');
      await mkdir(twinsDir, { recursive: true });

      for (let i = 0; i < twins.length; i++) {
        const seed = twins[i]!;
        onProgress?.('step-3', `Digital Twin ${i + 1}/${twins.length}: ${seed.displayName}`);

        const twinDirName = seed.displayName.replace(/[\s/]+/g, '-').toLowerCase();
        const twinDir = join(twinsDir, twinDirName);
        await mkdir(join(twinDir, 'skills'), { recursive: true });

        await writeFile(join(twinDir, 'twin-seed-input.json'), JSON.stringify(seed, null, 2));

        await this.runWorkspaceTask({
          taskId: `twin-gen-${i}`,
          workspacePath: twinDir,
          systemPrompt: TWIN_GENERATOR_SYSTEM_PROMPT,
          message: buildTwinGeneratorMessage(seed, template),
        });

        console.log(`[batch-gen] Twin "${seed.displayName}" generated`);
      }
    }

    // ==================================================================
    // Step 4: Cross-validation
    // ==================================================================
    onProgress?.('step-4', 'Cross-validation: checking consistency of all artifacts');

    await this.runWorkspaceTask({
      taskId: 'validator',
      workspacePath: packDir,
      systemPrompt: VALIDATOR_SYSTEM_PROMPT,
      message: 'Traverse all subdirectories under the current directory. Validate every generated artifact for completeness, reference consistency, content quality, and logical correctness. Fix any FAIL-level issues directly. Write the final report to validation-report.md.',
    });

    console.log('[batch-gen] Validation complete');

    // ==================================================================
    // Step 5: Package manifest + README
    // ==================================================================
    onProgress?.('step-5', 'Generating manifest.json and README.md');

    await this.runWorkspaceTask({
      taskId: 'packager',
      workspacePath: packDir,
      systemPrompt: PACKAGER_SYSTEM_PROMPT,
      message: 'Traverse the current directory, catalog all artifacts, and generate manifest.json and README.md.',
    });

    onProgress?.('done', `Industry pack generated: ${packDir}`);
    console.log(`[batch-gen] Pack complete: ${packDir}`);
    return packDir;
  }

  /**
   * Incremental generation: only generate specified scopes into an existing pack.
   *
   * This is used when new scopes are added to a template-input.json for a pack
   * that has already been fully generated. It avoids re-generating existing scopes.
   *
   * Flow:
   *   1. Read existing master-plan.json (or generate one if missing)
   *   2. Run Master Planner ONLY for the new scopes (appends to master-plan.json)
   *   3. Run Scope Generator for each new scope
   *   4. Run Validation on new scopes only
   *   5. Update manifest.json with new scope entries
   *
   * @param template - The full industry template (including new scopes)
   * @param outputDir - Parent directory containing the pack
   * @param scopeNames - Names of scopes to generate (must match scopeSeeds[].name)
   * @param onProgress - Optional progress callback
   * @returns Path to the pack directory
   */
  async generateScopesOnly(
    template: IndustryTemplate,
    outputDir: string,
    scopeNames: string[],
    onProgress?: ProgressCallback,
  ): Promise<string> {
    const packDir = join(outputDir, `industry-pack-${template.id}`);

    // Verify pack directory exists
    if (!existsSync(packDir)) {
      throw new Error(
        `Pack directory not found: ${packDir}\n` +
        `--scope-only requires an existing pack. Run full generation first, or create the directory.`
      );
    }

    // Update template-input.json with the latest version
    await writeFile(
      join(packDir, 'template-input.json'),
      JSON.stringify(template, null, 2),
    );

    // ==================================================================
    // Step 1: Incremental Master Planning for new scopes
    // ==================================================================
    onProgress?.('step-1', `Incremental Master Planner: planning ${scopeNames.length} new scope(s)`);

    const masterPlanPath = join(packDir, 'master-plan.json');
    let masterPlan: Record<string, unknown>;

    if (existsSync(masterPlanPath)) {
      masterPlan = JSON.parse(await readFile(masterPlanPath, 'utf-8'));
      console.log(`[batch-gen] Loaded existing master-plan.json`);
    } else {
      // No master plan exists — run full master planner first
      console.log(`[batch-gen] No master-plan.json found, running full Master Planner`);
      await this.runWorkspaceTask({
        taskId: 'master-planner',
        workspacePath: packDir,
        systemPrompt: MASTER_PLANNER_SYSTEM_PROMPT,
        message: buildMasterPlannerMessage(template),
      });
      if (!existsSync(masterPlanPath)) {
        throw new Error('Master Planner failed to produce master-plan.json');
      }
      masterPlan = JSON.parse(await readFile(masterPlanPath, 'utf-8'));
    }

    // Filter scopeSeeds to only the requested ones
    const targetSeeds = template.scopeSeeds.filter(s => scopeNames.includes(s.name));

    // Check which scopes already have plans in master-plan.json
    const existingScopes: Array<Record<string, unknown>> = (masterPlan.scopes as Array<Record<string, unknown>>) ?? [];
    const existingScopeNames = new Set(existingScopes.map(s => s.name as string));

    const newScopeNames = scopeNames.filter(name => !existingScopeNames.has(name));

    if (newScopeNames.length > 0) {
      // Run incremental master planner for scopes not yet in the plan
      const incrementalTemplate: IndustryTemplate = {
        ...template,
        scopeSeeds: targetSeeds.filter(s => newScopeNames.includes(s.name)),
      };

      // Write a temporary incremental input for the planner
      await writeFile(
        join(packDir, 'incremental-scope-input.json'),
        JSON.stringify({
          mode: 'incremental',
          existingMasterPlan: masterPlan,
          newScopes: incrementalTemplate.scopeSeeds,
          industry: template.industry,
          industryContext: template.industryContext,
        }, null, 2),
      );

      await this.runWorkspaceTask({
        taskId: 'master-planner-incremental',
        workspacePath: packDir,
        systemPrompt: MASTER_PLANNER_SYSTEM_PROMPT,
        message: `Read incremental-scope-input.json in the current directory. This is an INCREMENTAL update to an existing master plan.

You must ADD the new scope definitions to the existing master-plan.json WITHOUT modifying or removing any existing scopes.

For each new scope in "newScopes", generate the same detailed plan structure (dirName, name, description, businessContext, agents, workflowOutline, sopOutline, keyMetrics) that existing scopes have.

Append the new scopes to the "scopes" array in master-plan.json and save the updated file.

Industry: ${template.industry}
New scopes to plan: ${newScopeNames.join(', ')}`,
      });

      // Reload updated master plan
      masterPlan = JSON.parse(await readFile(masterPlanPath, 'utf-8'));
      console.log(`[batch-gen] Master plan updated with ${newScopeNames.length} new scope(s)`);
    } else {
      console.log(`[batch-gen] All requested scopes already have plans in master-plan.json`);
    }

    // ==================================================================
    // Step 2: Generate each new Scope
    // ==================================================================
    const allScopes: Array<Record<string, unknown>> = (masterPlan.scopes as Array<Record<string, unknown>>) ?? [];

    for (let i = 0; i < scopeNames.length; i++) {
      const scopeName = scopeNames[i]!;
      const scopePlan = allScopes.find(s => s.name === scopeName);

      if (!scopePlan) {
        console.error(`[batch-gen] WARNING: No plan found for scope "${scopeName}" in master-plan.json, skipping`);
        continue;
      }

      const dirName = scopePlan.dirName as string;
      const scopeDir = join(packDir, 'scopes', dirName);

      // Check if scope directory already exists with content
      if (existsSync(join(scopeDir, 'scope.json'))) {
        console.log(`[batch-gen] Scope "${scopeName}" already exists at ${scopeDir}, skipping`);
        continue;
      }

      onProgress?.('step-2', `Scope ${i + 1}/${scopeNames.length}: ${scopeName}`);

      // Create directory structure
      for (const sub of ['agents', 'skills', 'workflow', 'sop', 'memories']) {
        await mkdir(join(scopeDir, sub), { recursive: true });
      }

      // Write inputs for the scope generator
      await writeFile(join(scopeDir, 'scope-plan-input.json'), JSON.stringify(scopePlan, null, 2));
      await writeFile(join(scopeDir, 'master-plan-ref.json'), JSON.stringify(masterPlan, null, 2));

      await this.runWorkspaceTask({
        taskId: `scope-gen-${dirName}`,
        workspacePath: scopeDir,
        systemPrompt: SCOPE_GENERATOR_SYSTEM_PROMPT,
        message: buildScopeGeneratorMessage(scopePlan, template),
      });

      console.log(`[batch-gen] Scope "${scopeName}" generated`);
    }

    // ==================================================================
    // Step 3: Validation (new scopes only)
    // ==================================================================
    onProgress?.('step-3', 'Validating new scopes');

    await this.runWorkspaceTask({
      taskId: 'validator-incremental',
      workspacePath: packDir,
      systemPrompt: VALIDATOR_SYSTEM_PROMPT,
      message: `Validate ONLY the following newly generated scopes for completeness, reference consistency, content quality, and logical correctness: ${scopeNames.join(', ')}.

Check that each scope has: scope.json, agents/*.json, skills/*/SKILL.md, workflow/workflow-plan.json, sop/sop.md, memories/initial-memories.json.

Fix any FAIL-level issues directly. Append findings to validation-report.md (do not overwrite existing content).`,
    });

    console.log('[batch-gen] Incremental validation complete');

    // ==================================================================
    // Step 4: Update manifest.json
    // ==================================================================
    onProgress?.('step-4', 'Updating manifest.json');

    await this.runWorkspaceTask({
      taskId: 'packager-incremental',
      workspacePath: packDir,
      systemPrompt: PACKAGER_SYSTEM_PROMPT,
      message: `This is an INCREMENTAL update. New scopes have been added: ${scopeNames.join(', ')}.

Read the existing manifest.json and update it:
1. Add the new scopes to the "scopes" array with their agents, skills, hasWorkflow, hasSop info
2. Update the "stats" counts (scopeCount, agentCount, skillCount, etc.)
3. Update the "generatedAt" timestamp

Also update README.md to include the new scopes in the documentation.

Do NOT remove or modify any existing entries — only ADD the new scope information.`,
    });

    onProgress?.('done', `Incremental generation complete: ${scopeNames.length} scope(s) added to ${packDir}`);
    console.log(`[batch-gen] Incremental generation complete: ${packDir}`);
    return packDir;
  }

  /**
   * Run a single Claude Code workspace task.
   * The agent has full file read/write/bash access within the workspace.
   */
  private async runWorkspaceTask(params: {
    taskId: string;
    workspacePath: string;
    systemPrompt: string;
    message: string;
  }): Promise<void> {
    const agentConfig: AgentConfig = {
      id: params.taskId,
      name: params.taskId,
      displayName: params.taskId,
      organizationId: 'system',
      systemPrompt: params.systemPrompt,
      skillIds: [],
      mcpServerIds: [],
    };

    const sessionId = `batch-${params.taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for await (const event of runtime.runConversation(
      {
        agentId: params.taskId,
        sessionId,
        message: params.message,
        organizationId: 'system',
        userId: 'system',
        workspacePath: params.workspacePath,
      },
      agentConfig,
      [], // no pre-loaded skills — the agent generates them
    )) {
      if (event.type === 'error') {
        console.error(`[batch-gen][${params.taskId}] Error: ${event.message}`);
        // Don't throw — the workspace approach means the agent may recover
        // on its own. If it truly fails, the validator step will catch it.
      }
    }
  }
}
