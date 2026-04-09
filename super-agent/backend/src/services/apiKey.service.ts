/**
 * API Key Service
 * Manages API keys for programmatic workflow access.
 */

import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { redisService } from './redis.service.js';

const API_KEY_PREFIX = 'sk_';
const API_KEY_LENGTH = 32;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export interface ApiKeyData {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerMinute: number;
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface CreateApiKeyResult {
  apiKey: string; // Full key (only shown once)
  data: ApiKeyData;
}

class ApiKeyService {
  /**
   * Generate a new API key
   */
  private generateKey(): { key: string; hash: string; prefix: string } {
    const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
    const key = `${API_KEY_PREFIX}${randomBytes.toString('hex')}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const prefix = key.substring(0, 12);
    return { key, hash, prefix };
  }

  /**
   * Hash an API key for lookup
   */
  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    organizationId: string,
    userId: string,
    options: {
      name: string;
      scopes?: string[];
      rateLimitPerMinute?: number;
      expiresAt?: Date;
    }
  ): Promise<CreateApiKeyResult> {
    const { key, hash, prefix } = this.generateKey();

    const apiKey = await prisma.api_keys.create({
      data: {
        organization_id: organizationId,
        user_id: userId,
        name: options.name,
        key_hash: hash,
        key_prefix: prefix,
        scopes: options.scopes || ['workflow:execute'],
        rate_limit_per_minute: options.rateLimitPerMinute || 60,
        expires_at: options.expiresAt,
      },
    });

    return {
      apiKey: key,
      data: this.mapToApiKeyData(apiKey),
    };
  }

  /**
   * Validate an API key and return its data
   */
  async validateApiKey(key: string): Promise<ApiKeyData | null> {
    const hash = this.hashKey(key);

    // Check cache first
    const cacheKey = `apikey:${hash}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached) as ApiKeyData;
      // Check if expired
      if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
        return null;
      }
      return data;
    }

    // Query database
    const apiKey = await prisma.api_keys.findUnique({
      where: { key_hash: hash },
    });

    if (!apiKey || !apiKey.is_active) {
      return null;
    }

    // Check expiration
    if (apiKey.expires_at && apiKey.expires_at < new Date()) {
      return null;
    }

    const data = this.mapToApiKeyData(apiKey);

    // Cache for 5 minutes
    await redisService.setex(cacheKey, 300, JSON.stringify(data));

    // Update last used (fire and forget)
    prisma.api_keys.update({
      where: { id: apiKey.id },
      data: { last_used_at: new Date() },
    }).catch(() => {});

    return data;
  }

  /**
   * Check rate limit for an API key
   * Returns true if within limit, false if exceeded
   */
  async checkRateLimit(keyHash: string, limit: number): Promise<boolean> {
    const rateLimitKey = `ratelimit:${keyHash}`;
    const current = await redisService.incr(rateLimitKey);
    
    if (current === 1) {
      // First request in window, set expiry
      await redisService.expire(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);
    }

    return current <= limit;
  }

  /**
   * List API keys for an organization
   */
  async listApiKeys(organizationId: string): Promise<ApiKeyData[]> {
    const keys = await prisma.api_keys.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });

    return keys.map(this.mapToApiKeyData);
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(id: string, organizationId: string): Promise<void> {
    const apiKey = await prisma.api_keys.findFirst({
      where: { id, organization_id: organizationId },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    await prisma.api_keys.update({
      where: { id },
      data: { is_active: false },
    });

    // Clear cache
    const cacheKey = `apikey:${apiKey.key_hash}`;
    await redisService.del(cacheKey);
  }

  /**
   * Delete an API key
   */
  async deleteApiKey(id: string, organizationId: string): Promise<void> {
    const apiKey = await prisma.api_keys.findFirst({
      where: { id, organization_id: organizationId },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    await prisma.api_keys.delete({
      where: { id },
    });

    // Clear cache
    const cacheKey = `apikey:${apiKey.key_hash}`;
    await redisService.del(cacheKey);
  }

  private mapToApiKeyData(apiKey: any): ApiKeyData {
    return {
      id: apiKey.id,
      organizationId: apiKey.organization_id,
      userId: apiKey.user_id,
      name: apiKey.name,
      keyPrefix: apiKey.key_prefix,
      scopes: apiKey.scopes as string[],
      rateLimitPerMinute: apiKey.rate_limit_per_minute,
      isActive: apiKey.is_active,
      lastUsedAt: apiKey.last_used_at,
      expiresAt: apiKey.expires_at,
      createdAt: apiKey.created_at,
    };
  }
}

export const apiKeyService = new ApiKeyService();
