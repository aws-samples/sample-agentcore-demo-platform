import 'fastify';

/**
 * User type representing an authenticated user extracted from JWT payload
 */
export interface User {
  id: string;
  email: string;
  orgId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * The authenticated user extracted from the JWT token.
     * This property is set by the authenticate middleware.
     */
    user?: User;
  }
}
