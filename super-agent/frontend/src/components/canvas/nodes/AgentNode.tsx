/**
 * AgentNode - Represents an AI agent in the workflow
 */

import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Bot, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { CanvasNodeData, ActionStatus } from '@/types/canvas';
import type { AgentNodeMeta } from '@/types/canvas/metadata';
import { BaseNode } from './BaseNode';

type AgentNodeData = CanvasNodeData<AgentNodeMeta>;

const statusConfig: Record<ActionStatus, { 
  icon: typeof Loader2; 
  color: string;
  animate?: boolean;
}> = {
  init: { icon: Clock, color: 'text-gray-400' },
  waiting: { icon: Clock, color: 'text-yellow-400' },
  executing: { icon: Loader2, color: 'text-blue-400', animate: true },
  finish: { icon: CheckCircle, color: 'text-green-400' },
  failed: { icon: XCircle, color: 'text-red-400' },
};

export const AgentNode = memo(function AgentNode(props: NodeProps) {
  const { id, selected } = props;
  const data = props.data as AgentNodeData;
  const metadata = data.metadata as AgentNodeMeta | undefined;
  // Prioritize execution status from hook over metadata status
  // executionStatus is injected by Canvas component from nodeExecutionStates
  const executionStatus = (data as Record<string, unknown>).executionStatus as ActionStatus | undefined;
  const status = executionStatus ?? metadata?.status ?? 'init';
  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;

  // Get agent info from metadata
  const agentName = metadata?.agent?.name;
  const agentRole = metadata?.agent?.role;
  const query = metadata?.query;

  return (
    <BaseNode
      id={id}
      selected={selected}
      data={data}
      icon={<Bot className="w-5 h-5 text-blue-400" />}
      iconBgColor="bg-blue-500/20"
      borderColor="border-blue-500/50"
      bgColor="bg-gray-800/95"
      statusIndicator={
        <StatusIcon 
          className={`w-4 h-4 ${statusInfo.color} ${statusInfo.animate ? 'animate-spin' : ''}`} 
        />
      }
    >
      {/* Agent Details */}
      <div className="mt-3 space-y-2">
        {/* Agent Info */}
        {(agentName || agentRole) && (
          <div className="flex items-center gap-2 text-xs">
            {metadata?.agent?.avatar && (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-semibold overflow-hidden">
                {metadata.agent.avatar.startsWith('http') ? (
                  <img 
                    src={metadata.agent.avatar} 
                    alt={agentName} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  agentName?.charAt(0).toUpperCase()
                )}
              </div>
            )}
            <div className="min-w-0">
              {agentName && (
                <span className="text-blue-300 font-medium truncate block">
                  {agentName}
                </span>
              )}
              {agentRole && (
                <span className="text-gray-500 truncate block">
                  {agentRole}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Query Preview */}
        {query && (
          <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700/50">
            <p className="text-xs text-gray-300 line-clamp-2">
              {query}
            </p>
          </div>
        )}

        {/* Model Info */}
        {metadata?.modelConfig && (
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="px-1.5 py-0.5 bg-gray-700/50 rounded">
              {metadata.modelConfig.provider}
            </span>
            <span className="truncate">
              {metadata.modelConfig.modelId}
            </span>
          </div>
        )}

        {/* Token Usage */}
        {metadata?.tokenUsage && metadata.tokenUsage.length > 0 && (
          <div className="text-[10px] text-gray-500">
            {metadata.tokenUsage.reduce((sum, t) => sum + t.inputTokens + t.outputTokens, 0).toLocaleString()} tokens
          </div>
        )}
      </div>
    </BaseNode>
  );
});
