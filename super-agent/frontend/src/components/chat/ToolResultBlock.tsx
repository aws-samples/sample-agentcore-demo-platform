/**
 * ToolResultBlock Component
 *
 * Displays tool output in a collapsible section. Shows error styling
 * when `is_error` is true.
 *
 * Requirements: 9.3
 *
 * @module components/chat/ToolResultBlock
 */

import { useState } from 'react';
import { ChevronRight, ChevronDown, CheckCircle, XCircle } from 'lucide-react';
import type { ToolResultContentBlock } from '@/services/chatStreamService';

interface ToolResultBlockProps {
  block: ToolResultContentBlock;
}

/**
 * Renders a tool_result content block with a collapsible output section.
 * Error results are styled with red accents and an error icon.
 * Success results use green accents and a check icon.
 */
export function ToolResultBlock({ block }: ToolResultBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  const hasContent = block.content !== null && block.content !== '';

  const borderColor = block.is_error ? 'border-red-700/50' : 'border-green-700/50';
  const bgColor = block.is_error ? 'bg-red-900/10' : 'bg-green-900/10';
  const iconColor = block.is_error ? 'text-red-400' : 'text-green-400';
  const labelColor = block.is_error ? 'text-red-400' : 'text-green-400';

  return (
    <div
      className={`border ${borderColor} rounded-lg my-1 ${bgColor} overflow-hidden`}
      data-testid="tool-result-block"
      data-error={block.is_error}
    >
      <button
        type="button"
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-700/30 rounded-lg transition-colors"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls={`tool-result-${block.tool_use_id}`}
        disabled={!hasContent}
      >
        {hasContent ? (
          isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}
        {block.is_error ? (
          <XCircle className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
        ) : (
          <CheckCircle className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
        )}
        <span className={`text-sm font-medium ${labelColor}`}>
          {block.is_error ? 'Error' : 'Result'}
        </span>
        {!hasContent && (
          <span className="text-xs text-gray-500 ml-1">(no output)</span>
        )}
      </button>

      {isExpanded && hasContent && (
        <div
          id={`tool-result-${block.tool_use_id}`}
          role="region"
          aria-label={block.is_error ? 'Tool error output' : 'Tool result output'}
          className="px-3 pb-3"
        >
          <pre
            className={`${
              block.is_error ? 'bg-red-950/30 border-red-800/50' : 'bg-gray-900 border-gray-700'
            } border rounded-md p-2 overflow-x-auto`}
          >
            <code className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">
              {block.content}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}
