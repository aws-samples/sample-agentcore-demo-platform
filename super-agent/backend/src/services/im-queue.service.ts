/**
 * IM Message Queue Service (BullMQ)
 *
 * Decouples webhook/gateway message ingestion from agent processing.
 * Messages are enqueued immediately (webhook returns 200 fast),
 * then a BullMQ worker processes them asynchronously.
 */

import { Queue, Worker, type Job } from 'bullmq';
import { config } from '../config/index.js';
import { imService } from './im.service.js';
import type { NormalizedIMMessage } from './im.service.js';

/** Job payload for the IM message queue. */
export interface IMMessageJobData {
  message: NormalizedIMMessage;
  /** Extra context passed from gateway adapters (e.g. dingtalk sessionWebhook). */
  replyContext?: Record<string, unknown>;
  enqueuedAt: string;
}

const QUEUE_NAME = 'im-messages';

const redisConnection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,
};

class IMQueueService {
  private queue: Queue<IMMessageJobData> | null = null;
  private worker: Worker<IMMessageJobData> | null = null;

  /** Initialize the queue (call once at startup). */
  async initialize(): Promise<void> {
    this.queue = new Queue<IMMessageJobData>(QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    });

    this.worker = new Worker<IMMessageJobData>(
      QUEUE_NAME,
      async (job: Job<IMMessageJobData>) => {
        const { message, replyContext } = job.data;
        console.log(`[IM-QUEUE] Processing ${message.channelType} message from ${message.userId}`);
        await imService.handleMessage(message, replyContext);
      },
      {
        connection: redisConnection,
        concurrency: 5,
        limiter: { max: 10, duration: 1000 },
      },
    );

    this.worker.on('completed', (job) => {
      console.log(`[IM-QUEUE] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[IM-QUEUE] Job ${job?.id} failed:`, err.message);
    });

    console.log('✅ IM message queue initialized');
  }

  /** Enqueue a message for async processing. */
  async enqueue(message: NormalizedIMMessage, replyContext?: Record<string, unknown>): Promise<void> {
    if (!this.queue) throw new Error('IM queue not initialized');

    await this.queue.add(
      `${message.channelType}:${message.channelId}`,
      { message, replyContext, enqueuedAt: new Date().toISOString() },
    );
  }

  /** Graceful shutdown. */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
    console.log('✅ IM message queue shut down');
  }
}

export const imQueueService = new IMQueueService();
