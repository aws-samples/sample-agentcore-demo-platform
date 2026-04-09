/**
 * Rehearsal Scheduler Service
 *
 * Periodically checks scope memories for rehearsal trigger conditions:
 * - ≥3 gap memories with overlapping tags
 * - ≥5 lesson memories
 * - Max 1 auto-rehearsal per scope per day
 */

import { prisma } from '../config/database.js';
import { rehearsalService } from './rehearsal.service.js';

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const GAP_THRESHOLD = 3;
const LESSON_THRESHOLD = 5;

export class RehearsalSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;

  start(): void {
    if (this.intervalId) return;

    // First check after 2 minutes (let the server warm up)
    setTimeout(() => {
      this.checkAllScopes().catch(console.error);
    }, 2 * 60 * 1000);

    this.intervalId = setInterval(() => {
      this.checkAllScopes().catch(console.error);
    }, CHECK_INTERVAL_MS);

    console.log('[rehearsal-scheduler] Started (checks every 30 minutes)');
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[rehearsal-scheduler] Stopped');
    }
  }

  private async checkAllScopes(): Promise<void> {
    const scopes = await prisma.business_scopes.findMany({
      where: { deleted_at: null },
      select: { id: true, name: true, organization_id: true },
    });

    for (const scope of scopes) {
      try {
        await this.checkScope(scope.id, scope.organization_id);
      } catch (err) {
        console.error(`[rehearsal-scheduler] Error checking scope ${scope.name}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  private async checkScope(scopeId: string, organizationId: string): Promise<void> {
    // Check if we already ran a rehearsal today for this scope
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recentRehearsal = await prisma.rehearsal_sessions.findFirst({
      where: {
        business_scope_id: scopeId,
        rehearsal_type: 'memory_triggered',
        created_at: { gte: today },
      },
    });

    if (recentRehearsal) return; // Already ran today

    // Load recent unprocessed memories (created since last rehearsal)
    const lastRehearsal = await prisma.rehearsal_sessions.findFirst({
      where: { business_scope_id: scopeId, status: 'completed' },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });

    const since = lastRehearsal?.created_at ?? new Date(0);

    const memories = await prisma.scope_memories.findMany({
      where: {
        business_scope_id: scopeId,
        created_at: { gt: since },
      },
      orderBy: { created_at: 'desc' },
    });

    const gaps = memories.filter(m => m.category === 'gap');
    const lessons = memories.filter(m => m.category === 'lesson');

    let shouldTrigger = false;

    // Condition 1: ≥3 gaps with overlapping tags
    if (gaps.length >= GAP_THRESHOLD) {
      const tagCounts = new Map<string, number>();
      for (const g of gaps) {
        for (const tag of g.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
      }
      const hasOverlap = [...tagCounts.values()].some(count => count >= 2);
      if (hasOverlap) shouldTrigger = true;
    }

    // Condition 2: ≥5 lessons
    if (lessons.length >= LESSON_THRESHOLD) {
      shouldTrigger = true;
    }

    if (!shouldTrigger) return;

    console.log(`[rehearsal-scheduler] Triggering rehearsal for scope ${scopeId} (${gaps.length} gaps, ${lessons.length} lessons)`);

    try {
      await rehearsalService.runRehearsal(organizationId, scopeId, {
        rehearsalType: 'memory_triggered',
      });
    } catch (err) {
      console.error(`[rehearsal-scheduler] Rehearsal failed for scope ${scopeId}:`, err instanceof Error ? err.message : err);
    }
  }
}

export const rehearsalScheduler = new RehearsalSchedulerService();
