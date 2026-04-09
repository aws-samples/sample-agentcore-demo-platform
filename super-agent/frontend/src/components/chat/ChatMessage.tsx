/**
 * ChatMessage Component
 *
 * Renders an array of content blocks for a single assistant turn.
 * Delegates to the appropriate content block component based on type.
 *
 * Requirements: 9.1, 9.2, 9.3
 *
 * @module components/chat/ChatMessage
 */

import { Bot } from 'lucide-react';
import { useState } from 'react';
import type { ContentBlock } from '@/services/chatStreamService';
import { TextContentBlock } from './TextContentBlock';
import { ToolUseBlock } from './ToolUseBlock';
import { ToolResultBlock } from './ToolResultBlock';

interface ChatMessageProps {
  /** Array of content blocks for this assistant turn. */
  content: ContentBlock[];
  /** Optional model name to display. */
  model?: string;
  /** Whether this message is currently being streamed. */
  isStreaming?: boolean;
  /** Sub-agent speaker name — shown instead of default avatar when set. */
  speakerAgentName?: string;
  /** Sub-agent speaker avatar URL — shown instead of default icon when set. */
  speakerAgentAvatar?: string | null;
}

/**
 * Renders a single content block by delegating to the appropriate component.
 */
function renderContentBlock(block: ContentBlock, index: number, isStreaming: boolean, isLastToolUse: boolean): React.ReactNode {
  switch (block.type) {
    case 'text':
      return <TextContentBlock key={`text-${index}`} block={block} />;
    case 'tool_use':
      return <ToolUseBlock key={`tool-use-${block.id}`} block={block} isStreaming={isStreaming && isLastToolUse} />;
    case 'tool_result':
      return <ToolResultBlock key={`tool-result-${block.tool_use_id}`} block={block} />;
    default:
      return null;
  }
}

/**
 * Renders a complete assistant message with an avatar and all content blocks.
 */
export function ChatMessage({ content, model, isStreaming = false, speakerAgentName, speakerAgentAvatar }: ChatMessageProps) {
  const [avatarError, setAvatarError] = useState(false);

  if (content.length === 0) {
    return null;
  }

  // Find the last tool_use block index (to show streaming indicator only on the latest one)
  let lastToolUseIdx = -1;
  for (let i = content.length - 1; i >= 0; i--) {
    if (content[i].type === 'tool_use') {
      lastToolUseIdx = i;
      break;
    }
  }
  // Only mark the last tool_use as streaming if there's no tool_result after it
  const hasResultAfterLastTool = lastToolUseIdx >= 0 && content.slice(lastToolUseIdx + 1).some(b => b.type === 'tool_result');

  const showImage = speakerAgentAvatar && !avatarError;

  return (
    <div className="flex gap-3" data-testid="chat-message">
      {/* Avatar */}
      {showImage ? (
        <img
          src={speakerAgentAvatar}
          alt={speakerAgentName ?? 'Agent'}
          className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
          onError={() => setAvatarError(true)}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none">
          {speakerAgentName ? speakerAgentName.charAt(0).toUpperCase() : <Bot className="w-4 h-4 text-white" />}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {speakerAgentName && (
          <span className="text-xs font-medium text-purple-400">{speakerAgentName}</span>
        )}
        {model && !speakerAgentName && (
          <span className="text-xs text-gray-500 font-mono">{model}</span>
        )}
        {content.map((block, idx) =>
          renderContentBlock(block, idx, isStreaming, idx === lastToolUseIdx && !hasResultAfterLastTool)
        )}
      </div>
    </div>
  );
}
