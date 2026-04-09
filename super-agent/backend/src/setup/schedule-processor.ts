/**
 * Schedule Processor Setup
 * 
 * Sets up a recurring job to process due workflow schedules.
 * This runs every minute to check for schedules that need to be executed.
 */

import { scheduleService } from '../services/schedule.service.js';

const POLL_INTERVAL_MS = 15_000; // 15 seconds — keeps cron trigger latency under 15s

let intervalId: NodeJS.Timeout | null = null;

/**
 * Start the schedule processor
 */
export function startScheduleProcessor(): void {
  if (intervalId) {
    console.log('[SCHEDULE_PROCESSOR] Already running');
    return;
  }

  console.log('[SCHEDULE_PROCESSOR] Starting schedule processor');

  // Run immediately on startup
  processSchedules();

  // Then run every minute
  intervalId = setInterval(processSchedules, POLL_INTERVAL_MS);
}

/**
 * Stop the schedule processor
 */
export function stopScheduleProcessor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[SCHEDULE_PROCESSOR] Stopped');
  }
}

/**
 * Process due schedules
 */
async function processSchedules(): Promise<void> {
  try {
    const processedCount = await scheduleService.processDueSchedules();
    if (processedCount > 0) {
      console.log(`[SCHEDULE_PROCESSOR] Processed ${processedCount} schedules`);
    }
  } catch (error: any) {
    console.error(`[SCHEDULE_PROCESSOR] Error processing schedules: ${error.message}`);
  }
}
