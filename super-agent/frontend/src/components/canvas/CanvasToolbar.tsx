/**
 * Canvas Toolbar - Quick actions for adding nodes
 */

import { useState } from 'react';
import { 
  Bot, 
  FileText, 
  Code, 
  Play, 
  Zap, 
  GitBranch,
  Square,
  Plus,
  ChevronDown,
} from 'lucide-react';
import type { CanvasNodeType } from '@/types/canvas';
import { useTranslation } from '@/i18n';

interface CanvasToolbarProps {
  onAddNode: (type: CanvasNodeType) => void;
}

interface NodeTypeOption {
  type: CanvasNodeType;
  labelKey: string;
  icon: typeof Bot;
  color: string;
  descKey: string;
}

const nodeTypeOptions: NodeTypeOption[] = [
  { type: 'agent', labelKey: 'canvas.nodeAgent', icon: Bot, color: 'text-blue-400 bg-blue-500/20 hover:bg-blue-500/30', descKey: 'canvas.nodeAgentDesc' },
  { type: 'start', labelKey: 'canvas.nodeStart', icon: Play, color: 'text-green-400 bg-green-500/20 hover:bg-green-500/30', descKey: 'canvas.nodeStartDesc' },
  { type: 'action', labelKey: 'canvas.nodeAction', icon: Zap, color: 'text-orange-400 bg-orange-500/20 hover:bg-orange-500/30', descKey: 'canvas.nodeActionDesc' },
  { type: 'condition', labelKey: 'canvas.nodeCondition', icon: GitBranch, color: 'text-yellow-400 bg-yellow-500/20 hover:bg-yellow-500/30', descKey: 'canvas.nodeConditionDesc' },
  { type: 'document', labelKey: 'canvas.nodeDocument', icon: FileText, color: 'text-cyan-400 bg-cyan-500/20 hover:bg-cyan-500/30', descKey: 'canvas.nodeDocumentDesc' },
  { type: 'codeArtifact', labelKey: 'canvas.nodeCode', icon: Code, color: 'text-pink-400 bg-pink-500/20 hover:bg-pink-500/30', descKey: 'canvas.nodeCodeDesc' },
  { type: 'end', labelKey: 'canvas.nodeEnd', icon: Square, color: 'text-gray-400 bg-gray-500/20 hover:bg-gray-500/30', descKey: 'canvas.nodeEndDesc' },
];

export function CanvasToolbar({ onAddNode }: CanvasToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="absolute top-4 left-4 z-10">
      <div className="bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-2 text-white hover:bg-gray-700/50 rounded-lg transition-colors w-full"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">{t('canvas.addNode')}</span>
          <ChevronDown 
            className={`w-4 h-4 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </button>

        {isExpanded && (
          <div className="border-t border-gray-700 p-2 space-y-1">
            {nodeTypeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.type}
                  onClick={() => {
                    onAddNode(option.type);
                    setIsExpanded(false);
                  }}
                  className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors text-left ${option.color}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">{t(option.labelKey)}</div>
                    <div className="text-xs text-gray-400 truncate">{t(option.descKey)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
