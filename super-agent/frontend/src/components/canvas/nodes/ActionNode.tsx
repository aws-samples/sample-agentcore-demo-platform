/**
 * ActionNode - Generic action execution node
 */

import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Zap, Globe, Database, Bell, Wand2, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { CanvasNodeData, ActionStatus } from '@/types/canvas';
import type { ActionNodeMeta, ActionType } from '@/types/canvas/metadata';
import { BaseNode } from './BaseNode';

type ActionNodeData = CanvasNodeData<ActionNodeMeta>;

const actionTypeConfig: Record<ActionType, { icon: typeof Globe; label: string }> = {
  api_call: { icon: Globe, label: 'API Call' },
  database: { icon: Database, label: 'Database' },
  notification: { icon: Bell, label: 'Notification' },
  transform: { icon: Wand2, label: 'Transform' },
  custom: { icon: Zap, label: 'Custom' },
};

const statusConfig: Record<ActionStatus, { icon: typeof Loader2; color: string; animate?: boolean }> = {
  init: { icon: Clock, color: 'text-gray-400' },
  waiting: { icon: Clock, color: 'text-yellow-400' },
  executing: { icon: Loader2, color: 'text-orange-400', animate: true },
  finish: { icon: CheckCircle, color: 'text-green-400' },
  failed: { icon: XCircle, color: 'text-red-400' },
};

export const ActionNode = memo(function ActionNode(props: NodeProps) {
  const { id, selected } = props;
  const data = props.data as ActionNodeData;
  const metadata = data.metadata as ActionNodeMeta | undefined;
  const actionType = metadata?.actionType ?? 'custom';
  const executionStatus = (data as Record<string, unknown>).executionStatus as ActionStatus | undefined;
  const status = executionStatus ?? metadata?.status ?? 'init';
  
  const actionInfo = actionTypeConfig[actionType];
  const statusInfo = statusConfig[status];
  const ActionIcon = actionInfo.icon;
  const StatusIcon = statusInfo.icon;

  return (
    <BaseNode
      id={id}
      selected={selected}
      data={data}
      icon={<Zap className="w-5 h-5 text-orange-400" />}
      iconBgColor="bg-orange-500/20"
      borderColor="border-orange-500/50"
      bgColor="bg-gray-800/95"
      statusIndicator={
        <StatusIcon 
          className={`w-4 h-4 ${statusInfo.color} ${statusInfo.animate ? 'animate-spin' : ''}`} 
        />
      }
    >
      <div className="mt-3 space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-orange-500/10">
          <ActionIcon className="w-3 h-3 text-orange-400" />
          <span className="text-orange-300">{actionInfo.label}</span>
        </div>

        {metadata?.config && Object.keys(metadata.config).length > 0 && (
          <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700/50">
            <div className="space-y-1">
              {Object.entries(metadata.config).slice(0, 3).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="text-gray-500">{key}:</span>
                  <span className="text-gray-300 truncate">
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                  </span>
                </div>
              ))}
              {Object.keys(metadata.config).length > 3 && (
                <div className="text-[10px] text-gray-500">
                  +{Object.keys(metadata.config).length - 3} more
                </div>
              )}
            </div>
          </div>
        )}

        {status === 'failed' && metadata?.error && (
          <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
            <p className="text-xs text-red-300 line-clamp-2">
              {metadata.error}
            </p>
          </div>
        )}
      </div>
    </BaseNode>
  );
});
