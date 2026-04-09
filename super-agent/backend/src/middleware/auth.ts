import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import type { User, UserRole } from '../types/index.js';

// ---------------------------------------------------------------------------
// Cognito verifier — only initialized when AUTH_MODE=cognito
// ---------------------------------------------------------------------------
let cognitoVerifier: any = null;

async function getCognitoVerifier() {
  if (cognitoVerifier) return cognitoVerifier;
  if (config.authMode !== 'cognito') return null;
  const { CognitoJwtVerifier } = await import('aws-jwt-verify');
  cognitoVerifier = CognitoJwtVerifier.create({
    userPoolId: config.cognito.userPoolId,
    tokenUse: 'id' as const,
    clientId: config.cognito.clientId,
  });
  return cognitoVerifier;
}

/**
 * Verifies a Cognito id_token and returns normalized claims.
 */
export async function verifyToken(token: string) {
  if (config.authMode === 'local') {
    return verifyLocalToken(token);
  }
  const verifier = await getCognitoVerifier();
  const payload = await verifier.verify(token);
  return {
    sub: payload.sub,
    email: (payload.email ?? payload['cognito:username']) as string,
    orgId: payload['custom:orgId'] as string | undefined,
    role: (payload['custom:role'] as UserRole) || 'owner',
  };
}

// ---------------------------------------------------------------------------
// Local JWT auth (for non-Cognito mode)
// ---------------------------------------------------------------------------

/**
 * Creates a local JWT for username/password auth.
 */
export function createLocalJwt(claims: {
  sub: string;
  email: string;
  orgId: string;
  role: UserRole;
}): string {
  return jwt.sign(claims, config.jwtSecret, { expiresIn: '24h' });
}

/**
 * Verifies a local JWT and returns normalized claims.
 */
function verifyLocalToken(token: string) {
  const payload = jwt.verify(token, config.jwtSecret) as {
    sub: string;
    email: string;
    orgId?: string;
    role?: UserRole;
  };
  return {
    sub: payload.sub,
    email: payload.email,
    orgId: payload.orgId,
    role: payload.role || ('owner' as UserRole),
  };
}

// ---------------------------------------------------------------------------
// Internal service tokens (for agent-to-API calls within the platform)
// ---------------------------------------------------------------------------
const INTERNAL_TOKEN_SECRET = config.authMode === 'cognito'
  ? config.cognito.userPoolId
  : config.jwtSecret;

interface InternalTokenPayload {
  sub: string;
  email: string;
  orgId: string;
  role: UserRole;
  exp: number;
}

/**
 * Creates a short-lived HMAC-signed internal token for agent subprocess auth.
 */
export function createToken(claims: {
  userId: string;
  email: string;
  organizationId: string;
  role: UserRole;
}): string {
  const payload: InternalTokenPayload = {
    sub: claims.userId,
    email: claims.email,
    orgId: claims.organizationId,
    role: claims.role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', INTERNAL_TOKEN_SECRET).update(data).digest('base64url');
  return `internal.${data}.${sig}`;
}

/**
 * Verifies an internal service token. Returns null if invalid.
 */
function verifyInternalToken(token: string): InternalTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'internal') return null;
  const data = parts[1]!;
  const sig = parts[2]!;
  const expected = crypto.createHmac('sha256', INTERNAL_TOKEN_SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as InternalTokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main authenticate hook
// ---------------------------------------------------------------------------

/**
 * Authentication hook that extracts and validates a JWT from the
 * Authorization header (or ?token query param for iframe/img src).
 *
 * Supports both Cognito and local auth modes.
 */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  const queryToken = (request.query as Record<string, string>)?.token;

  if (!authHeader && !queryToken) {
    return reply.status(401).send({
      error: 'Missing authorization header',
      code: 'UNAUTHORIZED',
      requestId: request.id,
    });
  }

  let token: string;

  if (authHeader) {
    if (!authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Invalid authorization format. Expected: Bearer <token>',
        code: 'UNAUTHORIZED',
        requestId: request.id,
      });
    }
    token = authHeader.substring(7);
  } else {
    token = queryToken!;
  }

  if (!token) {
    return reply.status(401).send({
      error: 'Missing token',
      code: 'UNAUTHORIZED',
      requestId: request.id,
    });
  }

  try {
    // Try internal service token first (for agent subprocess calls)
    const internalPayload = verifyInternalToken(token);
    if (internalPayload) {
      const user: User = {
        id: internalPayload.sub,
        email: internalPayload.email,
        orgId: internalPayload.orgId,
        role: internalPayload.role,
      };
      request.user = user;
      return;
    }

    // Verify token based on auth mode
    const claims = await verifyToken(token);

    // Look up profile by sub first, then fall back to email
    let profile = await prisma.profiles.findUnique({ where: { id: claims.sub } });

    if (!profile && config.authMode === 'cognito') {
      // First Cognito login — bind to existing profile by email (username field)
      profile = await prisma.profiles.findUnique({ where: { username: claims.email } });

      if (profile) {
        const oldId = profile.id;
        const migrations = [
          [`UPDATE memberships SET user_id = $1 WHERE user_id = $2`, claims.sub, oldId],
          [`UPDATE chat_sessions SET user_id = $1 WHERE user_id = $2`, claims.sub, oldId],
          [`UPDATE tasks SET created_by = $1 WHERE created_by = $2`, claims.sub, oldId],
          [`UPDATE workflows SET created_by = $1 WHERE created_by = $2`, claims.sub, oldId],
          [`UPDATE workflow_executions SET user_id = $1 WHERE user_id = $2`, claims.sub, oldId],
          [`UPDATE api_keys SET user_id = $1 WHERE user_id = $2`, claims.sub, oldId],
          [`UPDATE skill_votes SET user_id = $1 WHERE user_id = $2`, claims.sub, oldId],
        ] as const;

        for (const [sql, newId, prevId] of migrations) {
          try {
            await prisma.$executeRawUnsafe(sql, newId, prevId);
          } catch (_e) { /* Table may not exist */ }
        }

        await prisma.$executeRawUnsafe(
          `UPDATE profiles SET id = $1 WHERE id = $2`,
          claims.sub, oldId,
        );
        profile = await prisma.profiles.findUnique({ where: { id: claims.sub } });
        request.log.info({ oldId, newId: claims.sub }, 'Migrated user ID to Cognito sub');
      }
    }

    if (!profile) {
      return reply.status(401).send({
        error: 'No profile found for this user. Contact your administrator.',
        code: 'UNAUTHORIZED',
        requestId: request.id,
      });
    }

    const membership = await prisma.memberships.findFirst({
      where: { user_id: claims.sub },
    });

    const user: User = {
      id: claims.sub,
      email: claims.email,
      orgId: membership?.organization_id ?? claims.orgId ?? '',
      role: (membership?.role as UserRole) ?? claims.role ?? 'owner',
    };

    request.user = user;
  } catch (error) {
    request.log.error({ err: error }, 'Token verification failed');
    return reply.status(401).send({
      error: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
      requestId: request.id,
    });
  }
}

// ---------------------------------------------------------------------------
// Role-based access control
// ---------------------------------------------------------------------------

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.status(403).send({
        error: 'Access denied. Authentication required.',
        code: 'FORBIDDEN',
        requestId: request.id,
      });
    }
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
        code: 'FORBIDDEN',
        requestId: request.id,
      });
    }
  };
}

export const requireModifyAccess = requireRole('owner', 'admin', 'member');
export const requireAdminAccess = requireRole('owner', 'admin');
export const requireOwnerAccess = requireRole('owner');
