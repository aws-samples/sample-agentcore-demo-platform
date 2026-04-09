/**
 * ToolUseBlock Component
 *
 * Displays a tool invocation with the tool name and a collapsible view
 * of the tool input JSON.
 *
 * Requirements: 9.2
 *
 * @module components/chat/ToolUseBlock
 */

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Terminal, Loader2 } from 'lucide-react';
import type { ToolUseContentBlock } from '@/services/chatStreamService';

interface ToolUseBlockProps {
  block: ToolUseContentBlock;
  /** When true, the block auto-expands and shows a spinner (streaming state). */
  isStreaming?: boolean;
}

/** Maps tool names to human-readable status descriptions. */
function getToolDescription(toolName: string): string {
  const lower = toolName.toLowerCase()
  if (lower.includes('read') || lower.includes('view')) return 'Reading file...'
  if (lower.includes('write') || lower.includes('create') || lower.includes('save')) return 'Writing file...'
  if (lower.includes('search') || lower.includes('grep') || lower.includes('find')) return 'Searching...'
  if (lower.includes('bash') || lower.includes('exec') || lower.includes('run')) return 'Running command...'
  if (lower.includes('list') || lower.includes('ls')) return 'Listing files...'
  if (lower.includes('edit') || lower.includes('replace')) return 'Editing file...'
  if (lower.includes('web') || lower.includes('fetch') || lower.includes('http')) return 'Fetching from web...'
  return `Using ${toolName}...`
}

/**
 * Renders a tool_use content block with the tool name prominently displayed
 * and a collapsible section showing the tool input as formatted JSON.
 */
export function ToolUseBlock({ block, isStreaming = false }: ToolUseBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand while streaming
  useEffect(() => {
    if (isStreaming) setIsExpanded(true)
  }, [isStreaming])

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  return (
    <div
      className="border border-gray-700 rounded-lg my-1 bg-gray-800/50 overflow-hidden"
      data-testid="tool-use-block"
    >
      <button
        type="button"
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-700/50 rounded-lg transition-colors"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={`tool-input-${block.id}`}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
        <Terminal className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span className="text-sm font-medium text-blue-400">{block.name}</span>
        {isStreaming && (
          <span className="flex items-center gap-1.5 ml-auto">
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            <span className="text-xs text-gray-400">{getToolDescription(block.name)}</span>
          </span>
        )}
      </button>

      {isExpanded && (
        <div
          id={`tool-input-${block.id}`}
          role="region"
          aria-label={`Input for ${block.name}`}
          className="px-3 pb-3"
        >
          <pre className="bg-gray-900 border border-gray-700 rounded-md p-2 overflow-x-auto max-w-full">
            <code className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(block.input, null, 2)}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}
