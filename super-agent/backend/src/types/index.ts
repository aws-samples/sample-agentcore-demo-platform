/**
 * Shared types for the Super Agent Backend
 */

// Re-export User type from fastify declaration
export type { User } from './fastify.js';

/**
 * User roles in the system
 */
export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * Authentication context containing user and token information
 */
export interface AuthContext {
  user: {
    id: string;
    email: string;
    orgId: string;
    role: UserRole;
  };
  token: string;
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  sub: string; // user_id
  email: string;
  orgId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Re-export workflow execution types
export * from './workflow-execution.js';
