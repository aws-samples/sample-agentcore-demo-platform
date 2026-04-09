/**
 * IM (Instant Messaging) Service
 *
 * Handles incoming messages from IM platforms (Slack, Discord, etc.),
 * resolves them to chat sessions, and sends responses back.
 *
 * Updated to support:
 * - Async processing via BullMQ (messages enqueued by webhooks/gateways)
 * - replyContext for platform-specific reply metadata (e.g. DingTalk sessionWebhook)
 * - Extended IMAdapter interface with optional gateway lifecycle methods
 */

import {
  imChannelRepository,
  imThreadSessionRepository,
  type IMChannelBindingEntity,
} from '../repositories/im-channel.repository.js';
import { chatService } from './chat.service.js';

/** Normalized message from any IM platform. */
export interface NormalizedIMMessage {
  channelType: string;
  channelId: string;
  threadId: string;
  userId: string;
  userName?: string;
  text: string;
  /** Pre-resolved binding ID (set by Gateway adapters that already know the binding). */
  bindingId?: string;
}

/** Adapter interface — each IM platform implements this. */
export interface IMAdapter {
  /** Verify the incoming request signature. Returns true if valid. */
  verifyRequest(headers: Record<string, string>, body: string): boolean;
  /** Parse the raw platform event into a normalized message (or null if not a user message). */
  parseEvent(body: unknown): NormalizedIMMessage | null;
  /** Send a reply back to the IM platform. */
  sendReply(
    binding: IMChannelBindingEntity,
    threadId: string,
    text: string,
    replyContext?: Record<string, unknown>,
  ): Promise<void>;
  /** Optional: start a long-lived gateway connection (Discord Gateway, DingTalk Stream, Feishu WSClient). */
  startGateway?(): Promise<void>;
  /** Optional: stop the gateway connection on shutdown. */
  stopGateway?(): Promise<void>;
  /** Optional: dynamically add a bot connection. */
  addBot?(binding: IMChannelBindingEntity): Promise<void>;
  /** Optional: remove a bot connection. */
  removeBot?(bindingId: string): void;
}

class IMService {
  private adapters = new Map<string, IMAdapter>();

  registerAdapter(channelType: string, adapter: IMAdapter): void {
    this.adapters.set(channelType, adapter);
  }

  getAdapter(channelType: string): IMAdapter | undefined {
    return this.adapters.get(channelType);
  }

  /**
   * Start all gateway-based adapters (Discord, DingTalk, Feishu).
   * Called once at app startup after adapters are registered.
   */
  async startGateways(): Promise<void> {
    for (const [type, adapter] of this.adapters) {
      if (adapter.startGateway) {
        try {
          await adapter.startGateway();
          console.log(`[IM] Gateway started for ${type}`);
        } catch (err) {
          console.error(`[IM] Failed to start gateway for ${type}:`, err instanceof Error ? err.message : err);
        }
      }
    }
  }

  /**
   * Stop all gateway-based adapters. Called on graceful shutdown.
   */
  async stopGateways(): Promise<void> {
    for (const [type, adapter] of this.adapters) {
      if (adapter.stopGateway) {
        try {
          await adapter.stopGateway();
          console.log(`[IM] Gateway stopped for ${type}`);
        } catch (err) {
          console.error(`[IM] Failed to stop gateway for ${type}:`, err instanceof Error ? err.message : err);
        }
      }
    }
  }

  /**
   * Handle an incoming IM message end-to-end:
   * 1. Find channel binding → determines org + scope
   * 2. Find or create thread→session mapping
   * 3. Call ChatService.processMessage (same as web UI)
   * 4. Send response back via adapter
   *
   * @param replyContext - Platform-specific context for replies (e.g. DingTalk sessionWebhook)
   */
  async handleMessage(
    msg: NormalizedIMMessage,
    replyContext?: Record<string, unknown>,
  ): Promise<{ text: string; sessionId: string }> {
    // 1. Find binding — use pre-resolved bindingId (Gateway mode) or look up by channel
    let binding: IMChannelBindingEntity | null = null;
    if (msg.bindingId) {
      binding = await imChannelRepository.findById(msg.bindingId);
    }
    if (!binding) {
      binding = await imChannelRepository.findByChannelTypeAndId(msg.channelType, msg.channelId);
    }
    if (!binding) {
      throw new Error(`No active IM binding for ${msg.channelType}:${msg.channelId}`);
    }

    // 2. Resolve or create session
    const { sessionId } = await this.resolveSession(binding, msg);

    // 3. Process message through ChatService (same code path as web UI)
    // Use binding's creator as the system userId (IM platform user IDs are not UUIDs)
    const systemUserId = binding.created_by || 'system';
    const response = await chatService.processMessage({
      sessionId,
      businessScopeId: binding.business_scope_id,
      message: msg.text,
      organizationId: binding.organization_id,
      userId: systemUserId,
    });

    // 4. Send reply back
    const adapter = this.adapters.get(msg.channelType);
    if (adapter) {
      await adapter.sendReply(binding, msg.threadId, response.text, replyContext);
    }

    return { text: response.text, sessionId: response.sessionId };
  }

  private async resolveSession(
    binding: IMChannelBindingEntity,
    msg: NormalizedIMMessage,
  ): Promise<{ sessionId: string; isNew: boolean }> {
    // Check existing thread→session mapping
    const existing = await imThreadSessionRepository.findByThread(binding.id, msg.threadId);
    if (existing) {
      return { sessionId: existing.session_id, isNew: false };
    }

    // New thread — create session + mapping
    // Use binding's creator as session owner (IM platform user IDs are not UUIDs)
    const systemUserId = binding.created_by || 'system';
    const session = await chatService.createSession(
      { business_scope_id: binding.business_scope_id, context: {} },
      binding.organization_id,
      systemUserId,
    );

    await imThreadSessionRepository.create({
      binding_id: binding.id,
      thread_id: msg.threadId,
      session_id: session.id,
      im_user_id: msg.userId,
    });

    return { sessionId: session.id, isNew: true };
  }
}

export const imService = new IMService();
