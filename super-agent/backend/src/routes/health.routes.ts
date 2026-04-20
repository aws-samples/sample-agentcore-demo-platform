/**
 * Health Check Routes
 * Endpoints for service health monitoring and readiness checks.
 * Requirements: 13.1, 13.2
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { checkDatabaseHealth } from '../config/database.js';

/**
 * Health check response interface
 */
interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
}

/**
 * Readiness check response interface
 */
interface ReadinessResponse extends HealthResponse {
  checks: {
    database: {
      status: 'ok' | 'error';
      latency?: number;
      error?: string;
    };
  };
}

/**
 * Register health check routes on the Fastify instance.
 * These routes do NOT require authentication.
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /health
   * Basic health check endpoint.
   * Returns 200 OK if the service is running.
   * Requirements: 13.1
   */
  fastify.get(
    '/',
    {
      schema: {
        description: 'Basic health check - returns service status',
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
              timestamp: { type: 'string', format: 'date-time' },
              service: { type: 'string' },
              version: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const response: HealthResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'backend',
        version: process.env.npm_package_version || '1.0.0',
      };

      return reply.status(200).send(response);
    }
  );

  /**
   * GET /health/ready
   * Readiness check endpoint with database connectivity verification.
   * Returns 200 OK if all dependencies are healthy, 503 otherwise.
   * Requirements: 13.2
   */
  fastify.get(
    '/ready',
    {
      schema: {
        description: 'Readiness check - verifies database connectivity',
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
              timestamp: { type: 'string', format: 'date-time' },
              service: { type: 'string' },
              version: { type: 'string' },
              checks: {
                type: 'object',
                properties: {
                  database: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['ok', 'error'] },
                      latency: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
          503: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
              timestamp: { type: 'string', format: 'date-time' },
              service: { type: 'string' },
              version: { type: 'string' },
              checks: {
                type: 'object',
                properties: {
                  database: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['ok', 'error'] },
                      error: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();
      let dbHealthy = false;
      let dbError: string | undefined;

      try {
        dbHealthy = await checkDatabaseHealth();
      } catch (error) {
        dbError = error instanceof Error ? error.message : 'Unknown database error';
      }

      const latency = Date.now() - startTime;

      const response: ReadinessResponse = {
        status: dbHealthy ? 'ok' : 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'backend',
        version: process.env.npm_package_version || '1.0.0',
        checks: {
          database: dbHealthy
            ? { status: 'ok', latency }
            : { status: 'error', error: dbError || 'Database connection failed' },
        },
      };

      const statusCode = dbHealthy ? 200 : 503;
      return reply.status(statusCode).send(response);
    }
  );
}
