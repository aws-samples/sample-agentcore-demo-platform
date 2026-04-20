/**
 * Project Auto-Processor
 *
 * Server-side scheduler that periodically checks for projects with auto_process
 * enabled and triggers execution of their next todo issue.
 *
 * This ensures auto-processing continues even when no browser tab is open.
 */

import { prisma } from '../config/database.js';
import { projectService } from '../services/project.service.js';

let intervalHandle: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 15_000; // 15 seconds

/**
 * Start the project auto-processor.
 * Polls every 15 seconds for projects with auto_process enabled.
 */
export function startProjectAutoProcessor(): void {
  if (intervalHandle) return; // already running

  console.log('[ProjectAutoProcessor] Starting (poll every 15s)');

  intervalHandle = setInterval(async () => {
    try {
      await processAutoProjects();
    } catch (err) {
      console.error('[ProjectAutoProcessor] Error:', err instanceof Error ? err.message : err);
    }
  }, POLL_INTERVAL_MS);

  // Don't prevent Node from exiting
  if (intervalHandle.unref) intervalHandle.unref();
}

/**
 * Stop the project auto-processor.
 */
export function stopProjectAutoProcessor(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[ProjectAutoProcessor] Stopped');
  }
}

/**
 * Find all projects with auto_process enabled and trigger next task if idle.
 */
async function processAutoProjects(): Promise<void> {
  // Find projects where settings contains auto_process: true
  // Prisma JSON filtering: settings.auto_process == true
  const projects = await prisma.projects.findMany({
    where: {
      settings: { path: ['auto_process'], equals: true },
    },
    select: {
      id: true,
      organization_id: true,
      created_by: true,
      business_scope_id: true,
    },
  });

  if (projects.length === 0) return;

  for (const project of projects) {
    // Skip projects without a business scope (can't execute without one)
    if (!project.business_scope_id) continue;

    try {
      const result = await projectService.autoProcessNext(
        project.organization_id,
        project.id,
        project.created_by,
      );
      if (result) {
        console.log(`[ProjectAutoProcessor] Started issue execution for project ${project.id}`);
      }
    } catch (err) {
      console.error(`[ProjectAutoProcessor] Failed for project ${project.id}:`, err instanceof Error ? err.message : err);
    }
  }
}
