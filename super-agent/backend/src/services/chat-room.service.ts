/**
 * Chat Room Service
 * Manages group chat rooms with multiple agents.
 */

import { chatRoomMemberRepository, type ChatRoomMemberWithAgent } from '../repositories/chat-room-member.repository.js';
import { chatSessionRepository, chatMessageRepository, type ChatSessionEntity, type ChatMessageEntity } from '../repositories/chat.repository.js';
import { agentRepository } from '../repositories/agent.repository.js';
import { businessScopeRepository } from '../repositories/businessScope.repository.js';
import { AppError } from '../middleware/errorHandler.js';
import { messageRouter, type RouteDecision } from './message-router.service.js';
import { aiService } from './ai.service.js';

export interface CreateRoomOptions {
  title?: string;
  businessScopeId?: string;
  agentIds: string[];
}

export class ChatRoomService {
  // ==========================================================================
  // Room Lifecycle
  // ==========================================================================

  async createRoom(
    organizationId: string,
    userId: string,
    options: CreateRoomOptions,
  ): Promise<ChatSessionEntity & { members: ChatRoomMemberWithAgent[] }> {
    if (!options.agentIds || options.agentIds.length === 0) {
      throw AppError.validation('At least one agent is required to create a room');
    }

    // Validate all agents exist
    for (const agentId of options.agentIds) {
      const agent = await agentRepository.findById(agentId, organizationId);
      if (!agent) throw AppError.notFound(`Agent with ID ${agentId} not found`);
    }

    // Create the session in group mode
    const session = await chatSessionRepository.createForUser(
      {
        business_scope_id: options.businessScopeId ?? null,
        agent_id: null,
        claude_session_id: null,
        title: options.title ?? null,
        status: 'idle',
        sop_context: null,
        context: {},
        room_mode: 'group',
        routing_strategy: 'auto',
      },
      organizationId,
      userId,
    );

    // Add members — all agents are equal (no primary)
    for (const agentId of options.agentIds) {
      await chatRoomMemberRepository.addMember(session.id, agentId, 'member', userId);
    }

    const members = await chatRoomMemberRepository.findBySession(session.id);
    return { ...session, members };
  }

  async createRoomFromScope(
    organizationId: string,
    userId: string,
    businessScopeId: string,
  ): Promise<ChatSessionEntity & { members: ChatRoomMemberWithAgent[] }> {
    const scope = await businessScopeRepository.findByIdWithAgents(businessScopeId, organizationId);
    if (!scope) throw AppError.notFound(`Business scope with ID ${businessScopeId} not found`);

    const agents = (scope as Record<string, unknown>).agents as Array<{ id: string }> | undefined;
    if (!agents || agents.length === 0) {
      throw AppError.validation('Business scope has no agents');
    }

    return this.createRoom(organizationId, userId, {
      title: (scope as Record<string, unknown>).name as string,
      businessScopeId,
      agentIds: agents.map(a => a.id),
    });
  }

  // ==========================================================================
  // Member Management
  // ==========================================================================

  async addMember(
    organizationId: string,
    roomId: string,
    agentId: string,
    addedBy?: string,
  ): Promise<void> {
    const session = await chatSessionRepository.findById(roomId, organizationId);
    if (!session) throw AppError.notFound(`Room with ID ${roomId} not found`);
    if ((session as ChatSessionEntity).room_mode !== 'group') {
      throw AppError.validation('Cannot add members to a single-mode session');
    }

    const agent = await agentRepository.findById(agentId, organizationId);
    if (!agent) throw AppError.notFound(`Agent with ID ${agentId} not found`);

    await chatRoomMemberRepository.addMember(roomId, agentId, 'member', addedBy);

    // Add system message
    await chatMessageRepository.create({
      session_id: roomId,
      type: 'system',
      content: JSON.stringify({ event: 'member_joined', agent_id: agentId, agent_name: agent.display_name }),
      agent_id: null,
      mention_agent_id: null,
      metadata: {},
    }, organizationId);
  }

  async removeMember(organizationId: string, roomId: string, agentId: string): Promise<void> {
    const session = await chatSessionRepository.findById(roomId, organizationId);
    if (!session) throw AppError.notFound(`Room with ID ${roomId} not found`);

    await chatRoomMemberRepository.removeMember(roomId, agentId);
  }

  async getMembers(organizationId: string, roomId: string): Promise<ChatRoomMemberWithAgent[]> {
    const session = await chatSessionRepository.findById(roomId, organizationId);
    if (!session) throw AppError.notFound(`Room with ID ${roomId} not found`);
    return chatRoomMemberRepository.findBySession(roomId);
  }

  // ==========================================================================
  // Message Routing
  // ==========================================================================

  async routeMessage(
    organizationId: string,
    roomId: string,
    message: string,
    mentionAgentId?: string,
  ): Promise<RouteDecision> {
    const session = await chatSessionRepository.findById(roomId, organizationId) as ChatSessionEntity | null;
    if (!session) throw AppError.notFound(`Room with ID ${roomId} not found`);

    const members = await chatRoomMemberRepository.findBySession(roomId);
    const recentMessages = await chatMessageRepository.findBySession(organizationId, roomId, { limit: 20 });

    return messageRouter.route({
      message,
      mentionAgentId,
      members,
      recentMessages: recentMessages.reverse(),
    });
  }

  // ==========================================================================
  // Room Context Building
  // ==========================================================================

  async buildRoomContext(
    organizationId: string,
    roomId: string,
    targetAgentId: string,
  ): Promise<string> {
    const members = await chatRoomMemberRepository.findBySession(roomId);
    const messages = await chatMessageRepository.findBySession(organizationId, roomId, { limit: 50 });
    const orderedMessages = messages.reverse();

    let context = `You are in a group chat room. Room members:\n`;
    for (const member of members) {
      const marker = member.agent_id === targetAgentId ? ' (you)' : '';
      context += `- ${member.agent.display_name}${marker}: ${member.agent.role || 'General assistant'}\n`;
    }

    if (orderedMessages.length > 0) {
      context += `\nRecent conversation:\n`;
      for (const msg of orderedMessages) {
        if (msg.type === 'user') {
          context += `[User]: ${msg.content}\n`;
        } else if (msg.type === 'system') {
          // Skip system messages in context
          continue;
        } else {
          const agent = members.find(m => m.agent_id === msg.agent_id);
          const name = agent?.agent.display_name ?? 'AI';
          context += `[@${name}]: ${typeof msg.content === 'string' && msg.content.startsWith('[') ? '(structured response)' : msg.content}\n`;
        }
      }
    }

    context += `\nRespond based on the conversation context above. You are the agent being addressed.`;
    return context;
  }

  // ==========================================================================
  // In-Room Agent Creation
  // ==========================================================================

  async suggestAgentForRoom(
    organizationId: string,
    roomId: string,
    description: string,
  ): Promise<{ suggested_agent: import('./ai.service.js').SuggestedAgentRole; follow_up_questions: string[]; confidence: number }> {
    const session = await chatSessionRepository.findById(roomId, organizationId) as ChatSessionEntity | null;
    if (!session) throw AppError.notFound(`Room with ID ${roomId} not found`);

    const members = await chatRoomMemberRepository.findBySession(roomId);
    const existingRoles = members.map(m => m.agent.role || m.agent.display_name);

    let scopeName: string | undefined;
    let scopeDesc: string | undefined;
    if (session.business_scope_id) {
      const scope = await businessScopeRepository.findById(session.business_scope_id, organizationId);
      if (scope) {
        scopeName = (scope as Record<string, unknown>).name as string;
        scopeDesc = (scope as Record<string, unknown>).description as string | undefined;
      }
    }

    return aiService.suggestAgentFromConversation({
      description,
      businessScopeName: scopeName,
      businessScopeDescription: scopeDesc,
      existingAgentRoles: existingRoles,
    });
  }

  async createAgentInRoom(
    organizationId: string,
    roomId: string,
    userId: string,
    agentDef: {
      name: string;
      display_name: string;
      role?: string;
      system_prompt?: string;
      tools?: unknown[];
    },
  ): Promise<{ agent: import('../repositories/agent.repository.js').AgentEntity }> {
    const session = await chatSessionRepository.findById(roomId, organizationId) as ChatSessionEntity | null;
    if (!session) throw AppError.notFound(`Room with ID ${roomId} not found`);

    const { agentService } = await import('./agent.service.js');

    const agent = await agentService.createAgent({
      name: agentDef.name,
      display_name: agentDef.display_name,
      role: agentDef.role,
      system_prompt: agentDef.system_prompt,
      tools: agentDef.tools ?? [],
      business_scope_id: session.business_scope_id,
      origin: 'chat_created',
      is_shared: false,
    }, organizationId);

    // Add to room
    await chatRoomMemberRepository.addMember(roomId, agent.id, 'member', userId);

    // System message
    await chatMessageRepository.create({
      session_id: roomId,
      type: 'system',
      content: JSON.stringify({ event: 'agent_created', agent_id: agent.id, agent_name: agent.display_name }),
      agent_id: null,
      mention_agent_id: null,
      metadata: {},
    }, organizationId);

    return { agent };
  }
}

export const chatRoomService = new ChatRoomService();
