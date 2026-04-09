/**
 * Message Router Service
 * Routes messages to the appropriate agent in a group chat room.
 *
 * Routing chain (highest to lowest priority):
 * 1. Explicit @mention → direct route, confidence 1.0
 * 2. Context continuation → if recent conversation is with one agent, continue
 * 3. AI semantic routing → analyze message + agent roles to pick best match
 * 4. Uncertain fallback → return low confidence, let frontend ask user to pick
 */

import type { ChatRoomMemberWithAgent } from '../repositories/chat-room-member.repository.js';
import type { ChatMessageEntity } from '../repositories/chat.repository.js';
import { aiService } from './ai.service.js';

export interface RouteDecision {
  targetAgentId: string;
  targetAgentName: string;
  confidence: number;
  reasoning: string;
  routedBy: 'mention' | 'context' | 'auto' | 'uncertain';
}

/** Confidence threshold — below this, frontend should ask user to pick. */
export const CONFIDENCE_THRESHOLD = 0.5;

export class MessageRouter {
  /**
   * Parse @mention from message content.
   * Scans the entire message (not just the start) for @agent patterns.
   */
  parseMention(content: string, members: ChatRoomMemberWithAgent[]): string | null {
    const activeMembers = members.filter(m => m.is_active);

    // First: try full display_name match (supports names with spaces)
    for (const member of activeMembers) {
      const patterns = [member.agent.name, member.agent.display_name].filter(Boolean);
      for (const name of patterns) {
        if (content.includes(`@${name}`)) return member.agent_id;
      }
    }

    // Fallback: regex match all @word patterns
    const mentions = [...content.matchAll(/@(\S+)/g)];
    for (const match of mentions) {
      const text = match[1].toLowerCase();
      for (const member of activeMembers) {
        if (member.agent.name.toLowerCase() === text) return member.agent_id;
        if (member.agent.display_name.toLowerCase() === text) return member.agent_id;
      }
    }
    return null;
  }

  /**
   * Route a message to the appropriate agent.
   * All agents are equal — no primary/fallback designation.
   */
  async route(params: {
    message: string;
    mentionAgentId?: string;
    members: ChatRoomMemberWithAgent[];
    recentMessages: ChatMessageEntity[];
  }): Promise<RouteDecision> {
    const activeMembers = params.members.filter(m => m.is_active);
    if (activeMembers.length === 0) {
      throw new Error('No active members in room');
    }

    // 1. Explicit @mention (from frontend UI)
    if (params.mentionAgentId) {
      const target = activeMembers.find(m => m.agent_id === params.mentionAgentId);
      if (target) {
        return {
          targetAgentId: target.agent_id,
          targetAgentName: target.agent.display_name,
          confidence: 1.0,
          reasoning: 'User explicitly mentioned this agent',
          routedBy: 'mention',
        };
      }
    }

    // 2. Parse @mention from message text
    const parsedMentionId = this.parseMention(params.message, activeMembers);
    if (parsedMentionId) {
      const target = activeMembers.find(m => m.agent_id === parsedMentionId);
      if (target) {
        return {
          targetAgentId: target.agent_id,
          targetAgentName: target.agent.display_name,
          confidence: 1.0,
          reasoning: 'Parsed @mention from message content',
          routedBy: 'mention',
        };
      }
    }

    // 3. Single member — no routing needed
    if (activeMembers.length === 1) {
      return {
        targetAgentId: activeMembers[0].agent_id,
        targetAgentName: activeMembers[0].agent.display_name,
        confidence: 1.0,
        reasoning: 'Only one active member',
        routedBy: 'auto',
      };
    }

    // 4. Context continuation — if the last few AI messages are from the same agent,
    //    continue routing to that agent (natural conversation flow)
    const contextAgent = this.detectContextContinuation(activeMembers, params.recentMessages);
    if (contextAgent) {
      return {
        targetAgentId: contextAgent.agent_id,
        targetAgentName: contextAgent.agent.display_name,
        confidence: 0.8,
        reasoning: 'Continuing conversation with the same agent',
        routedBy: 'context',
      };
    }

    // 5. AI semantic routing
    try {
      return await this.autoRoute(params.message, activeMembers, params.recentMessages);
    } catch (err) {
      console.error('[MessageRouter] AI routing failed:', err instanceof Error ? err.message : err);
      // Return uncertain — let frontend ask user to pick
      return {
        targetAgentId: activeMembers[0].agent_id,
        targetAgentName: activeMembers[0].agent.display_name,
        confidence: 0.2,
        reasoning: 'AI routing failed — please select an agent',
        routedBy: 'uncertain',
      };
    }
  }

  /**
   * Detect if the recent conversation is a continuation with one agent.
   * If the last 1-3 AI messages are all from the same agent, and the last
   * message was from that agent (not a different one), return that agent.
   */
  private detectContextContinuation(
    members: ChatRoomMemberWithAgent[],
    recentMessages: ChatMessageEntity[],
  ): ChatRoomMemberWithAgent | null {
    // Look at the last few messages (already in chronological order)
    const recent = recentMessages.slice(-6);
    if (recent.length === 0) return null;

    // Find the last AI message
    const lastAiMessages = recent.filter(m => m.type === 'ai' && m.agent_id);
    if (lastAiMessages.length === 0) return null;

    const lastAgentId = lastAiMessages[lastAiMessages.length - 1].agent_id;
    if (!lastAgentId) return null;

    // Check if the last user message came after the last AI message
    // (meaning user is replying to that agent)
    const lastMsg = recent[recent.length - 1];
    if (lastMsg.type !== 'user') return null;

    // The user's message is the latest, and the AI message before it
    // was from lastAgentId — this is a continuation
    return members.find(m => m.agent_id === lastAgentId && m.is_active) ?? null;
  }

  private async autoRoute(
    message: string,
    members: ChatRoomMemberWithAgent[],
    recentMessages: ChatMessageEntity[],
  ): Promise<RouteDecision> {
    const memberDescriptions = members.map(m =>
      `- ${m.agent.display_name} (@${m.agent.name}): ${m.agent.role || 'General assistant'}`
    ).join('\n');

    const recentContext = recentMessages.slice(-5).map(msg => {
      if (msg.type === 'user') return `[User]: ${msg.content.substring(0, 200)}`;
      const agent = members.find(m => m.agent_id === msg.agent_id);
      return `[@${agent?.agent.display_name ?? 'AI'}]: ${msg.content.substring(0, 200)}`;
    }).join('\n');

    const prompt = `You are a message router for a group chat with multiple AI assistants. Based on the user's message and conversation context, decide which assistant should respond.

Room members:
${memberDescriptions}

Recent conversation:
${recentContext || '(no prior messages)'}

New user message: ${message}

Rules:
- Pick the assistant whose role best matches the question
- If the message is a follow-up to a recent exchange, prefer the same assistant
- If genuinely unclear, set confidence below 0.5

Return ONLY valid JSON (no markdown):
{"target_agent_name": "agent-name", "confidence": 0.85, "reasoning": "brief reason"}`;

    const response = await aiService.chatCompletion({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256,
    });

    let jsonStr = response.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

    let parsed: { target_agent_name?: string; confidence?: number; reasoning?: string };
    try {
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      console.error('[MessageRouter] Failed to parse AI response:', jsonStr.substring(0, 200));
      return {
        targetAgentId: members[0].agent_id,
        targetAgentName: members[0].agent.display_name,
        confidence: 0.2,
        reasoning: 'AI returned invalid JSON — please select an agent',
        routedBy: 'uncertain',
      };
    }

    const targetName = String(parsed.target_agent_name || '');
    const target = members.find(m =>
      m.agent.name.toLowerCase() === targetName.toLowerCase() ||
      m.agent.display_name.toLowerCase() === targetName.toLowerCase()
    );

    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5;

    if (target) {
      return {
        targetAgentId: target.agent_id,
        targetAgentName: target.agent.display_name,
        confidence,
        reasoning: String(parsed.reasoning || 'AI auto-routed'),
        routedBy: confidence >= CONFIDENCE_THRESHOLD ? 'auto' : 'uncertain',
      };
    }

    // AI returned unknown agent name
    return {
      targetAgentId: members[0].agent_id,
      targetAgentName: members[0].agent.display_name,
      confidence: 0.3,
      reasoning: `AI suggested "${targetName}" but not found in room`,
      routedBy: 'uncertain',
    };
  }
}

export const messageRouter = new MessageRouter();
