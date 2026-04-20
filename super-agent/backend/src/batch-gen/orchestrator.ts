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
