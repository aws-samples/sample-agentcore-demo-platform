/**
 * Error handling middleware for consistent error responses
 * Requirements: 13.3, 13.4
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Error codes used throughout the application
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  details?: unknown;
  requestId: string;
}

/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code: ErrorCode, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(message, 400, ErrorCodes.VALIDATION_ERROR, details);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, 401, ErrorCodes.UNAUTHORIZED);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, 403, ErrorCodes.FORBIDDEN);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(message, 404, ErrorCodes.NOT_FOUND);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(message, 409, ErrorCodes.CONFLICT, details);
  }

  static tooManyRequests(message = 'Too many requests'): AppError {
    return new AppError(message, 429, ErrorCodes.TOO_MANY_REQUESTS);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
  }
}

/**
 * Global error handler for Fastify
 * Provides consistent error responses across all endpoints
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id;

  // Log error with request context
  request.log.error({ err: error, requestId }, 'Request error');

  // Handle Fastify validation errors
  if (error.validation) {
    reply.status(400).send({
      error: 'Validation failed',
      code: ErrorCodes.VALIDATION_ERROR,
      details: error.validation,
      requestId,
    } satisfies ErrorResponse);
    return;
  }

  // Handle custom AppError instances
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: error.message,
      code: error.code,
      details: error.details,
      requestId,
    } satisfies ErrorResponse);
    return;
  }

  // Handle errors with statusCode (from Fastify or other sources)
  if (error.statusCode) {
    const code = mapStatusCodeToErrorCode(error.statusCode);
    reply.status(error.statusCode).send({
      error: error.message,
      code,
      requestId,
    } satisfies ErrorResponse);
    return;
  }

  // Handle unexpected errors
  reply.status(500).send({
    error: 'Internal server error',
    code: ErrorCodes.INTERNAL_ERROR,
    requestId,
  } satisfies ErrorResponse);
}

/**
 * Maps HTTP status codes to error codes
 */
function mapStatusCodeToErrorCode(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400:
      return ErrorCodes.VALIDATION_ERROR;
    case 401:
      return ErrorCodes.UNAUTHORIZED;
    case 403:
      return ErrorCodes.FORBIDDEN;
    case 404:
      return ErrorCodes.NOT_FOUND;
    case 409:
      return ErrorCodes.CONFLICT;
    case 429:
      return ErrorCodes.TOO_MANY_REQUESTS;
    default:
      return ErrorCodes.INTERNAL_ERROR;
  }
}
