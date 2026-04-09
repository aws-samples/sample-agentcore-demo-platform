/**
 * NodeStatusIndicator - Shows execution status on canvas nodes
 */

import { memo } from 'react';
import { Loader2, CheckCircle, XCircle, Clock, Circle } from 'lucide-react';
import type { ActionStatus } from '@/types/canvas';

interface NodeStatusIndicatorProps {
  status: ActionStatus;
  progress?: number;
  size?: 'sm' | 'md';
}

export const NodeStatusIndicator = memo(function NodeStatusIndicator({
  status,
  progress = 0,
  size = 'sm',
}: NodeStatusIndicatorProps) {
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  switch (status) {
    case 'executing':
      return (
        <div className="flex items-center gap-1">
          <Loader2 className={`${iconSize} text-blue-400 animate-spin`} />
          {progress > 0 && progress < 100 && (
            <span className="text-xs text-blue-400">{Math.round(progress)}%</span>
          )}
        </div>
      );

    case 'finish':
      return <CheckCircle className={`${iconSize} text-green-400`} />;

    case 'failed':
      return <XCircle className={`${iconSize} text-red-400`} />;

    case 'init':
      return <Clock className={`${iconSize} text-gray-400`} />;

    case 'waiting':
      return <Circle className={`${iconSize} text-yellow-400`} />;

    default:
      return null;
  }
});

export default NodeStatusIndicator;
