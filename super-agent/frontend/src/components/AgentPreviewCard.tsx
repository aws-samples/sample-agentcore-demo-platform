/**
 * AgentPreviewCard Component
 * 
 * Displays a preview of a generated agent with expansion capability
 * and removal functionality. Shows agent name, role, avatar, description,
 * and when expanded, system prompt and tools.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.5.1, 5.5.2, 5.5.3
 */

import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  X, 
  RotateCcw,
  Wrench,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { GeneratedAgent } from '@/services/roleGeneratorService';
import { getAvatarDisplayUrl, getAvatarFallback, shouldShowAvatarImage } from '@/utils/avatarUtils';

// ============================================================================
// Types
// ============================================================================

export interface AgentPreviewCardProps {
  /** The generated agent to display */
  agent: GeneratedAgent;
  /** Whether this agent is marked for removal */
  isRemoved: boolean;
  /** Whether this is the last remaining agent (cannot be removed) */
  isLastAgent: boolean;
  /** Callback when removal is toggled */
  onToggleRemoval: (agentId: string) => void;
  /** Callback when card is expanded */
  onExpand?: (agentId: string) => void;
  /** Whether the card is currently expanded */
  isExpanded?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export const AgentPreviewCard: React.FC<AgentPreviewCardProps> = ({
  agent,
  isRemoved,
  isLastAgent,
  onToggleRemoval,
  onExpand,
  isExpanded: controlledExpanded,
}) => {
  const { t } = useTranslation();
  // Use internal state if not controlled
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded ?? internalExpanded;

  const avatarUrl = getAvatarDisplayUrl(agent.avatar)
  const avatarFallback = getAvatarFallback(agent.role, agent.avatar)
  const showImage = shouldShowAvatarImage(agent.avatar)

  const handleToggleExpand = () => {
    if (onExpand) {
      onExpand(agent.id);
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  const handleToggleRemoval = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleRemoval(agent.id);
  };

  const canRemove = !isLastAgent || isRemoved;

  return (
    <div 
      className={`
        relative rounded-xl border transition-all duration-300
        ${isRemoved 
          ? 'bg-gray-800/30 border-gray-700/50 opacity-60' 
          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
        }
      `}
    >
      {/* Removed Badge Overlay */}
      {isRemoved && (
        <div className="absolute top-2 right-2 z-10">
          <span className="px-2 py-1 text-xs font-medium bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
            {t('agentPreview.removed')}
          </span>
        </div>
      )}

      {/* Main Card Content */}
      <div 
        className="p-4 cursor-pointer"
        onClick={handleToggleExpand}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div 
            className={`
              w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold flex-shrink-0 overflow-hidden
              ${isRemoved 
                ? 'bg-gray-700 text-gray-500' 
                : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
              }
            `}
          >
            {showImage && avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={agent.role}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.parentElement!.textContent = avatarFallback
                }}
              />
            ) : (
              avatarFallback
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 
                className={`
                  font-medium truncate
                  ${isRemoved ? 'text-gray-500 line-through' : 'text-white'}
                `}
              >
                {agent.role}
              </h4>
            </div>
            <p className={`text-sm mt-0.5 ${isRemoved ? 'text-gray-600' : 'text-gray-400'}`}>
              {agent.roleId}
            </p>
            <p 
              className={`
                text-sm mt-2 line-clamp-2
                ${isRemoved ? 'text-gray-600' : 'text-gray-300'}
              `}
            >
              {agent.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Remove/Restore Button */}
            <div className="relative group">
              <button
                onClick={handleToggleRemoval}
                disabled={!canRemove}
                className={`
                  p-2 rounded-lg transition-all
                  ${isRemoved
                    ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    : canRemove
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'bg-gray-700/50 text-gray-600 cursor-not-allowed'
                  }
                `}
                title={
                  isRemoved 
                    ? t('agentPreview.restore')
                    : canRemove 
                      ? t('agentPreview.remove')
                      : t('agentPreview.keepOne')
                }
              >
                {isRemoved ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
              
              {/* Tooltip for disabled state */}
              {!canRemove && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-xs text-gray-300 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-yellow-400" />
                    {t('agentPreview.keepOne')}
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              )}
            </div>

            {/* Expand/Collapse Button */}
            <button
              onClick={handleToggleExpand}
              className="p-2 rounded-lg bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white transition-all"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div 
          className={`
            border-t px-4 pb-4 pt-3 space-y-4
            ${isRemoved ? 'border-gray-700/50' : 'border-gray-700'}
          `}
        >
          {/* Responsibilities */}
          <div>
            <h5 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isRemoved ? 'text-gray-500' : 'text-gray-300'}`}>
              <MessageSquare className="h-4 w-4" />
              {t('agentPreview.responsibilities')}
            </h5>
            <ul className={`text-sm space-y-1 ${isRemoved ? 'text-gray-600' : 'text-gray-400'}`}>
              {agent.responsibilities.map((resp, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  {resp}
                </li>
              ))}
            </ul>
          </div>

          {/* System Prompt Summary */}
          <div>
            <h5 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isRemoved ? 'text-gray-500' : 'text-gray-300'}`}>
              <MessageSquare className="h-4 w-4" />
              {t('agentPreview.systemPrompt')}
            </h5>
            <p 
              className={`
                text-sm p-3 rounded-lg
                ${isRemoved 
                  ? 'bg-gray-800/30 text-gray-600' 
                  : 'bg-gray-900/50 text-gray-400'
                }
              `}
            >
              {agent.systemPromptSummary}
            </p>
          </div>

          {/* Tools */}
          <div>
            <h5 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isRemoved ? 'text-gray-500' : 'text-gray-300'}`}>
              <Wrench className="h-4 w-4" />
              {t('agentPreview.suggestedTools')}
            </h5>
            <div className="flex flex-wrap gap-2">
              {agent.tools.map((tool, index) => (
                <span 
                  key={index}
                  className={`
                    px-2 py-1 text-xs rounded-full cursor-help
                    ${isRemoved 
                      ? 'bg-gray-800/30 text-gray-600' 
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                    }
                  `}
                  title={tool.description || tool.skillMd?.substring(0, 100)}
                >
                  {tool.displayName || tool.name}
                </span>
              ))}
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <h5 className={`text-sm font-medium mb-2 ${isRemoved ? 'text-gray-500' : 'text-gray-300'}`}>
              {t('agentPreview.capabilities')}
            </h5>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((cap, index) => (
                <span 
                  key={index}
                  className={`
                    px-2 py-1 text-xs rounded-full
                    ${isRemoved 
                      ? 'bg-gray-800/30 text-gray-600' 
                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                    }
                  `}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentPreviewCard;
