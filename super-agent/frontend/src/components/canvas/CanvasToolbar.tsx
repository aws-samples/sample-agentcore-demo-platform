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

interface CanvasToolbarProps {
  onAddNode: (type: CanvasNodeType) => void;
}

interface NodeTypeOption {
  type: CanvasNodeType;
  label: string;
  icon: typeof Bot;
  color: string;
  description: string;
}

const nodeTypeOptions: NodeTypeOption[] = [
  {
    type: 'agent',
    label: 'Agent',
    icon: Bot,
    color: 'text-blue-400 bg-blue-500/20 hover:bg-blue-500/30',
    description: 'AI agent that executes tasks',
  },
  {
    type: 'start',
    label: 'Start',
    icon: Play,
    color: 'text-green-400 bg-green-500/20 hover:bg-green-500/30',
    description: 'Workflow entry point',
  },
  {
    type: 'action',
    label: 'Action',
    icon: Zap,
    color: 'text-orange-400 bg-orange-500/20 hover:bg-orange-500/30',
    description: 'Execute an action',
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: GitBranch,
    color: 'text-yellow-400 bg-yellow-500/20 hover:bg-yellow-500/30',
    description: 'Conditional branching',
  },
  {
    type: 'document',
    label: 'Document',
    icon: FileText,
    color: 'text-cyan-400 bg-cyan-500/20 hover:bg-cyan-500/30',
    description: 'Rich text document',
  },
  {
    type: 'codeArtifact',
    label: 'Code',
    icon: Code,
    color: 'text-pink-400 bg-pink-500/20 hover:bg-pink-500/30',
    description: 'Code artifact',
  },
  {
    type: 'end',
    label: 'End',
    icon: Square,
    color: 'text-gray-400 bg-gray-500/20 hover:bg-gray-500/30',
    description: 'Workflow end point',
  },
];

export function CanvasToolbar({ onAddNode }: CanvasToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute top-4 left-4 z-10">
      <div className="bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl">
        {/* Main add button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-2 text-white hover:bg-gray-700/50 rounded-lg transition-colors w-full"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add Node</span>
          <ChevronDown 
            className={`w-4 h-4 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </button>

        {/* Expanded menu */}
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
                  className={`
                    flex items-center gap-3 w-full px-3 py-2 rounded-lg
                    transition-colors text-left
                    ${option.color}
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {option.description}
                    </div>
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
