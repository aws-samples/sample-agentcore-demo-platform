/**
 * CodeArtifactNode - Code artifact with preview
 */

import { memo, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { Code, Eye, Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { CanvasNodeData, ActionStatus } from '@/types/canvas';
import type { CodeArtifactNodeMeta } from '@/types/canvas/metadata';
import { BaseNode } from './BaseNode';
import { useTranslation } from '@/i18n';

type CodeArtifactNodeData = CanvasNodeData<CodeArtifactNodeMeta>;

const statusConfig: Record<string, { 
  icon: typeof Loader2; 
  color: string;
  animate?: boolean;
}> = {
  init: { icon: Clock, color: 'text-gray-400' },
  waiting: { icon: Clock, color: 'text-yellow-400' },
  generating: { icon: Loader2, color: 'text-pink-400', animate: true },
  finish: { icon: CheckCircle, color: 'text-green-400' },
  failed: { icon: XCircle, color: 'text-red-400' },
  executing: { icon: Loader2, color: 'text-blue-400', animate: true },
};

const languageColors: Record<string, string> = {
  typescript: 'text-blue-400',
  javascript: 'text-yellow-400',
  python: 'text-green-400',
  html: 'text-orange-400',
  css: 'text-purple-400',
  react: 'text-cyan-400',
  vue: 'text-emerald-400',
};

export const CodeArtifactNode = memo(function CodeArtifactNode(props: NodeProps) {
  const { id, selected } = props;
  const data = props.data as CodeArtifactNodeData;
  const metadata = data.metadata as CodeArtifactNodeMeta | undefined;
  // Prioritize execution status from hook over metadata status
  // executionStatus is injected by Canvas component from nodeExecutionStates
  const executionStatus = (data as Record<string, unknown>).executionStatus as ActionStatus | undefined;
  const status = executionStatus ?? metadata?.status ?? 'finish';
  const language = metadata?.language ?? 'typescript';
  const activeTab = metadata?.activeTab ?? 'code';
  
  const statusInfo = statusConfig[status] ?? statusConfig.finish;
  const StatusIcon = statusInfo.icon;
  const languageColor = languageColors[language] ?? 'text-gray-400';

  const [tab, setTab] = useState<'code' | 'preview'>(activeTab);
  const { t } = useTranslation();

  return (
    <BaseNode
      id={id}
      selected={selected}
      data={data}
      icon={<Code className="w-5 h-5 text-pink-400" />}
      iconBgColor="bg-pink-500/20"
      borderColor="border-pink-500/50"
      bgColor="bg-gray-800/95"
      statusIndicator={
        <StatusIcon 
          className={`w-4 h-4 ${statusInfo.color} ${statusInfo.animate ? 'animate-spin' : ''}`} 
        />
      }
    >
      <div className="mt-3 space-y-2">
        {/* Language Badge */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono ${languageColor}`}>
            {language}
          </span>
          {metadata?.type && (
            <span className="text-[10px] text-gray-500 px-1.5 py-0.5 bg-gray-700/50 rounded">
              {metadata.type}
            </span>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-gray-900/50 rounded-lg p-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTab('code');
            }}
            className={`
              flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors
              ${tab === 'code' 
                ? 'bg-pink-500/20 text-pink-300' 
                : 'text-gray-400 hover:text-gray-300'}
            `}
          >
            <Code className="w-3 h-3" />
            {t('node.code')}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTab('preview');
            }}
            className={`
              flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors
              ${tab === 'preview' 
                ? 'bg-pink-500/20 text-pink-300' 
                : 'text-gray-400 hover:text-gray-300'}
            `}
          >
            <Eye className="w-3 h-3" />
            {t('node.preview')}
          </button>
        </div>

        {/* Content */}
        <div className="bg-gray-900/80 rounded-lg border border-gray-700/50 overflow-hidden">
          {tab === 'code' ? (
            <div className="p-2 max-h-24 overflow-hidden">
              <pre className="text-[10px] text-gray-300 font-mono whitespace-pre-wrap line-clamp-6">
                {data.contentPreview || t('node.noCodeYet')}
              </pre>
            </div>
          ) : (
            <div className="p-2 h-24 flex items-center justify-center">
              {metadata?.previewUrl ? (
                <div className="text-xs text-gray-400">
                  {t('node.previewAvailable')}
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic">
                  {t('node.noPreview')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  );
});
