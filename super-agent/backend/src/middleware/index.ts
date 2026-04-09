/**
 * Middleware exports for the Super Agent Backend
 */

export {
  authenticate,
  requireRole,
  requireModifyAccess,
  requireAdminAccess,
  requireOwnerAccess,
  verifyToken,
  createToken,
} from './auth.js';

export {
  errorHandler,
  ErrorCodes,
  AppError,
  type ErrorCode,
  type ErrorResponse,
} from './errorHandler.js';

export {
  generateRequestId,
  extractRequestContext,
  requestLoggerHook,
  responseLoggerHook,
  registerRequestLogger,
  type RequestContext,
} from './requestLogger.js';
