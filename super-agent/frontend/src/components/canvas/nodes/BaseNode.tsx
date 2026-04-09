/**
 * BaseNode - Foundation component for all canvas nodes
 */

import { memo, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { ActionStatus } from '@/types/canvas';
import { NodeStatusIndicator } from '../NodeStatusIndicator';

export interface BaseNodeProps {
  // From NodeProps
  id: string;
  selected?: boolean;
  // Our data type - accepts any object with required fields
  data: {
    title: string;
    entityId: string;
    contentPreview?: string;
    executionStatus?: ActionStatus;
    executionProgress?: number;
    [key: string]: unknown;
  };
  // Customization props
  icon?: ReactNode;
  iconBgColor?: string;
  borderColor?: string;
  bgColor?: string;
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;
  children?: ReactNode;
  statusIndicator?: ReactNode;
}

export const BaseNode = memo(function BaseNode({
  data,
  selected,
  icon,
  iconBgColor = 'bg-gray-500/20',
  borderColor = 'border-gray-500/50',
  bgColor = 'bg-gray-800/90',
  showSourceHandle = true,
  showTargetHandle = true,
  children,
  statusIndicator,
}: BaseNodeProps) {
  // Determine border color based on execution status
  const executionBorderColor = data.executionStatus 
    ? {
        executing: 'border-blue-500',
        finish: 'border-green-500',
        failed: 'border-red-500',
        init: borderColor,
        waiting: 'border-yellow-500',
      }[data.executionStatus] || borderColor
    : borderColor;

  // Show execution status indicator if executing
  const showExecutionIndicator = data.executionStatus && data.executionStatus !== 'init';

  return (
    <div
      className={`
        relative w-[360px] rounded-xl border-2
        backdrop-blur-sm shadow-lg transition-all duration-200
        ${bgColor} ${executionBorderColor}
        ${selected ? 'ring-2 ring-white/30 shadow-xl scale-[1.02]' : 'hover:shadow-xl'}
        ${data.executionStatus === 'executing' ? 'animate-pulse' : ''}
      `}
    >
      {/* Target Handle (top) */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-gray-500 !border-2 !border-gray-700 hover:!bg-gray-400 transition-colors"
        />
      )}

      {/* Node Content */}
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Icon */}
          {icon && (
            <div className={`p-2 rounded-lg flex-shrink-0 ${iconBgColor}`}>
              {icon}
            </div>
          )}

          {/* Title & Preview */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white truncate">
                {data.title}
              </h3>
              {showExecutionIndicator ? (
                <NodeStatusIndicator 
                  status={data.executionStatus!} 
                  progress={data.executionProgress}
                />
              ) : statusIndicator}
            </div>
            {data.contentPreview && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                {data.contentPreview}
              </p>
            )}
          </div>
        </div>

        {/* Custom content */}
        {children}
      </div>

      {/* Source Handle (bottom) */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-gray-500 !border-2 !border-gray-700 hover:!bg-gray-400 transition-colors"
        />
      )}
    </div>
  );
});
