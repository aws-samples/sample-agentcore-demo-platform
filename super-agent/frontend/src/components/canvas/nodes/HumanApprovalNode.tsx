/**
 * HumanApprovalNode - Human-in-the-loop approval step
 */

import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { UserCheck, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { CanvasNodeData, ActionStatus } from '@/types/canvas';
import type { HumanApprovalNodeMeta, ApprovalStatus } from '@/types/canvas/metadata';
import { BaseNode } from './BaseNode';
import { NodeStatusIndicator } from '../NodeStatusIndicator';
import { useTranslation } from '@/i18n';

type HumanApprovalNodeData = CanvasNodeData<HumanApprovalNodeMeta>;

const statusConfig: Record<ApprovalStatus, { 
  icon: typeof Clock; 
  color: string;
  labelKey: string;
  bgColor: string;
}> = {
  pending: { 
    icon: Clock, 
    color: 'text-yellow-400',
    labelKey: 'node.approvalPending',
    bgColor: 'bg-yellow-500/10',
  },
  approved: { 
    icon: CheckCircle, 
    color: 'text-green-400',
    labelKey: 'node.approvalApproved',
    bgColor: 'bg-green-500/10',
  },
  rejected: { 
    icon: XCircle, 
    color: 'text-red-400',
    labelKey: 'node.approvalRejected',
    bgColor: 'bg-red-500/10',
  },
  timeout: { 
    icon: AlertCircle, 
    color: 'text-orange-400',
    labelKey: 'node.approvalTimeout',
    bgColor: 'bg-orange-500/10',
  },
};

export const HumanApprovalNode = memo(function HumanApprovalNode(props: NodeProps) {
  const { id, selected } = props;
  const data = props.data as HumanApprovalNodeData;
  const metadata = data.metadata as HumanApprovalNodeMeta | undefined;
  const approvalStatus = metadata?.status ?? 'pending';
  const statusInfo = statusConfig[approvalStatus];
  const StatusIcon = statusInfo.icon;
  const { t } = useTranslation();
  
  // Get execution status from hook (passed via Canvas)
  // executionStatus is injected by Canvas component from nodeExecutionStates
  const executionStatus = (data as Record<string, unknown>).executionStatus as ActionStatus | undefined;
  const executionProgress = (data as Record<string, unknown>).executionProgress as number | undefined;
  
  // Show execution status indicator if executing
  const showExecutionIndicator = executionStatus && executionStatus !== 'init';

  return (
    <BaseNode
      id={id}
      selected={selected}
      data={data}
      icon={<UserCheck className="w-5 h-5 text-purple-400" />}
      iconBgColor="bg-purple-500/20"
      borderColor="border-purple-500/50"
      bgColor="bg-gray-800/95"
      statusIndicator={
        showExecutionIndicator ? (
          <NodeStatusIndicator 
            status={executionStatus!} 
            progress={executionProgress}
          />
        ) : (
          <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
        )
      }
    >
      <div className="mt-3 space-y-2">
        {/* Status Badge */}
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${statusInfo.bgColor}`}>
          <StatusIcon className={`w-3 h-3 ${statusInfo.color}`} />
          <span className={statusInfo.color}>{t(statusInfo.labelKey)}</span>
        </div>

        {/* Instructions */}
        {metadata?.instructions && (
          <div className="bg-gray-900/50 rounded-lg p-2 border border-gray-700/50">
            <p className="text-xs text-gray-300 line-clamp-2">
              {metadata.instructions}
            </p>
          </div>
        )}

        {/* Approver Info */}
        {metadata?.approverName && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{t('node.approver')}</span>
            <span className="text-purple-300">{metadata.approverName}</span>
          </div>
        )}

        {/* Approval Time */}
        {metadata?.approvedAt && (
          <div className="text-[10px] text-gray-500">
            {new Date(metadata.approvedAt).toLocaleString()}
          </div>
        )}

        {/* Rejection Reason */}
        {approvalStatus === 'rejected' && metadata?.rejectionReason && (
          <div className="bg-red-500/10 rounded-lg p-2 border border-red-500/20">
            <p className="text-xs text-red-300 line-clamp-2">
              {metadata.rejectionReason}
            </p>
          </div>
        )}

        {/* Timeout Info */}
        {metadata?.timeoutSeconds && approvalStatus === 'pending' && (
          <div className="text-[10px] text-gray-500">
            {t('node.timeout').replace('{n}', String(metadata.timeoutSeconds))}
          </div>
        )}
      </div>
    </BaseNode>
  );
});
