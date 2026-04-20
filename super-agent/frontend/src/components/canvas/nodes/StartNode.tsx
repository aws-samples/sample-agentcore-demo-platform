/**
 * StartNode - Workflow entry point
 */

import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Play, Variable } from 'lucide-react';
import type { CanvasNodeData, ActionStatus } from '@/types/canvas';
import type { StartNodeMeta } from '@/types/canvas/metadata';
import { BaseNode } from './BaseNode';
import { NodeStatusIndicator } from '../NodeStatusIndicator';
import { useTranslation } from '@/i18n';

type StartNodeData = CanvasNodeData<StartNodeMeta>;

export const StartNode = memo(function StartNode(props: NodeProps) {
  const { id, selected } = props;
  const data = props.data as StartNodeData;
  const metadata = data.metadata as StartNodeMeta | undefined;
  const inputVariables = metadata?.inputVariables ?? [];
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
      icon={<Play className="w-5 h-5 text-green-400" />}
      iconBgColor="bg-green-500/20"
      borderColor="border-green-500/50"
      bgColor="bg-gray-800/95"
      showTargetHandle={false}
      statusIndicator={
        showExecutionIndicator ? (
          <NodeStatusIndicator 
            status={executionStatus!} 
            progress={executionProgress}
          />
        ) : undefined
      }
    >
      {/* Input Variables */}
      {inputVariables.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Variable className="w-3 h-3" />
            <span>{t('node.inputVariables')}</span>
          </div>
          <div className="space-y-1">
            {inputVariables.slice(0, 3).map((variable) => (
              <div 
                key={variable.variableId}
                className="flex items-center gap-2 text-xs bg-gray-900/50 rounded px-2 py-1"
              >
                <span className="text-green-300 font-mono">
                  {`{{${variable.name}}}`}
                </span>
                {variable.required && (
                  <span className="text-red-400 text-[10px]">*</span>
                )}
                <span className="text-gray-500 text-[10px] ml-auto">
                  {variable.variableType ?? 'string'}
                </span>
              </div>
            ))}
            {inputVariables.length > 3 && (
              <div className="text-[10px] text-gray-500 px-2">
                {t('node.nMore').replace('{n}', String(inputVariables.length - 3))}
              </div>
            )}
          </div>
        </div>
      )}

      {inputVariables.length === 0 && (
        <div className="mt-2 text-xs text-gray-500 italic">
          {t('node.noInputVariables')}
        </div>
      )}
    </BaseNode>
  );
});
