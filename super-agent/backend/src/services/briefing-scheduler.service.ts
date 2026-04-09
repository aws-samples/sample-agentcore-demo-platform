import { prisma } from '../config/database.js';
import { briefingGeneratorService } from './briefing-generator.service.js';

export class BriefingSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;

  // Start the background job
  start() {
    if (this.intervalId) return;

    // Run immediately on start
    this.generateBriefings().catch(console.error);

    // Then run every 5 minutes
    this.intervalId = setInterval(() => {
      this.generateBriefings().catch(console.error);
    }, 5 * 60 * 1000);

    console.log('Briefing scheduler started (runs every 5 minutes)');
  }

  // Stop the background job
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Briefing scheduler stopped');
    }
  }

  // Main generation logic
  private async generateBriefings() {
    const scopes = await prisma.business_scopes.findMany({
      where: { deleted_at: null },
      select: { id: true, name: true, organization_id: true },
    });

    console.log(`Checking briefings for ${scopes.length} active scopes...`);

    for (const scope of scopes) {
      try {
        await this.generateForScope(scope.id, scope.organization_id);
      } catch (error) {
        console.error(`Failed to generate briefings for scope ${scope.name}:`, error);
      }
    }
  }

  // Generate briefings for a single scope
  private async generateForScope(scopeId: string, _orgId: string) {
    let generated = 0;

    // 1. Workflow executions
    const workflowIds = await briefingGeneratorService.getUnprocessedWorkflowExecutions(scopeId);
    for (const id of workflowIds) {
      const briefing = await briefingGeneratorService.generateWorkflowBriefing(id);
      if (briefing) {
        const saved = await briefingGeneratorService.saveBriefingIfNew(scopeId, briefing);
        if (saved) generated++;
      }
    }

    // 2. Chat sessions
    const sessionIds = await briefingGeneratorService.getUnprocessedChatSessions(scopeId);
    for (const id of sessionIds) {
      const briefing = await briefingGeneratorService.generateChatBriefing(id);
      if (briefing) {
        const saved = await briefingGeneratorService.saveBriefingIfNew(scopeId, briefing);
        if (saved) generated++;
      }
    }

    // 3. Documents
    const docIds = await briefingGeneratorService.getUnprocessedDocuments(scopeId);
    for (const id of docIds) {
      const briefing = await briefingGeneratorService.generateDocumentBriefing(id);
      if (briefing) {
        const saved = await briefingGeneratorService.saveBriefingIfNew(scopeId, briefing);
        if (saved) generated++;
      }
    }

    // 4. Scope memories
    const memoryIds = await briefingGeneratorService.getUnprocessedMemories(scopeId);
    for (const id of memoryIds) {
      const briefing = await briefingGeneratorService.generateMemoryBriefing(id);
      if (briefing) {
        const saved = await briefingGeneratorService.saveBriefingIfNew(scopeId, briefing);
        if (saved) generated++;
      }
    }

    // 5. Archive old briefings
    await briefingGeneratorService.archiveOldBriefings(scopeId, 7);

    if (generated > 0) {
      console.log(`Generated ${generated} new briefings for scope ${scopeId}`);
    }
  }
}

export const briefingScheduler = new BriefingSchedulerService();
