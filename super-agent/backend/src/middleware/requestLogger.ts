/**
 * Request logging middleware with request ID generation
 * Requirements: 13.3
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Request context interface for logging
 */
export interface RequestContext {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  orgId?: string;
}

/**
 * Generates a unique request ID
 * Uses crypto.randomUUID() for UUID v4 generation
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Extracts request context for logging
 */
export function extractRequestContext(request: FastifyRequest): RequestContext {
  return {
    requestId: request.id,
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
    userId: request.user?.id,
    orgId: request.user?.orgId,
  };
}

/**
 * Request logger hook that logs incoming requests
 */
export async function requestLoggerHook(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const context = extractRequestContext(request);

  request.log.info(
    {
      requestId: context.requestId,
      method: context.method,
      url: context.url,
      userAgent: context.userAgent,
      ip: context.ip,
    },
    'Incoming request'
  );
}

/**
 * Response logger hook that logs outgoing responses
 */
export async function responseLoggerHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const context = extractRequestContext(request);
  const responseTime = reply.elapsedTime;

  request.log.info(
    {
      requestId: context.requestId,
      method: context.method,
      url: context.url,
      statusCode: reply.statusCode,
      responseTime: `${responseTime.toFixed(2)}ms`,
      userId: context.userId,
      orgId: context.orgId,
    },
    'Request completed'
  );
}

/**
 * Registers request logging hooks on a Fastify instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerRequestLogger(app: any): void {
  // Log incoming requests
  app.addHook('onRequest', requestLoggerHook);

  // Log completed responses
  app.addHook('onResponse', responseLoggerHook);
}
