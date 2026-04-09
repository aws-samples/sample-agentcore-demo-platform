/**
 * ConditionNode - Conditional branching node
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch, CheckCircle, XCircle } from 'lucide-react';
import type { CanvasNodeData, ActionStatus } from '@/types/canvas';
import type { ConditionNodeMeta } from '@/types/canvas/metadata';
import { NodeStatusIndicator } from '../NodeStatusIndicator';

type ConditionNodeData = CanvasNodeData<ConditionNodeMeta>;

export const ConditionNode = memo(function ConditionNode(props: NodeProps) {
  const { data, selected } = props;
  const nodeData = data as ConditionNodeData;
  const metadata = nodeData.metadata as ConditionNodeMeta | undefined;
  const rules = metadata?.rules ?? [];
  const logic = metadata?.logic ?? 'and';
  const result = metadata?.result;
  
  // Get execution status from hook (passed via Canvas)
  // executionStatus is injected by Canvas component from nodeExecutionStates
  const executionStatus = (data as Record<string, unknown>).executionStatus as ActionStatus | undefined;
  const executionProgress = (data as Record<string, unknown>).executionProgress as number | undefined;
  
  // Show execution status indicator if executing
  const showExecutionIndicator = executionStatus && executionStatus !== 'init';

  // Determine border color based on execution status
  const executionBorderColor = executionStatus 
    ? {
        executing: 'border-blue-500',
        finish: 'border-green-500',
        failed: 'border-red-500',
        init: 'border-yellow-500/50',
        waiting: 'border-yellow-500',
      }[executionStatus] || 'border-yellow-500/50'
    : 'border-yellow-500/50';

  return (
    <div
      className={`
        relative min-w-[200px] max-w-[280px] rounded-xl border-2
        backdrop-blur-sm shadow-lg transition-all duration-200
        bg-gray-800/95 ${executionBorderColor}
        ${selected ? 'ring-2 ring-white/30 shadow-xl scale-[1.02]' : 'hover:shadow-xl'}
        ${executionStatus === 'executing' ? 'animate-pulse' : ''}
      `}
    >
      {/* Target Handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-500 !border-2 !border-gray-700 hover:!bg-gray-400 transition-colors"
      />

      {/* Node Content */}
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg flex-shrink-0 bg-yellow-500/20">
            <GitBranch className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white truncate">
                {nodeData.title}
              </h3>
              {/* Show execution status indicator during execution */}
              {showExecutionIndicator ? (
                <NodeStatusIndicator 
                  status={executionStatus!} 
                  progress={executionProgress}
                />
              ) : (
                /* Show result indicator when not executing */
                result !== undefined && (
                  result 
                    ? <CheckCircle className="w-4 h-4 text-green-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />
                )
              )}
            </div>
            {nodeData.contentPreview && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                {nodeData.contentPreview}
              </p>
            )}
          </div>
        </div>

        {/* Rules */}
        {rules.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Conditions</span>
              <span className="px-1.5 py-0.5 bg-yellow-500/20 rounded text-yellow-300 text-[10px] uppercase">
                {logic}
              </span>
            </div>
            <div className="space-y-1">
              {rules.slice(0, 3).map((rule, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-1 text-xs bg-gray-900/50 rounded px-2 py-1"
                >
                  <span className="text-yellow-300 font-mono truncate">
                    {rule.field}
                  </span>
                  <span className="text-gray-500">
                    {rule.operator.replace('_', ' ')}
                  </span>
                  {rule.value !== undefined && (
                    <span className="text-gray-300 truncate">
                      {String(rule.value)}
                    </span>
                  )}
                </div>
              ))}
              {rules.length > 3 && (
                <div className="text-[10px] text-gray-500 px-2">
                  +{rules.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Source Handles (bottom - true/false branches) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-gray-700 hover:!bg-green-400 transition-colors"
        style={{ left: '35%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-gray-700 hover:!bg-red-400 transition-colors"
        style={{ left: '65%' }}
      />
      {/* Branch labels */}
      <div className="flex justify-around px-8 pb-0.5 pointer-events-none">
        <span className="text-[10px] text-green-400">Yes</span>
        <span className="text-[10px] text-red-400">No</span>
      </div>
    </div>
  );
});
