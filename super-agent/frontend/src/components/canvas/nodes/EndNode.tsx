/**
 * EndNode - Workflow termination point
 */

import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Square, CheckCircle, XCircle } from 'lucide-react';
import type { CanvasNodeData, ActionStatus } from '@/types/canvas';
import type { EndNodeMeta } from '@/types/canvas/metadata';
import { BaseNode } from './BaseNode';
import { NodeStatusIndicator } from '../NodeStatusIndicator';

type EndNodeData = CanvasNodeData<EndNodeMeta>;

export const EndNode = memo(function EndNode(props: NodeProps) {
  const { id, selected } = props;
  const data = props.data as EndNodeData;
  const metadata = data.metadata as EndNodeMeta | undefined;
  const endStatus = metadata?.status ?? 'success';
  
  // Get execution status from hook (passed via Canvas)
  // executionStatus is injected by Canvas component from nodeExecutionStates
  const executionStatus = (data as Record<string, unknown>).executionStatus as ActionStatus | undefined;
  const executionProgress = (data as Record<string, unknown>).executionProgress as number | undefined;
  
  // Show execution status indicator if executing
  const showExecutionIndicator = executionStatus && executionStatus !== 'init';

  const isSuccess = endStatus === 'success';

  return (
    <BaseNode
      id={id}
      selected={selected}
      data={data}
      icon={<Square className="w-5 h-5 text-gray-400" />}
      iconBgColor="bg-gray-500/20"
      borderColor={isSuccess ? 'border-gray-500/50' : 'border-red-500/50'}
      bgColor="bg-gray-800/95"
      showSourceHandle={false}
      statusIndicator={
        showExecutionIndicator ? (
          <NodeStatusIndicator 
            status={executionStatus!} 
            progress={executionProgress}
          />
        ) : (
          isSuccess 
            ? <CheckCircle className="w-4 h-4 text-green-400" />
            : <XCircle className="w-4 h-4 text-red-400" />
        )
      }
    >
      {/* Output Mapping */}
      {metadata?.outputMapping && Object.keys(metadata.outputMapping).length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-xs text-gray-400">Output Mapping</div>
          <div className="space-y-1">
            {Object.entries(metadata.outputMapping).slice(0, 3).map(([key, value]) => (
              <div 
                key={key}
                className="flex items-center gap-2 text-xs bg-gray-900/50 rounded px-2 py-1"
              >
                <span className="text-gray-300">{key}</span>
                <span className="text-gray-600">→</span>
                <span className="text-gray-400 truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </BaseNode>
  );
});
