/**
 * CustomEdge - Styled edge component for workflow connections
 */

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';

export const CustomEdge = memo(function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  animated,
  label,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Determine edge color based on data or selection
  const isSuccess = data?.status === 'success';
  const isError = data?.status === 'error';
  const isActive = data?.active || animated;

  const strokeColor = isError 
    ? 'rgba(239, 68, 68, 0.7)' // red
    : isSuccess 
      ? 'rgba(34, 197, 94, 0.7)' // green
      : selected 
        ? 'rgba(147, 197, 253, 0.8)' // blue
        : 'rgba(100, 116, 139, 0.5)'; // gray

  const strokeWidth = selected ? 2.5 : 2;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
        className={isActive ? 'animate-dash' : ''}
      />
      
      {/* Animated flow indicator */}
      {isActive && (
        <circle r="4" fill={strokeColor}>
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}

      {/* Edge label */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 shadow-lg"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Arrow marker */}
      <defs>
        <marker
          id={`arrow-${id}`}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          orient="auto"
        >
          <path
            d="M2,2 L10,6 L2,10 L4,6 Z"
            fill={strokeColor}
          />
        </marker>
      </defs>
    </>
  );
});
