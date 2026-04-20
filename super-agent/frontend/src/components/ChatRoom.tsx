/**
 * ChatRoom Component
 * Group chat interface with multiple agents, @mention routing, and shared context.
 *
 * All agents are equal — no "primary" concept. Routing is handled by:
 * 1. Explicit @mention (user clicks badge or types @name)
 * 2. Context continuation (same agent continues conversation)
 * 3. AI semantic routing (picks best match by role)
 * 4. Low-confidence fallback → inline picker asks user to choose
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Users, Plus, Send, Bot, User, X, HelpCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatRoom } from '@/services/useChatRoom';
import type { RoomMember, RoomMessage, RouteDecision } from '@/services/api/restChatRoomService';
import { useTranslation } from '@/i18n';

const CONFIDENCE_THRESHOLD = 0.5;

interface ChatRoomProps {
  roomId: string;
}

export function ChatRoom({ roomId }: ChatRoomProps) {
  const {
    room, members, messages, isLoading, error, isSending,
    sendMessage, removeMember, suggestAgent, confirmCreateAgent,
  } = useChatRoom({ roomId, pollInterval: 3000 });
  const { t } = useTranslation();

  const [input, setInput] = useState('');
  const [mentionAgentId, setMentionAgentId] = useState<string | null>(null);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [showAgentCreator, setShowAgentCreator] = useState(false);
  const [agentDescription, setAgentDescription] = useState('');
  const [suggestedAgent, setSuggestedAgent] = useState<Record<string, unknown> | null>(null);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  // When routing is uncertain, show inline picker
  const [uncertainRoute, setUncertainRoute] = useState<RouteDecision | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending) return;
    setUncertainRoute(null);
    try {
      const route = await sendMessage(input, mentionAgentId ?? undefined);
      const sentText = input;
      setInput('');
      setMentionAgentId(null);

      if (route && route.confidence < CONFIDENCE_THRESHOLD) {
        setUncertainRoute(route);
        setPendingMessage(sentText);
      } else if (route?.targetAgentId) {
        setActiveAgentId(route.targetAgentId);
        // Clear highlight after a delay
        setTimeout(() => setActiveAgentId(null), 3000);
      }
    } catch {
      // errors handled by hook
    }
  }, [input, mentionAgentId, isSending, sendMessage]);

  /** User picked an agent from the uncertain-route picker */
  const handlePickAgent = useCallback(async (agentId: string) => {
    if (!pendingMessage) return;
    setUncertainRoute(null);
    setPendingMessage(null);
    setActiveAgentId(agentId);
    try {
      await sendMessage(pendingMessage, agentId);
    } finally {
      setTimeout(() => setActiveAgentId(null), 3000);
    }
  }, [pendingMessage, sendMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    setShowMentionPicker(val.endsWith('@'));
  };

  const handleMentionSelect = (member: RoomMember) => {
    setMentionAgentId(member.agent_id);
    setInput(prev => prev.replace(/@$/, `@${member.agent.display_name} `));
    setShowMentionPicker(false);
  };

  const handleSuggestAgent = async () => {
    if (!agentDescription.trim()) return;
    const result = await suggestAgent(agentDescription);
    if (result) setSuggestedAgent(result.suggested_agent as unknown as Record<string, unknown>);
  };

  const handleConfirmAgent = async () => {
    if (!suggestedAgent) return;
    await confirmCreateAgent({
      name: suggestedAgent.name as string,
      display_name: suggestedAgent.display_name as string,
      role: suggestedAgent.role as string,
      system_prompt: suggestedAgent.system_prompt as string,
    });
    setSuggestedAgent(null);
    setShowAgentCreator(false);
    setAgentDescription('');
  };

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return 'AI';
    return members.find(m => m.agent_id === agentId)?.agent.display_name ?? 'AI';
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-gray-400">{t('chatRoom.loading')}</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <p className="text-red-400 mb-2">{t('chatRoom.loadFailed')}</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">{room?.title ?? t('chatRoom.groupChat')}</h2>
        <button
          onClick={() => setShowMemberPanel(!showMemberPanel)}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
        >
          <Users size={14} />
          <span>{t('chatRoom.members').replace('{n}', String(members.length))}</span>
        </button>
      </div>

      {/* Member bar — all agents equal, click to @mention */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/50 overflow-x-auto">
        {members.map(m => {
          const isActive = m.agent_id === activeAgentId;
          const isMentioned = m.agent_id === mentionAgentId;
          return (
            <button
              key={m.agent_id}
              onClick={() => setMentionAgentId(isMentioned ? null : m.agent_id)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs flex-shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-green-600/20 text-green-300 border border-green-500/40 animate-pulse'
                  : isMentioned
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 ring-1 ring-blue-400/50'
                    : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
              }`}
              title={isActive ? `${m.agent.display_name} is responding...` : `Click to @mention ${m.agent.display_name}`}
            >
              <Bot size={10} />
              {m.agent.display_name}
            </button>
          );
        })}
        <button
          onClick={() => setShowAgentCreator(true)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700 border-dashed transition-colors flex-shrink-0"
          title="Add agent to room"
        >
          <Plus size={10} />
          {t('chatRoom.add')}
        </button>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              {t('chatRoom.empty')}
            </div>
          )}
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} agentName={getAgentName(msg.agent_id)} />
          ))}

          {/* Uncertain route picker — inline in message area */}
          {uncertainRoute && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs bg-yellow-600/15 border border-yellow-500/25 text-yellow-400">
                <HelpCircle size={14} />
              </div>
              <div className="max-w-[80%]">
                <div className="text-xs text-gray-400 mb-1">{t('chatRoom.uncertainPick')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {members.map(m => (
                    <button
                      key={m.agent_id}
                      onClick={() => handlePickAgent(m.agent_id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-200 border border-gray-700 hover:bg-gray-700 hover:border-blue-500/50 transition-colors"
                    >
                      <Bot size={10} />
                      {m.agent.display_name}
                      {m.agent.role && <span className="text-gray-500 ml-1">· {m.agent.role}</span>}
                    </button>
                  ))}
                  <button
                    onClick={() => { setUncertainRoute(null); setPendingMessage(null); }}
                    className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {t('chatRoom.dismiss')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Member panel (slide-out) */}
        {showMemberPanel && (
          <div className="w-64 border-l border-gray-800 bg-gray-900 flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
              <span className="text-xs font-medium text-gray-300">{t('chatRoom.membersPanel')} ({members.length})</span>
              <button onClick={() => setShowMemberPanel(false)} className="text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {members.map(m => (
                <div key={m.agent_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-800 group">
                  <Bot size={14} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate">{m.agent.display_name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{m.agent.role}</div>
                  </div>
                  <button
                    onClick={() => removeMember(m.agent_id)}
                    className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t('chatRoom.remove')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mention picker */}
      {showMentionPicker && members.length > 0 && (
        <div className="mx-4 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {members.map(m => (
            <button
              key={m.agent_id}
              onClick={() => handleMentionSelect(m)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-700 transition-colors"
            >
              <Bot size={14} className="text-gray-400" />
              <span className="text-sm text-white">{m.agent.display_name}</span>
              <span className="text-xs text-gray-500 ml-auto">{m.agent.role}</span>
            </button>
          ))}
        </div>
      )}

      {/* Inline agent creator */}
      {showAgentCreator && (
        <div className="mx-4 mb-2 bg-gray-800 border border-gray-700 rounded-lg p-3">
          {!suggestedAgent ? (
            <div className="flex items-center gap-2">
              <input
                value={agentDescription}
                onChange={e => setAgentDescription(e.target.value)}
                placeholder={t('chatRoom.agentPlaceholder')}
                className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleSuggestAgent()}
              />
              <button onClick={handleSuggestAgent} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors">
                {t('chatRoom.generate')}
              </button>
              <button onClick={() => setShowAgentCreator(false)} className="px-2 py-1.5 text-gray-400 hover:text-white text-xs transition-colors">
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Bot size={14} className="text-blue-400" />
                <span className="text-sm font-medium text-white">{suggestedAgent.display_name as string}</span>
                <span className="text-xs text-gray-400">{suggestedAgent.role as string}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleConfirmAgent} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors">
                  {t('chatRoom.confirmAdd')}
                </button>
                <button onClick={() => setSuggestedAgent(null)} className="px-2 py-1.5 text-gray-400 hover:text-white text-xs transition-colors">
                  {t('chatRoom.adjust')}
                </button>
                <button onClick={() => { setSuggestedAgent(null); setShowAgentCreator(false); }} className="px-2 py-1.5 text-gray-400 hover:text-white text-xs transition-colors">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-800">
        <button
          onClick={() => setShowMentionPicker(!showMentionPicker)}
          className="px-2 py-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded text-sm font-medium transition-colors"
          title="@mention an agent"
        >
          @
        </button>
        {mentionAgentId && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
            @{getAgentName(mentionAgentId)}
            <button onClick={() => setMentionAgentId(null)} className="hover:text-white">
              <X size={10} />
            </button>
          </span>
        )}
        <input
          value={input}
          onChange={handleInputChange}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={t('chatRoom.placeholder')}
          disabled={isSending}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Message Bubble
// ============================================================================

function MessageBubble({ message, agentName }: { message: RoomMessage; agentName: string }) {
  if (message.type === 'system') {
    try {
      const data = JSON.parse(message.content);
      const text = data.event === 'member_joined' ? `${data.agent_name} joined the room`
        : data.event === 'agent_created' ? `${data.agent_name} was created and added`
        : data.event === 'member_left' ? `${data.agent_name} left the room`
        : message.content;
      return <div className="text-center text-xs text-gray-500 py-1">{text}</div>;
    } catch {
      return <div className="text-center text-xs text-gray-500 py-1">{message.content}</div>;
    }
  }

  const isUser = message.type === 'user';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
        isUser ? 'bg-blue-600/15 border border-blue-500/25 text-blue-400' : 'bg-purple-600/15 border border-purple-500/25 text-purple-400'
      }`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`max-w-[70%] ${isUser ? 'text-right' : ''}`}>
        {!isUser && <div className="text-xs text-gray-400 mb-0.5">{agentName}</div>}
        <div className={`inline-block px-3 py-2 rounded-lg text-sm ${
          isUser
            ? 'bg-blue-600/15 border border-blue-500/20 text-white'
            : 'bg-gray-800 text-gray-200 border border-gray-700'
        }`}>
          {isUser ? (
            message.content
          ) : (
            <div className="prose prose-invert prose-sm max-w-none
              [&_p]:mb-1.5 [&_p:last-child]:mb-0
              [&_ul]:pl-4 [&_ul]:mb-1.5 [&_ol]:pl-4 [&_ol]:mb-1.5
              [&_li]:text-gray-200
              [&_strong]:text-white [&_strong]:font-semibold
              [&_em]:text-gray-300
              [&_code]:bg-gray-700 [&_code]:text-gray-200 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
              [&_pre]:bg-gray-900 [&_pre]:border [&_pre]:border-gray-700 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:my-1.5 [&_pre]:overflow-x-auto
              [&_a]:text-blue-400 [&_a]:underline
              [&_blockquote]:border-l-2 [&_blockquote]:border-gray-600 [&_blockquote]:pl-3 [&_blockquote]:text-gray-400
              [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-2 [&_h1]:mb-1
              [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-2 [&_h2]:mb-1
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-1.5 [&_h3]:mb-0.5
            ">
              <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
            </div>
          )}
        </div>
        <div className="text-[10px] text-gray-600 mt-0.5">
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
