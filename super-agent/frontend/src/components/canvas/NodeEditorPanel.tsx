/**
 * NodeEditorPanel - Side panel for editing selected node properties
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Bot, 
  Play, 
  Square, 
  Zap, 
  GitBranch, 
  FileText, 
  Code,
  Trash2,
  Plus,
} from 'lucide-react';
import type { CanvasNode, CanvasNodeType } from '@/types/canvas';
import type { 
  AgentNodeMeta, 
  StartNodeMeta, 
  ActionNodeMeta,
  ConditionNodeMeta,
  WorkflowVariableDefinition,
} from '@/types/canvas/metadata';
import type { Agent } from '@/types';

interface NodeEditorPanelProps {
  node: CanvasNode | null;
  agents?: Agent[];
  onUpdate: (nodeId: string, updates: Partial<CanvasNode['data']>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

const nodeTypeConfig: Record<CanvasNodeType, { 
  icon: typeof Bot; 
  label: string;
  color: string;
}> = {
  agent: { icon: Bot, label: 'Agent', color: 'text-blue-400' },
  start: { icon: Play, label: 'Start', color: 'text-green-400' },
  end: { icon: Square, label: 'End', color: 'text-gray-400' },
  humanApproval: { icon: Zap, label: 'Approval (legacy)', color: 'text-purple-400' },
  action: { icon: Zap, label: 'Action', color: 'text-orange-400' },
  condition: { icon: GitBranch, label: 'Condition', color: 'text-yellow-400' },
  document: { icon: FileText, label: 'Document', color: 'text-cyan-400' },
  codeArtifact: { icon: Code, label: 'Code', color: 'text-pink-400' },
  resource: { icon: FileText, label: 'Resource', color: 'text-gray-400' },
  trigger: { icon: Play, label: 'Trigger', color: 'text-green-400' },
  loop: { icon: GitBranch, label: 'Loop', color: 'text-yellow-400' },
  parallel: { icon: GitBranch, label: 'Parallel', color: 'text-blue-400' },
  group: { icon: Square, label: 'Group', color: 'text-gray-400' },
  memo: { icon: FileText, label: 'Note', color: 'text-gray-400' },
};

export function NodeEditorPanel({ 
  node, 
  agents = [],
  onUpdate, 
  onDelete, 
  onClose 
}: NodeEditorPanelProps) {
  const [title, setTitle] = useState('');

  // Reset form when node changes
  useEffect(() => {
    if (node) {
      setTitle(node.data.title);
    }
  }, [node?.id]);

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
  }, []);

  // Auto-save title on blur
  const handleTitleBlur = useCallback(() => {
    if (!node || title === node.data.title) return;
    onUpdate(node.id, { title });
  }, [node, title, onUpdate]);

  const handleDelete = useCallback(() => {
    if (!node) return;
    if (confirm('Are you sure you want to delete this node?')) {
      onDelete(node.id);
      onClose();
    }
  }, [node, onDelete, onClose]);

  if (!node) {
    return (
      <div className="w-80 bg-gray-900 border-l border-gray-800 p-4 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Select a node to edit</p>
      </div>
    );
  }

  const config = nodeTypeConfig[node.type as CanvasNodeType] || nodeTypeConfig.action;
  const Icon = config.icon;

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <span className="font-medium text-white">{config.label}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col min-h-0">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTitleBlur();
              }
            }}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
          />
        </div>

        {/* Type-specific editors */}
        {node.type === 'agent' && (
          <AgentNodeEditor 
            node={node} 
            agents={agents}
            onUpdate={(updates) => {
              onUpdate(node.id, updates);
              setIsDirty(false);
            }} 
          />
        )}

        {node.type === 'start' && (
          <StartNodeEditor 
            node={node} 
            onUpdate={(updates) => {
              onUpdate(node.id, updates);
              setIsDirty(false);
            }} 
          />
        )}

        {node.type === 'action' && (
          <ActionNodeEditor 
            node={node} 
            onUpdate={(updates) => {
              onUpdate(node.id, updates);
              setIsDirty(false);
            }} 
          />
        )}

        {(node.type === 'document' || node.type === 'codeArtifact') && (
          <ActionNodeEditor 
            node={node} 
            onUpdate={(updates) => {
              onUpdate(node.id, updates);
              setIsDirty(false);
            }} 
          />
        )}

        {node.type === 'condition' && (
          <ConditionNodeEditor 
            node={node} 
            onUpdate={(updates) => {
              onUpdate(node.id, updates);
              setIsDirty(false);
            }} 
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Changes are auto-saved. Click the main Save button to persist to database.
        </p>
      </div>
    </div>
  );
}

// Agent Node Editor
function AgentNodeEditor({ 
  node, 
  agents,
  onUpdate 
}: { 
  node: CanvasNode; 
  agents: Agent[];
  onUpdate: (updates: Partial<CanvasNode['data']>) => void;
}) {
  const metadata = node.data.metadata as AgentNodeMeta | undefined;
  const [selectedAgentId, setSelectedAgentId] = useState(metadata?.agentId || '');
  const [query, setQuery] = useState(metadata?.query || (metadata as any)?.prompt || '');

  // Sync local state when a different node is selected
  useEffect(() => {
    const meta = node.data.metadata as AgentNodeMeta | undefined;
    setSelectedAgentId(meta?.agentId || '');
    setQuery(meta?.query || (meta as any)?.prompt || '');
  }, [node.id]);

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      onUpdate({
        title: agent.displayName,
        metadata: {
          ...metadata,
          agentId,
          agent: {
            id: agent.id,
            name: agent.displayName,
            role: agent.role,
            avatar: agent.avatar,
            systemPrompt: agent.systemPrompt,
          },
          modelConfig: agent.modelConfig,
        },
      });
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    onUpdate({
      contentPreview: value,
      metadata: {
        ...metadata,
        query: value,
        prompt: value,
      },
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Agent Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Select Agent
        </label>
        <select
          value={selectedAgentId}
          onChange={(e) => handleAgentChange(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm"
        >
          <option value="">Choose an agent...</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.displayName} - {agent.role}
            </option>
          ))}
        </select>
      </div>

      {/* Query/Prompt */}
      <div className="flex flex-col flex-1 min-h-0">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Query / Prompt
        </label>
        <textarea
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Enter the task or question for this agent..."
          className="w-full flex-1 min-h-[120px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm resize-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          Use {'{{variableName}}'} to reference workflow variables
        </p>
      </div>
    </div>
  );
}

// Start Node Editor
function StartNodeEditor({ 
  node, 
  onUpdate 
}: { 
  node: CanvasNode; 
  onUpdate: (updates: Partial<CanvasNode['data']>) => void;
}) {
  const metadata = node.data.metadata as StartNodeMeta | undefined;
  const [variables, setVariables] = useState<WorkflowVariableDefinition[]>(
    metadata?.inputVariables || []
  );

  // Sync local state when a different node is selected
  useEffect(() => {
    const meta = node.data.metadata as StartNodeMeta | undefined;
    setVariables(meta?.inputVariables || []);
  }, [node.id]);

  const addVariable = () => {
    const newVar: WorkflowVariableDefinition = {
      variableId: `var_${Date.now()}`,
      name: `variable${variables.length + 1}`,
      value: [],
      variableType: 'string',
      required: false,
    };
    const updated = [...variables, newVar];
    setVariables(updated);
    onUpdate({
      metadata: {
        ...metadata,
        inputVariables: updated,
      },
    });
  };

  const updateVariable = (index: number, updates: Partial<WorkflowVariableDefinition>) => {
    const updated = variables.map((v, i) => 
      i === index ? { ...v, ...updates } : v
    );
    setVariables(updated);
    onUpdate({
      metadata: {
        ...metadata,
        inputVariables: updated,
      },
    });
  };

  const removeVariable = (index: number) => {
    const updated = variables.filter((_, i) => i !== index);
    setVariables(updated);
    onUpdate({
      metadata: {
        ...metadata,
        inputVariables: updated,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-400">
          Input Variables
        </label>
        <button
          onClick={addVariable}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      <div className="space-y-2">
        {variables.map((variable, index) => (
          <div key={variable.variableId} className="bg-gray-800/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={variable.name}
                onChange={(e) => updateVariable(index, { name: e.target.value })}
                placeholder="Variable name"
                className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              />
              <button
                onClick={() => removeVariable(index)}
                className="p-1 hover:bg-red-500/20 text-red-400 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={variable.variableType || 'string'}
                onChange={(e) => updateVariable(index, { 
                  variableType: e.target.value as 'string' | 'option' | 'resource' 
                })}
                className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              >
                <option value="string">Text</option>
                <option value="option">Option</option>
                <option value="resource">Resource</option>
              </select>
              <label className="flex items-center gap-1 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={variable.required || false}
                  onChange={(e) => updateVariable(index, { required: e.target.checked })}
                  className="rounded border-gray-600"
                />
                Required
              </label>
            </div>
          </div>
        ))}

        {variables.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No input variables defined
          </p>
        )}
      </div>
    </div>
  );
}

// Action Node Editor
function ActionNodeEditor({ 
  node, 
  onUpdate 
}: { 
  node: CanvasNode; 
  onUpdate: (updates: Partial<CanvasNode['data']>) => void;
}) {
  const metadata = node.data.metadata as ActionNodeMeta | undefined;
  const [description, setDescription] = useState(
    (metadata as Record<string, unknown>)?.prompt as string || node.data.contentPreview || ''
  );

  // Sync local state when a different node is selected
  useEffect(() => {
    const meta = node.data.metadata as Record<string, unknown> | undefined;
    setDescription((meta?.prompt as string) || node.data.contentPreview || '');
  }, [node.id]);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    onUpdate({
      contentPreview: value,
      metadata: {
        ...metadata,
        prompt: value,
      },
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-h-0">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          What should this action do?
        </label>
        <textarea
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Describe the action in natural language, e.g. 'Create a new opportunity in Salesforce CRM with the gathered details' or 'Send a Slack notification to the #sales channel'"
          className="w-full flex-1 min-h-[120px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm resize-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          Claude will use available API skills to execute this action during workflow run.
        </p>
      </div>
    </div>
  );
}

// Condition Node Editor
function ConditionNodeEditor({ 
  node, 
  onUpdate 
}: { 
  node: CanvasNode; 
  onUpdate: (updates: Partial<CanvasNode['data']>) => void;
}) {
  const metadata = node.data.metadata as ConditionNodeMeta | undefined;
  const [description, setDescription] = useState(
    (metadata as Record<string, unknown>)?.prompt as string || node.data.contentPreview || ''
  );

  // Sync local state when a different node is selected
  useEffect(() => {
    const meta = node.data.metadata as Record<string, unknown> | undefined;
    setDescription((meta?.prompt as string) || node.data.contentPreview || '');
  }, [node.id]);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    onUpdate({
      contentPreview: value,
      metadata: {
        ...metadata,
        prompt: value,
      },
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-col flex-1 min-h-0">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Condition
        </label>
        <textarea
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="Describe the branching condition, e.g. 'If the deal size is greater than $100K, proceed to management review. Otherwise, auto-approve.'"
          className="w-full flex-1 min-h-[120px] px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm resize-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          Claude will evaluate this condition naturally during execution.
        </p>
      </div>
    </div>
  );
}
