/**
 * Redis Service for Distributed Locks
 *
 * Provides distributed locking functionality using Redis for coordinating
 * workflow execution across multiple workers.
 *
 * Requirements: 2.2, 2.3 - Distributed coordination for node execution
 */

import Redis from 'ioredis';
import { config } from '../config/index.js';
import { NODE_LOCK_TTL_MS, POLL_LOCK_TTL_MS } from '../config/queue.js';

/**
 * Lock acquisition result
 */
export interface LockResult {
  acquired: boolean;
  lockId: string | null;
}

/**
 * Lock release function type
 */
export type ReleaseLockFn = () => Promise<void>;

/**
 * Redis Service
 *
 * Singleton service that manages Redis connections and provides
 * distributed locking functionality.
 */
export class RedisService {
  private client: Redis | null = null;
  private initialized = false;

  // Default lock settings
  private readonly defaultLockTTL = NODE_LOCK_TTL_MS;
  private readonly lockRetryDelay = 100; // ms between retry attempts
  private readonly maxRetries = 3;

  /**
   * Initialize the Redis connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('❌ Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000); // Exponential backoff
      },
      maxRetriesPerRequest: 3,
    });

    // Handle connection events
    this.client.on('connect', () => {
      console.log('✅ Redis connected');
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    this.client.on('close', () => {
      console.log('⚠️ Redis connection closed');
    });

    // Wait for connection
    await this.client.ping();
    this.initialized = true;
    console.log('✅ Redis service initialized');
  }

  /**
   * Get the Redis client instance
   */
  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }
    return this.client;
  }

  /**
   * Acquire a distributed lock
   *
   * Uses Redis SET with NX (only set if not exists) and PX (expiry in ms)
   * to implement a simple distributed lock.
   *
   * @param key - The lock key
   * @param ttlMs - Lock TTL in milliseconds (default: NODE_LOCK_TTL_MS)
   * @returns A function to release the lock, or null if lock not acquired
   */
  async acquireLock(key: string, ttlMs: number = this.defaultLockTTL): Promise<ReleaseLockFn | null> {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }

    const lockId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const lockKey = `lock:${key}`;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      // Try to acquire the lock using SET NX PX
      const result = await this.client.set(lockKey, lockId, 'PX', ttlMs, 'NX');

      if (result === 'OK') {
        // Lock acquired successfully
        return async () => {
          await this.releaseLock(lockKey, lockId);
        };
      }

      // Lock not acquired, wait before retrying
      if (attempt < this.maxRetries - 1) {
        await this.sleep(this.lockRetryDelay * (attempt + 1));
      }
    }

    // Failed to acquire lock after all retries
    return null;
  }

  /**
   * Release a distributed lock
   *
   * Uses a Lua script to atomically check and delete the lock
   * only if the lock ID matches (prevents releasing someone else's lock).
   *
   * @param lockKey - The lock key
   * @param lockId - The lock ID to verify ownership
   */
  private async releaseLock(lockKey: string, lockId: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }

    // Lua script to atomically check and delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.client.eval(script, 1, lockKey, lockId);
    return result === 1;
  }

  /**
   * Acquire a lock specifically for node execution
   *
   * @param executionId - The workflow execution ID
   * @param nodeId - The node ID
   * @returns A function to release the lock, or null if lock not acquired
   */
  async acquireNodeLock(executionId: string, nodeId: string): Promise<ReleaseLockFn | null> {
    const key = `workflow:node:${executionId}:${nodeId}`;
    return this.acquireLock(key, NODE_LOCK_TTL_MS);
  }

  /**
   * Acquire a lock specifically for workflow polling
   *
   * @param executionId - The workflow execution ID
   * @returns A function to release the lock, or null if lock not acquired
   */
  async acquirePollLock(executionId: string): Promise<ReleaseLockFn | null> {
    const key = `workflow:poll:${executionId}`;
    return this.acquireLock(key, POLL_LOCK_TTL_MS);
  }

  /**
   * Check if a lock exists (for testing/debugging)
   *
   * @param key - The lock key (without 'lock:' prefix)
   * @returns True if the lock exists
   */
  async isLocked(key: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }

    const lockKey = `lock:${key}`;
    const result = await this.client.exists(lockKey);
    return result === 1;
  }

  /**
   * Set a value in Redis with optional expiry
   *
   * @param key - The key
   * @param value - The value
   * @param ttlMs - Optional TTL in milliseconds
   */
  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }

    if (ttlMs) {
      await this.client.set(key, value, 'PX', ttlMs);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Get a value from Redis
   *
   * @param key - The key
   * @returns The value or null if not found
   */
  async get(key: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }

    return this.client.get(key);
  }

  /**
   * Delete a key from Redis
   *
   * @param key - The key
   * @returns True if the key was deleted
   */
  async delete(key: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Redis service not initialized');
    }

    const result = await this.client.del(key);
    return result === 1;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check Redis health
   */
  async checkHealth(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Shutdown the Redis connection gracefully
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.initialized = false;
      console.log('✅ Redis service shut down');
    }
  }

  /**
   * Helper function to sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const redisService = new RedisService();
