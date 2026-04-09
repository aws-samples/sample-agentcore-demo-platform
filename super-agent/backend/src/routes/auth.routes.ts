/**
 * Authentication Routes
 *
 * Supports two modes:
 * - cognito: Cognito Hosted UI handles login; backend verifies tokens
 * - local: Backend handles login/register with username/password + JWT
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, createLocalJwt } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /auth/config
   * Returns auth configuration for the frontend (public, no auth required).
   */
  fastify.get(
    '/config',
    {
      schema: {
        description: 'Get auth configuration for frontend',
        tags: ['auth'],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      if (config.authMode === 'cognito') {
        return reply.send({
          authMode: 'cognito',
          userPoolId: config.cognito.userPoolId,
          clientId: config.cognito.clientId,
          region: config.cognito.region,
          domain: config.cognito.domain,
        });
      }
      return reply.send({ authMode: 'local' });
    },
  );

  /**
   * POST /auth/login (local mode only)
   * Authenticates with username/password and returns a JWT.
   */
  fastify.post(
    '/login',
    {
      schema: {
        description: 'Login with username and password (local auth mode)',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { username: string; password: string } }>, reply: FastifyReply) => {
      if (config.authMode !== 'local') {
        return reply.status(400).send({ error: 'Local auth is not enabled. Use Cognito.' });
      }

      const { username, password } = request.body;

      const profile = await prisma.profiles.findUnique({ where: { username } });
      if (!profile || !profile.password_hash) {
        return reply.status(401).send({ error: 'Invalid username or password' });
      }

      const valid = await bcrypt.compare(password, profile.password_hash);
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid username or password' });
      }

      const membership = await prisma.memberships.findFirst({
        where: { user_id: profile.id },
      });

      const token = createLocalJwt({
        sub: profile.id,
        email: profile.username,
        orgId: membership?.organization_id ?? '',
        role: (membership?.role as any) ?? 'owner',
      });

      return reply.send({
        token,
        user: {
          id: profile.id,
          email: profile.username,
          name: profile.full_name || profile.username,
          organizationId: membership?.organization_id,
          role: membership?.role,
        },
      });
    },
  );

  /**
   * POST /auth/register (local mode only)
   * Creates a new user with username/password.
   * First user becomes owner of a new default organization.
   */
  fastify.post(
    '/register',
    {
      schema: {
        description: 'Register a new user (local auth mode)',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            fullName: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { username: string; password: string; fullName?: string } }>, reply: FastifyReply) => {
      if (config.authMode !== 'local') {
        return reply.status(400).send({ error: 'Local auth is not enabled. Use Cognito.' });
      }

      const { username, password, fullName } = request.body;

      // Check if username already exists
      const existing = await prisma.profiles.findUnique({ where: { username } });
      if (existing) {
        return reply.status(409).send({ error: 'Username already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = uuidv4();

      // Create profile
      const profile = await prisma.profiles.create({
        data: {
          id: userId,
          username,
          full_name: fullName || username,
          password_hash: passwordHash,
        },
      });

      // Find or create a default organization
      let org = await prisma.organizations.findFirst({ orderBy: { created_at: 'asc' } });
      if (!org) {
        org = await prisma.organizations.create({
          data: {
            id: uuidv4(),
            name: 'Default Organization',
            slug: 'default',
          },
        });
      }

      // Create membership
      const memberCount = await prisma.memberships.count({
        where: { organization_id: org.id },
      });
      const role = memberCount === 0 ? 'owner' : 'member';

      await prisma.memberships.create({
        data: {
          id: uuidv4(),
          user_id: userId,
          organization_id: org.id,
          role,
        },
      });

      const token = createLocalJwt({
        sub: userId,
        email: username,
        orgId: org.id,
        role: role as any,
      });

      return reply.send({
        token,
        user: {
          id: userId,
          email: username,
          name: fullName || username,
          organizationId: org.id,
          role,
        },
      });
    },
  );

  /**
   * GET /auth/me
   * Returns the current user's information from a verified token.
   */
  fastify.get(
    '/me',
    {
      schema: {
        description: 'Get current user information',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'Missing or invalid authorization header',
          code: 'UNAUTHORIZED',
        });
      }

      const token = authHeader.substring(7);

      try {
        const claims = await verifyToken(token);

        let profile = await prisma.profiles.findUnique({
          where: { id: claims.sub },
        });

        if (!profile) {
          profile = await prisma.profiles.findUnique({
            where: { username: claims.email },
          });
        }

        if (!profile) {
          return reply.status(404).send({
            error: 'User profile not found',
            code: 'NOT_FOUND',
          });
        }

        const membership = await prisma.memberships.findFirst({
          where: { user_id: profile.id },
          include: { organization: true },
        });

        return reply.send({
          id: profile.id,
          email: profile.username || claims.email,
          name: profile.full_name || profile.username || 'Unknown',
          organizationId: membership?.organization_id,
          organizationName: membership?.organization.name,
          role: membership?.role,
        });
      } catch (error) {
        return reply.status(401).send({
          error: 'Invalid token',
          code: 'UNAUTHORIZED',
        });
      }
    },
  );

  /**
   * GET /auth/invite/:token
   * Validates an invite token and returns invite details (public, no auth).
   */
  fastify.get(
    '/invite/:token',
    {
      schema: {
        description: 'Validate an invite token',
        tags: ['auth'],
        params: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string' } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      const { token } = request.params;

      const membership = await prisma.memberships.findUnique({
        where: { invite_token: token },
        include: { organization: true },
      });

      if (!membership) {
        return reply.status(404).send({ error: 'Invalid or expired invite link' });
      }

      if (membership.status !== 'pending') {
        return reply.status(400).send({ error: 'This invitation has already been accepted' });
      }

      if (membership.invite_expires_at && new Date() > membership.invite_expires_at) {
        return reply.status(410).send({ error: 'This invitation has expired' });
      }

      return reply.send({
        email: membership.invited_email,
        role: membership.role,
        organizationName: membership.organization.name,
      });
    },
  );

  /**
   * POST /auth/accept-invite
   * Accepts an invite: creates user account and activates membership.
   */
  fastify.post(
    '/accept-invite',
    {
      schema: {
        description: 'Accept an invitation and create account',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string' },
            password: { type: 'string', minLength: 8 },
            fullName: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: { token: string; password: string; fullName?: string } }>, reply: FastifyReply) => {
      const { token, password, fullName } = request.body;

      const membership = await prisma.memberships.findUnique({
        where: { invite_token: token },
        include: { organization: true },
      });

      if (!membership) {
        return reply.status(404).send({ error: 'Invalid or expired invite link' });
      }

      if (membership.status !== 'pending') {
        return reply.status(400).send({ error: 'This invitation has already been accepted' });
      }

      if (membership.invite_expires_at && new Date() > membership.invite_expires_at) {
        return reply.status(410).send({ error: 'This invitation has expired' });
      }

      const email = membership.invited_email!;

      // Check if a profile already exists for this email
      const existingProfile = await prisma.profiles.findUnique({ where: { username: email } });
      if (existingProfile) {
        return reply.status(409).send({ error: 'An account with this email already exists. Please sign in.' });
      }

      // Create profile with password
      const passwordHash = await bcrypt.hash(password, 10);
      const userId = uuidv4();

      await prisma.profiles.create({
        data: {
          id: userId,
          username: email,
          full_name: fullName || email,
          password_hash: passwordHash,
        },
      });

      // Activate membership
      await prisma.memberships.update({
        where: { id: membership.id },
        data: {
          user_id: userId,
          status: 'active',
          invite_token: null,
          invite_expires_at: null,
        },
      });

      // Return a JWT so the user is logged in immediately
      const jwt = createLocalJwt({
        sub: userId,
        email,
        orgId: membership.organization_id,
        role: membership.role as any,
      });

      return reply.send({
        token: jwt,
        user: {
          id: userId,
          email,
          name: fullName || email,
          organizationId: membership.organization_id,
          organizationName: membership.organization.name,
          role: membership.role,
        },
      });
    },
  );
}
