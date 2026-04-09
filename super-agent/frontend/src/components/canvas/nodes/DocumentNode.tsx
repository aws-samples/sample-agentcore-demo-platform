/**
 * DocumentNode - Rich text document output
 */

import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { FileText, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { CanvasNodeData, ActionStatus } from '@/types/canvas';
import type { DocumentNodeMeta } from '@/types/canvas/metadata';
import { BaseNode } from './BaseNode';

type DocumentNodeData = CanvasNodeData<DocumentNodeMeta>;

const statusConfig: Record<ActionStatus, { 
  icon: typeof Loader2; 
  color: string;
  animate?: boolean;
}> = {
  init: { icon: Clock, color: 'text-gray-400' },
  waiting: { icon: Clock, color: 'text-yellow-400' },
  executing: { icon: Loader2, color: 'text-cyan-400', animate: true },
  finish: { icon: CheckCircle, color: 'text-green-400' },
  failed: { icon: XCircle, color: 'text-red-400' },
};

export const DocumentNode = memo(function DocumentNode(props: NodeProps) {
  const { id, selected } = props;
  const data = props.data as DocumentNodeData;
  const metadata = data.metadata as DocumentNodeMeta | undefined;
  // Prioritize execution status from hook over metadata status
  // executionStatus is injected by Canvas component from nodeExecutionStates
  const executionStatus = (data as Record<string, unknown>).executionStatus as ActionStatus | undefined;
  const status = executionStatus ?? metadata?.status ?? 'finish';
  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;

  return (
    <BaseNode
      id={id}
      selected={selected}
      data={data}
      icon={<FileText className="w-5 h-5 text-cyan-400" />}
      iconBgColor="bg-cyan-500/20"
      borderColor="border-cyan-500/50"
      bgColor="bg-gray-800/95"
      statusIndicator={
        <StatusIcon 
          className={`w-4 h-4 ${statusInfo.color} ${statusInfo.animate ? 'animate-spin' : ''}`} 
        />
      }
    >
      {/* Document Preview */}
      {data.contentPreview && (
        <div className="mt-3">
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 max-h-32 overflow-hidden">
            <p className="text-xs text-gray-300 whitespace-pre-wrap line-clamp-6">
              {data.contentPreview}
            </p>
          </div>
        </div>
      )}

      {/* Share indicator */}
      {metadata?.shareId && (
        <div className="mt-2 text-[10px] text-cyan-400">
          Shared
        </div>
      )}
    </BaseNode>
  );
});
