/**
 * useChatRoom Hook
 * State management for group chat rooms.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  RestChatRoomService,
  type ChatRoom,
  type RoomMember,
  type RoomMessage,
  type RouteDecision,
  type SuggestedAgent,
} from './api/restChatRoomService';
import { getAuthToken } from './api/restClient';
import { parseSSEFrames, parseSSEData, type ContentBlock } from './chatStreamService';

interface UseChatRoomOptions {
  roomId?: string;
  pollInterval?: number;
}

interface UseChatRoomReturn {
  room: ChatRoom | null;
  members: RoomMember[];
  messages: RoomMessage[];
  isLoading: boolean;
  error: string | null;

  // Room actions
  createRoom: (options: Parameters<typeof RestChatRoomService.createRoom>[0]) => Promise<ChatRoom>;
  createRoomFromScope: (scopeId: string) => Promise<ChatRoom>;

  // Member actions
  addMember: (agentId: string) => Promise<void>;
  removeMember: (agentId: string) => Promise<void>;

  // Messaging
  sendMessage: (content: string, mentionAgentId?: string) => Promise<RouteDecision | null>;
  isSending: boolean;
  loadMoreMessages: () => Promise<void>;

  // In-room agent creation
  suggestAgent: (description: string) => Promise<{ suggested_agent: SuggestedAgent; follow_up_questions: string[]; confidence: number } | null>;
  confirmCreateAgent: (agentDef: Parameters<typeof RestChatRoomService.confirmCreateAgent>[1]) => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;
}

export function useChatRoom(options: UseChatRoomOptions = {}): UseChatRoomReturn {
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roomIdRef = useRef(options.roomId);

  const loadRoom = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const [roomData, memberData, msgData] = await Promise.all([
        RestChatRoomService.getRoom(id),
        RestChatRoomService.getMembers(id),
        RestChatRoomService.getMessages(id, 50),
      ]);
      setRoom(roomData);
      setMembers(memberData);
      setMessages(msgData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    roomIdRef.current = options.roomId;
    if (options.roomId) loadRoom(options.roomId);
  }, [options.roomId, loadRoom]);

  // Polling for new messages
  useEffect(() => {
    if (!options.roomId || !options.pollInterval) return;
    const interval = setInterval(async () => {
      if (!roomIdRef.current) return;
      try {
        const msgs = await RestChatRoomService.getMessages(roomIdRef.current, 50);
        setMessages(msgs);
      } catch { /* ignore polling errors */ }
    }, options.pollInterval);
    return () => clearInterval(interval);
  }, [options.roomId, options.pollInterval]);

  const createRoom = useCallback(async (opts: Parameters<typeof RestChatRoomService.createRoom>[0]) => {
    const newRoom = await RestChatRoomService.createRoom(opts);
    setRoom(newRoom);
    setMembers(newRoom.members);
    setMessages([]);
    return newRoom;
  }, []);

  const createRoomFromScope = useCallback(async (scopeId: string) => {
    const newRoom = await RestChatRoomService.createRoomFromScope(scopeId);
    setRoom(newRoom);
    setMembers(newRoom.members);
    setMessages([]);
    return newRoom;
  }, []);

  const addMember = useCallback(async (agentId: string) => {
    if (!room) return;
    await RestChatRoomService.addMember(room.id, agentId);
    const updated = await RestChatRoomService.getMembers(room.id);
    setMembers(updated);
  }, [room]);

  const removeMember = useCallback(async (agentId: string) => {
    if (!room) return;
    await RestChatRoomService.removeMember(room.id, agentId);
    const updated = await RestChatRoomService.getMembers(room.id);
    setMembers(updated);
  }, [room]);

  const sendMessage = useCallback(async (content: string, mentionAgentId?: string): Promise<RouteDecision | null> => {
    if (!room) return null;

    // Optimistically add user message to UI
    const userMsg: RoomMessage = {
      id: `temp-user-${Date.now()}`,
      session_id: room.id,
      type: 'user',
      content,
      agent_id: null,
      mention_agent_id: mentionAgentId ?? null,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsSending(true);

    // Add placeholder AI message for streaming
    const aiMsgId = `temp-ai-${Date.now()}`;
    const aiMsg: RoomMessage = {
      id: aiMsgId,
      session_id: room.id,
      type: 'ai',
      content: '',
      agent_id: null,
      mention_agent_id: null,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, aiMsg]);

    let routeDecision: RouteDecision | null = null;

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/chat/rooms/${room.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, mention_agent_id: mentionAgentId }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      const allBlocks: ContentBlock[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lastDoubleNewline = buffer.lastIndexOf('\n\n');
        if (lastDoubleNewline === -1) continue;

        const complete = buffer.slice(0, lastDoubleNewline + 2);
        buffer = buffer.slice(lastDoubleNewline + 2);

        const frames = parseSSEFrames(complete);
        for (const frame of frames) {
          const data = frame.data.trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'route') {
              routeDecision = parsed as RouteDecision;
              // Update AI message placeholder with agent info
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, agent_id: parsed.targetAgentId } : m
              ));
            } else if (parsed.type === 'assistant' && Array.isArray(parsed.content)) {
              allBlocks.push(...parsed.content);
              // Extract text from accumulated blocks
              const text = allBlocks
                .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
                .map(b => b.text)
                .join('\n');
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: text } : m
              ));
            } else if (parsed.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: parsed.message || 'Error' } : m
              ));
            }
          } catch { /* skip non-JSON */ }
        }
      }

      // After stream ends, reload messages from backend to get persisted versions
      setTimeout(async () => {
        try {
          const msgs = await RestChatRoomService.getMessages(room.id, 50);
          setMessages(msgs);
        } catch { /* ignore */ }
      }, 500);

    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, content: err instanceof Error ? err.message : 'Failed to send' } : m
      ));
    } finally {
      setIsSending(false);
    }

    return routeDecision;
  }, [room]);

  const loadMoreMessages = useCallback(async () => {
    if (!room || messages.length === 0) return;
    const oldest = messages[0];
    const older = await RestChatRoomService.getMessages(room.id, 50, oldest.created_at);
    setMessages(prev => [...older, ...prev]);
  }, [room, messages]);

  const suggestAgent = useCallback(async (description: string) => {
    if (!room) return null;
    return RestChatRoomService.suggestAgent(room.id, description);
  }, [room]);

  const confirmCreateAgent = useCallback(async (agentDef: Parameters<typeof RestChatRoomService.confirmCreateAgent>[1]) => {
    if (!room) return;
    await RestChatRoomService.confirmCreateAgent(room.id, agentDef);
    const updated = await RestChatRoomService.getMembers(room.id);
    setMembers(updated);
  }, [room]);

  const refresh = useCallback(async () => {
    if (room) await loadRoom(room.id);
  }, [room, loadRoom]);

  return {
    room, members, messages, isLoading, error, isSending,
    createRoom, createRoomFromScope,
    addMember, removeMember,
    sendMessage, loadMoreMessages,
    suggestAgent, confirmCreateAgent,
    refresh,
  };
}
