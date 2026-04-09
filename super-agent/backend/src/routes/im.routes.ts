/**
 * IM Channel Routes
 *
 * Admin endpoints for managing IM channel bindings (CRUD),
 * and platform webhook endpoints for receiving messages from Slack, Discord, etc.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { imChannelRepository } from '../repositories/im-channel.repository.js';
import { imService } from '../services/im.service.js';
import { slackAdapter, SlackAdapter } from '../services/slack-adapter.js';
import { telegramAdapter } from '../services/telegram-adapter.js';
import { discordAdapter, DiscordAdapter } from '../services/discord-adapter.js';
import { feishuAdapter, FeishuAdapter } from '../services/feishu-adapter.js';
import { dingtalkAdapter } from '../services/dingtalk-adapter.js';
import { whatsappAdapter, WhatsAppAdapter } from '../services/whatsapp-adapter.js';
import { imQueueService } from '../services/im-queue.service.js';

// Register adapters on import
imService.registerAdapter('slack', slackAdapter);
imService.registerAdapter('telegram', telegramAdapter);
imService.registerAdapter('discord', discordAdapter);
imService.registerAdapter('feishu', feishuAdapter);
imService.registerAdapter('dingtalk', dingtalkAdapter);
imService.registerAdapter('whatsapp', whatsappAdapter);

// ============================================================================
// Admin Routes — Manage IM channel bindings (requires auth)
// ============================================================================

interface ScopeParam {
  Params: { scopeId: string };
}

interface BindingParam {
  Params: { scopeId: string; bindingId: string };
}

interface CreateBindingRequest {
  Params: { scopeId: string };
  Body: {
    channel_type: string;
    channel_id: string;
    channel_name?: string;
    bot_token?: string;
    webhook_url?: string;
    config?: Record<string, unknown>;
  };
}

interface UpdateBindingRequest {
  Params: { scopeId: string; bindingId: string };
  Body: {
    channel_name?: string;
    bot_token?: string;
    webhook_url?: string;
    config?: Record<string, unknown>;
    is_enabled?: boolean;
  };
}

export async function imChannelAdminRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /api/business-scopes/:scopeId/im-channels — List bindings for a scope */
  fastify.get<ScopeParam>(
    '/:scopeId/im-channels',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<ScopeParam>, reply: FastifyReply) => {
      const bindings = await imChannelRepository.findByScope(
        request.user!.orgId,
        request.params.scopeId,
      );
      // Strip sensitive fields from response
      const safe = bindings.map(b => ({
        ...b,
        bot_token_enc: b.bot_token_enc ? '***' : null,
      }));
      return reply.status(200).send({ data: safe });
    },
  );

  /** POST /api/business-scopes/:scopeId/im-channels — Create a new binding */
  fastify.post<CreateBindingRequest>(
    '/:scopeId/im-channels',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<CreateBindingRequest>, reply: FastifyReply) => {
      const { scopeId } = request.params;
      const { channel_type, channel_id, channel_name, bot_token, webhook_url, config: cfg } = request.body;

      if (!channel_type || !channel_id) {
        return reply.status(400).send({
          error: 'channel_type and channel_id are required',
          code: 'VALIDATION_ERROR',
        });
      }

      const binding = await imChannelRepository.create({
        organization_id: request.user!.orgId,
        business_scope_id: scopeId,
        channel_type,
        channel_id,
        channel_name: channel_name ?? null,
        bot_token_enc: bot_token ?? null, // TODO: encrypt in production
        webhook_url: webhook_url ?? null,
        config: cfg ?? {},
        is_enabled: true,
        created_by: request.user!.id,
      });

      return reply.status(201).send({
        data: { ...binding, bot_token_enc: binding.bot_token_enc ? '***' : null },
      });
    },
  );

  /** PUT /api/business-scopes/:scopeId/im-channels/:bindingId — Update a binding */
  fastify.put<UpdateBindingRequest>(
    '/:scopeId/im-channels/:bindingId',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<UpdateBindingRequest>, reply: FastifyReply) => {
      const { bindingId } = request.params;
      const { channel_name, bot_token, webhook_url, config: cfg, is_enabled } = request.body;

      const updateData: Record<string, unknown> = {};
      if (channel_name !== undefined) updateData.channel_name = channel_name;
      if (bot_token !== undefined) updateData.bot_token_enc = bot_token; // TODO: encrypt
      if (webhook_url !== undefined) updateData.webhook_url = webhook_url;
      if (cfg !== undefined) updateData.config = cfg;
      if (is_enabled !== undefined) updateData.is_enabled = is_enabled;

      const updated = await imChannelRepository.update(bindingId, request.user!.orgId, updateData);
      if (!updated) {
        return reply.status(404).send({ error: 'Binding not found', code: 'NOT_FOUND' });
      }

      return reply.status(200).send({
        data: { ...updated, bot_token_enc: updated.bot_token_enc ? '***' : null },
      });
    },
  );

  /** DELETE /api/business-scopes/:scopeId/im-channels/:bindingId — Remove a binding */
  fastify.delete<BindingParam>(
    '/:scopeId/im-channels/:bindingId',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<BindingParam>, reply: FastifyReply) => {
      const deleted = await imChannelRepository.delete(request.params.bindingId, request.user!.orgId);
      if (!deleted) {
        return reply.status(404).send({ error: 'Binding not found', code: 'NOT_FOUND' });
      }
      return reply.status(204).send();
    },
  );

  /**
   * POST /api/business-scopes/:scopeId/im-channels/:bindingId/register-webhook
   * Register the webhook URL with the IM platform (currently Telegram only).
   * Automates the manual `setWebhook` step.
   */
  fastify.post<BindingParam>(
    '/:scopeId/im-channels/:bindingId/register-webhook',
    { preHandler: [authenticate] },
    async (request: FastifyRequest<BindingParam>, reply: FastifyReply) => {
      const binding = await imChannelRepository.findById(
        request.params.bindingId,
        request.user!.orgId,
      );
      if (!binding) {
        return reply.status(404).send({ error: 'Binding not found', code: 'NOT_FOUND' });
      }

      if (binding.channel_type !== 'telegram') {
        return reply.status(400).send({
          error: 'Webhook registration is only supported for Telegram bindings',
          code: 'UNSUPPORTED',
        });
      }

      const botToken = binding.bot_token_enc;
      if (!botToken) {
        return reply.status(400).send({ error: 'Bot token is required', code: 'VALIDATION_ERROR' });
      }

      const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
      const webhookUrl = `${baseUrl}/api/im/telegram/webhook`;
      const cfg = (binding.config ?? {}) as Record<string, string>;

      const result = await telegramAdapter.setWebhook(botToken, webhookUrl, cfg.secret_token);

      return reply.status(200).send({
        ok: result.ok,
        webhookUrl,
        description: result.description,
      });
    },
  );
}

// ============================================================================
// Platform Webhook Routes — Receive messages from IM platforms (no auth)
// ============================================================================

/**
 * Helper: look up binding by channel type + channel ID extracted from the event,
 * then verify the request signature using secrets stored in the binding config.
 */
async function verifyAndLookupBinding(
  channelType: string,
  channelId: string,
  adapter: import('../services/im.service.js').IMAdapter,
  headers: Record<string, string>,
  rawBody: string,
): Promise<{ binding: import('../repositories/im-channel.repository.js').IMChannelBindingEntity } | { error: string }> {
  const binding = await imChannelRepository.findByChannelTypeAndId(channelType, channelId);
  if (!binding) {
    return { error: `No active binding for ${channelType}:${channelId}` };
  }

  const cfg = (binding.config ?? {}) as Record<string, string>;

  // Inject platform-specific secrets into headers for adapter verification
  if (channelType === 'slack' && cfg.signing_secret) {
    headers['x-slack-signing-secret-internal'] = cfg.signing_secret;
  }
  if (channelType === 'feishu' && cfg.verification_token) {
    headers['x-feishu-verification-token-internal'] = cfg.verification_token;
  }
  if (channelType === 'telegram' && cfg.secret_token) {
    headers['x-telegram-bot-api-secret-token-internal'] = cfg.secret_token;
  }
  if (channelType === 'dingtalk' && cfg.signing_secret) {
    headers['x-dingtalk-secret-internal'] = cfg.signing_secret;
  }
  if (channelType === 'discord' && cfg.public_key) {
    headers['x-discord-public-key-internal'] = cfg.public_key;
  }

  if (!adapter.verifyRequest(headers, rawBody)) {
    return { error: 'Signature verification failed' };
  }

  return { binding };
}

export async function imWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  // Ensure raw body is available for signature verification
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        const json = JSON.parse(body as string);
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  /**
   * POST /api/im/slack/events — Slack Events API endpoint.
   * Handles URL verification challenges and incoming messages.
   * Verified via Slack signing secret stored in binding config.
   */
  fastify.post(
    '/slack/events',
    { config: { rawBody: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;

      // Handle Slack URL verification challenge (no signature check needed)
      const challenge = SlackAdapter.isChallenge(body);
      if (challenge) {
        return reply.status(200).send({ challenge });
      }

      // Parse the event to get channel ID for binding lookup
      const msg = slackAdapter.parseEvent(body);
      if (!msg) {
        return reply.status(200).send({ ok: true });
      }

      // Verify signature using binding's signing secret
      const headers = request.headers as Record<string, string>;
      const rawBody = JSON.stringify(request.body);
      const result = await verifyAndLookupBinding('slack', msg.channelId, slackAdapter, headers, rawBody);
      if ('error' in result) {
        console.warn(`[SLACK] ${result.error}`);
        return reply.status(200).send({ ok: true }); // Slack expects 200 even on errors
      }

      // Acknowledge immediately — Slack requires 200 within 3 seconds
      reply.status(200).send({ ok: true });

      try {
        await imService.handleMessage(msg);
      } catch (error) {
        console.error('[SLACK] Failed to handle message:', error instanceof Error ? error.message : error);
      }
    },
  );

  /**
   * POST /api/im/telegram/webhook — Telegram Bot API webhook endpoint.
   * Verified via secret_token header matched against binding config.
   */
  fastify.post(
    '/telegram/webhook',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const msg = telegramAdapter.parseEvent(request.body);
      if (!msg) {
        return reply.status(200).send({ ok: true });
      }

      // Verify using binding's secret_token
      const headers = request.headers as Record<string, string>;
      const rawBody = JSON.stringify(request.body);
      const result = await verifyAndLookupBinding('telegram', msg.channelId, telegramAdapter, headers, rawBody);
      if ('error' in result) {
        console.warn(`[TELEGRAM] ${result.error}`);
        return reply.status(403).send({ error: 'Forbidden' });
      }

      reply.status(200).send({ ok: true });

      try {
        await imService.handleMessage(msg);
      } catch (error) {
        console.error('[TELEGRAM] Failed to handle message:', error instanceof Error ? error.message : error);
      }
    },
  );

  /**
   * POST /api/im/discord/interactions — Discord Interactions endpoint.
   * Verified via Ed25519 signature matched against binding's public key.
   */
  fastify.post(
    '/discord/interactions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Handle Discord PING → PONG (before signature check for initial setup)
      if (DiscordAdapter.isPing(request.body)) {
        return reply.status(200).send({ type: 1 });
      }

      const msg = discordAdapter.parseEvent(request.body);
      if (!msg) {
        return reply.status(200).send({ ok: true });
      }

      const headers = request.headers as Record<string, string>;
      const rawBody = JSON.stringify(request.body);
      const result = await verifyAndLookupBinding('discord', msg.channelId, discordAdapter, headers, rawBody);
      if ('error' in result) {
        console.warn(`[DISCORD] ${result.error}`);
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      reply.status(200).send({ ok: true });

      try {
        await imService.handleMessage(msg);
      } catch (error) {
        console.error('[DISCORD] Failed to handle message:', error instanceof Error ? error.message : error);
      }
    },
  );

  /**
   * POST /api/im/feishu/events — Feishu (Lark) Event Subscription endpoint.
   * Verified via verification_token in binding config.
   */
  fastify.post(
    '/feishu/events',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, unknown>;

      // Handle Feishu URL verification challenge
      const challenge = FeishuAdapter.isChallenge(body);
      if (challenge) {
        return reply.status(200).send({ challenge });
      }

      const msg = feishuAdapter.parseEvent(body);
      if (!msg) {
        return reply.status(200).send({ ok: true });
      }

      const headers = request.headers as Record<string, string>;
      const rawBody = JSON.stringify(request.body);
      const result = await verifyAndLookupBinding('feishu', msg.channelId, feishuAdapter, headers, rawBody);
      if ('error' in result) {
        console.warn(`[FEISHU] ${result.error}`);
        return reply.status(200).send({ ok: true });
      }

      reply.status(200).send({ ok: true });

      try {
        await imService.handleMessage(msg);
      } catch (error) {
        console.error('[FEISHU] Failed to handle message:', error instanceof Error ? error.message : error);
      }
    },
  );

  /**
   * POST /api/im/dingtalk/callback — DingTalk Robot callback endpoint.
   * Verified via signing secret in binding config.
   */
  fastify.post(
    '/dingtalk/callback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const msg = dingtalkAdapter.parseEvent(request.body);
      if (!msg) {
        return reply.status(200).send({ ok: true });
      }

      const headers = request.headers as Record<string, string>;
      const rawBody = JSON.stringify(request.body);
      const result = await verifyAndLookupBinding('dingtalk', msg.channelId, dingtalkAdapter, headers, rawBody);
      if ('error' in result) {
        console.warn(`[DINGTALK] ${result.error}`);
        return reply.status(403).send({ error: 'Forbidden' });
      }

      reply.status(200).send({ ok: true });

      try {
        await imService.handleMessage(msg);
      } catch (error) {
        console.error('[DINGTALK] Failed to handle message:', error instanceof Error ? error.message : error);
      }
    },
  );

  /**
   * GET /api/im/whatsapp/webhook — Meta webhook verification challenge.
   * Meta sends hub.mode=subscribe with hub.challenge and hub.verify_token.
   * We validate verify_token against the binding config, then echo back the challenge.
   */
  fastify.get<{
    Querystring: { 'hub.mode'?: string; 'hub.challenge'?: string; 'hub.verify_token'?: string };
  }>(
    '/whatsapp/webhook',
    async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const check = WhatsAppAdapter.isVerificationChallenge(query);

      if (!check.isChallenge) {
        return reply.status(403).send('Forbidden');
      }

      // Find a WhatsApp binding that matches this verify_token
      const { prisma } = await import('../config/database.js');
      const bindings = await prisma.im_channel_bindings.findMany({
        where: { channel_type: 'whatsapp', is_enabled: true },
      });

      const matched = bindings.find((b) => {
        const cfg = (b.config as Record<string, string>) ?? {};
        return cfg.verify_token === check.verifyToken;
      });

      if (!matched) {
        console.warn('[WHATSAPP] Verification challenge: no binding matches verify_token');
        return reply.status(403).send('Forbidden');
      }

      console.log(`[WHATSAPP] Webhook verified for binding ${matched.id}`);
      return reply.status(200).send(check.challenge);
    },
  );

  /**
   * POST /api/im/whatsapp/webhook — WhatsApp Cloud API incoming messages.
   * Verified via HMAC-SHA256 signature (X-Hub-Signature-256 header).
   */
  fastify.post(
    '/whatsapp/webhook',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body;

      // Parse all messages from the payload (Meta can batch multiple)
      const messages = whatsappAdapter.parseAllEvents(body);
      if (messages.length === 0) {
        return reply.status(200).send({ ok: true });
      }

      // Verify signature using the first message's channelId to find the binding
      const firstMsg = messages[0];
      const headers = request.headers as Record<string, string>;
      const rawBody = JSON.stringify(request.body);

      // Look up binding by phone_number_id
      const binding = await imChannelRepository.findByChannelTypeAndId('whatsapp', firstMsg.channelId);
      if (!binding) {
        console.warn(`[WHATSAPP] No active binding for phone_number_id: ${firstMsg.channelId}`);
        return reply.status(200).send({ ok: true });
      }

      // Inject app_secret for signature verification
      const cfg = (binding.config ?? {}) as Record<string, string>;
      if (cfg.app_secret) {
        headers['x-whatsapp-app-secret-internal'] = cfg.app_secret;
      }

      if (!whatsappAdapter.verifyRequest(headers, rawBody)) {
        console.warn('[WHATSAPP] Signature verification failed');
        return reply.status(200).send({ ok: true }); // Return 200 to prevent Meta retries
      }

      // Acknowledge immediately
      reply.status(200).send({ ok: true });

      // Enqueue each message for async processing
      for (const msg of messages) {
        try {
          await imQueueService.enqueue(msg);
        } catch (error) {
          console.error('[WHATSAPP] Failed to enqueue message:', error instanceof Error ? error.message : error);
        }
      }
    },
  );

  /**
   * POST /api/im/webhook/:bindingId — Generic webhook endpoint.
   * For platforms that don't have a dedicated adapter.
   * Expects: { text: string, thread_id?: string, user_id?: string }
   */
  fastify.post<{ Params: { bindingId: string }; Body: { text: string; thread_id?: string; user_id?: string } }>(
    '/webhook/:bindingId',
    async (request, reply) => {
      const { bindingId } = request.params;
      const { text, thread_id, user_id } = request.body;

      if (!text) {
        return reply.status(400).send({ error: 'text is required' });
      }

      const binding = await findBindingById(bindingId);
      if (!binding || !binding.is_enabled) {
        return reply.status(404).send({ error: 'Binding not found or disabled' });
      }

      const msg: import('../services/im.service.js').NormalizedIMMessage = {
        channelType: binding.channel_type,
        channelId: binding.channel_id,
        threadId: thread_id || `webhook-${Date.now()}`,
        userId: user_id || 'webhook-user',
        text,
      };

      try {
        const result = await imService.handleMessage(msg);
        return reply.status(200).send({ text: result.text, session_id: result.sessionId });
      } catch (error) {
        console.error('[WEBHOOK] Failed to handle message:', error instanceof Error ? error.message : error);
        return reply.status(500).send({ error: 'Failed to process message' });
      }
    },
  );
}

/** Helper to find a binding by ID without org context (for unauthenticated webhooks). */
async function findBindingById(bindingId: string) {
  const { prisma } = await import('../config/database.js');
  return prisma.im_channel_bindings.findUnique({
    where: { id: bindingId },
  });
}
