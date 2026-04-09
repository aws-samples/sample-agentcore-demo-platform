/**
 * Workflow Queue Setup
 *
 * Initializes BullMQ queues and registers processors for workflow execution.
 * This module connects the WorkflowQueueService with the WorkflowExecutionService.
 *
 * Requirements:
 * - 1.1: Create execution session and return execution ID
 * - 2.2: Execute nodes in topological order
 */

import { workflowQueueService } from '../services/workflow-queue.service.js';
import { workflowExecutionService } from '../services/workflow-execution.service.js';
import { redisService } from '../services/redis.service.js';
import type { Job } from 'bullmq';
import type { RunWorkflowJobData, PollWorkflowJobData } from '../services/workflow-queue.service.js';

let initialized = false;

/**
 * Initialize workflow queues and register processors
 *
 * This function:
 * 1. Initializes the Redis service for distributed locks
 * 2. Initializes the BullMQ queues
 * 3. Registers the run-workflow processor
 * 4. Registers the poll-workflow processor
 */
export async function initializeWorkflowQueues(): Promise<void> {
  if (initialized) {
    console.log('⚠️ Workflow queues already initialized');
    return;
  }

  try {
    // 1. Initialize Redis service for distributed locks
    await redisService.initialize();

    // 2. Initialize queues
    await workflowQueueService.initialize();

    // 3. Register run-workflow processor
    workflowQueueService.registerRunWorkflowProcessor(
      async (job: Job<RunWorkflowJobData>) => {
        console.log(`🔄 Processing run-workflow job: ${job.id}`, job.data);
        await workflowExecutionService.runWorkflow(job.data);
      }
    );

    // 4. Register poll-workflow processor
    workflowQueueService.registerPollWorkflowProcessor(
      async (job: Job<PollWorkflowJobData>) => {
        console.log(`🔄 Processing poll-workflow job: ${job.id}`, job.data);
        await workflowExecutionService.pollWorkflow(job.data);
      }
    );

    initialized = true;
    console.log('✅ Workflow queues and processors initialized');
  } catch (error) {
    console.error('❌ Failed to initialize workflow queues:', error);
    throw error;
  }
}

/**
 * Shutdown workflow queues gracefully
 */
export async function shutdownWorkflowQueues(): Promise<void> {
  if (!initialized) {
    return;
  }

  await workflowQueueService.shutdown();
  await redisService.shutdown();
  initialized = false;
  console.log('✅ Workflow queues shut down');
}

/**
 * Check if workflow queues are initialized
 */
export function isWorkflowQueuesInitialized(): boolean {
  return initialized;
}
