/**
 * Workflow Queue Service
 *
 * Manages BullMQ queues for workflow execution.
 * Provides methods to add jobs to queues and manage queue lifecycle.
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import {
  QUEUE_RUN_WORKFLOW,
  QUEUE_POLL_WORKFLOW,
  runWorkflowQueueOptions,
  pollWorkflowQueueOptions,
  runWorkflowWorkerOptions,
  pollWorkflowWorkerOptions,
  pollJobOptions,
  redisConnection,
} from '../config/queue.js';

/**
 * Job data for running a workflow node
 */
export interface RunWorkflowJobData {
  executionId: string;
  nodeId: string;
  userId: string;
}

/**
 * Job data for polling workflow execution
 */
export interface PollWorkflowJobData {
  executionId: string;
  userId: string;
}

/**
 * Workflow Queue Service
 *
 * Singleton service that manages BullMQ queues for workflow execution.
 */
export class WorkflowQueueService {
  private runWorkflowQueue: Queue<RunWorkflowJobData> | null = null;
  private pollWorkflowQueue: Queue<PollWorkflowJobData> | null = null;
  private runWorkflowWorker: Worker<RunWorkflowJobData> | null = null;
  private pollWorkflowWorker: Worker<PollWorkflowJobData> | null = null;
  private runWorkflowEvents: QueueEvents | null = null;
  private pollWorkflowEvents: QueueEvents | null = null;
  private initialized = false;

  /**
   * Initialize the queues
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create queues
    this.runWorkflowQueue = new Queue<RunWorkflowJobData>(
      QUEUE_RUN_WORKFLOW,
      runWorkflowQueueOptions
    );

    this.pollWorkflowQueue = new Queue<PollWorkflowJobData>(
      QUEUE_POLL_WORKFLOW,
      pollWorkflowQueueOptions
    );

    // Create queue events for monitoring
    this.runWorkflowEvents = new QueueEvents(QUEUE_RUN_WORKFLOW, {
      connection: redisConnection,
    });

    this.pollWorkflowEvents = new QueueEvents(QUEUE_POLL_WORKFLOW, {
      connection: redisConnection,
    });

    this.initialized = true;
    console.log('✅ Workflow queues initialized');
  }

  /**
   * Register the run-workflow processor
   */
  registerRunWorkflowProcessor(
    processor: (job: Job<RunWorkflowJobData>) => Promise<void>
  ): void {
    if (!this.initialized) {
      throw new Error('WorkflowQueueService not initialized');
    }

    this.runWorkflowWorker = new Worker<RunWorkflowJobData>(
      QUEUE_RUN_WORKFLOW,
      processor,
      runWorkflowWorkerOptions
    );

    this.runWorkflowWorker.on('completed', (job) => {
      console.log(`✅ Run workflow job ${job.id} completed for node ${job.data.nodeId}`);
    });

    this.runWorkflowWorker.on('failed', (job, err) => {
      console.error(`❌ Run workflow job ${job?.id} failed:`, err.message);
    });

    console.log('✅ Run workflow processor registered');
  }

  /**
   * Register the poll-workflow processor
   */
  registerPollWorkflowProcessor(
    processor: (job: Job<PollWorkflowJobData>) => Promise<void>
  ): void {
    if (!this.initialized) {
      throw new Error('WorkflowQueueService not initialized');
    }

    this.pollWorkflowWorker = new Worker<PollWorkflowJobData>(
      QUEUE_POLL_WORKFLOW,
      processor,
      pollWorkflowWorkerOptions
    );

    this.pollWorkflowWorker.on('completed', (job) => {
      console.log(`✅ Poll workflow job ${job.id} completed for execution ${job.data.executionId}`);
    });

    this.pollWorkflowWorker.on('failed', (job, err) => {
      console.error(`❌ Poll workflow job ${job?.id} failed:`, err.message);
    });

    console.log('✅ Poll workflow processor registered');
  }

  /**
   * Add a job to run a workflow node
   */
  async addRunWorkflowJob(data: RunWorkflowJobData): Promise<Job<RunWorkflowJobData>> {
    if (!this.runWorkflowQueue) {
      throw new Error('Run workflow queue not initialized');
    }

    const job = await this.runWorkflowQueue.add('runWorkflow', data, {
      jobId: `run-${data.executionId}-${data.nodeId}`,
    });

    return job;
  }

  /**
   * Add a job to poll workflow execution
   */
  async addPollWorkflowJob(data: PollWorkflowJobData): Promise<Job<PollWorkflowJobData>> {
    if (!this.pollWorkflowQueue) {
      throw new Error('Poll workflow queue not initialized');
    }

    const job = await this.pollWorkflowQueue.add('pollWorkflow', data, {
      ...pollJobOptions,
      jobId: `poll-${data.executionId}-${Date.now()}`,
    });

    return job;
  }

  /**
   * Get the run-workflow queue instance
   */
  getRunWorkflowQueue(): Queue<RunWorkflowJobData> | null {
    return this.runWorkflowQueue;
  }

  /**
   * Get the poll-workflow queue instance
   */
  getPollWorkflowQueue(): Queue<PollWorkflowJobData> | null {
    return this.pollWorkflowQueue;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Shutdown the queues and workers gracefully
   */
  async shutdown(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    if (this.runWorkflowWorker) {
      closePromises.push(this.runWorkflowWorker.close());
    }

    if (this.pollWorkflowWorker) {
      closePromises.push(this.pollWorkflowWorker.close());
    }

    if (this.runWorkflowEvents) {
      closePromises.push(this.runWorkflowEvents.close());
    }

    if (this.pollWorkflowEvents) {
      closePromises.push(this.pollWorkflowEvents.close());
    }

    if (this.runWorkflowQueue) {
      closePromises.push(this.runWorkflowQueue.close());
    }

    if (this.pollWorkflowQueue) {
      closePromises.push(this.pollWorkflowQueue.close());
    }

    await Promise.all(closePromises);

    this.runWorkflowWorker = null;
    this.pollWorkflowWorker = null;
    this.runWorkflowEvents = null;
    this.pollWorkflowEvents = null;
    this.runWorkflowQueue = null;
    this.pollWorkflowQueue = null;
    this.initialized = false;

    console.log('✅ Workflow queues shut down');
  }
}

// Singleton instance
export const workflowQueueService = new WorkflowQueueService();
