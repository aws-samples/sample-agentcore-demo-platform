/**
 * Variables Panel
 * 
 * UI for viewing and editing workflow input variables.
 */

import { useState, useCallback } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Variable, 
  FileText, 
  ChevronDown,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import type { WorkflowVariable, WorkflowVariableValue } from '@/types/workflow-plan';

interface VariablesPanelProps {
  variables: WorkflowVariable[];
  onChange: (variables: WorkflowVariable[]) => void;
  onClose: () => void;
  readOnly?: boolean;
}

export function VariablesPanel({ 
  variables, 
  onChange, 
  onClose,
  readOnly = false,
}: VariablesPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleAddVariable = useCallback(() => {
    const newVariable: WorkflowVariable = {
      variableId: `var-${Date.now()}`,
      variableType: 'string',
      name: `variable${variables.length + 1}`,
      description: '',
      required: false,
      value: [],
    };
    onChange([...variables, newVariable]);
    setExpandedIds(prev => new Set(prev).add(newVariable.variableId));
  }, [variables, onChange]);

  const handleUpdateVariable = useCallback((
    variableId: string, 
    updates: Partial<WorkflowVariable>
  ) => {
    onChange(variables.map(v => 
      v.variableId === variableId ? { ...v, ...updates } : v
    ));
  }, [variables, onChange]);

  const handleDeleteVariable = useCallback((variableId: string) => {
    onChange(variables.filter(v => v.variableId !== variableId));
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.delete(variableId);
      return next;
    });
  }, [variables, onChange]);

  const handleAddValue = useCallback((variableId: string) => {
    const variable = variables.find(v => v.variableId === variableId);
    if (!variable) return;

    const newValue: WorkflowVariableValue = {
      type: 'text',
      text: '',
    };

    handleUpdateVariable(variableId, {
      value: [...variable.value, newValue],
    });
  }, [variables, handleUpdateVariable]);

  const handleUpdateValue = useCallback((
    variableId: string,
    valueIndex: number,
    updates: Partial<WorkflowVariableValue>
  ) => {
    const variable = variables.find(v => v.variableId === variableId);
    if (!variable) return;

    const newValues = [...variable.value];
    newValues[valueIndex] = { ...newValues[valueIndex], ...updates };

    handleUpdateVariable(variableId, { value: newValues });
  }, [variables, handleUpdateVariable]);

  const handleDeleteValue = useCallback((variableId: string, valueIndex: number) => {
    const variable = variables.find(v => v.variableId === variableId);
    if (!variable) return;

    const newValues = variable.value.filter((_, i) => i !== valueIndex);
    handleUpdateVariable(variableId, { value: newValues });
  }, [variables, handleUpdateVariable]);

  return (
    <div className="w-80 border-l border-gray-800 bg-gray-900/95 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Variable className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-medium text-white">Workflow Variables</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-y-auto p-2">
        {variables.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Variable className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No variables defined</p>
            <p className="text-xs mt-1">Variables allow users to provide input when running the workflow</p>
          </div>
        ) : (
          <div className="space-y-2">
            {variables.map((variable) => (
              <VariableItem
                key={variable.variableId}
                variable={variable}
                isExpanded={expandedIds.has(variable.variableId)}
                onToggleExpand={() => toggleExpanded(variable.variableId)}
                onUpdate={(updates) => handleUpdateVariable(variable.variableId, updates)}
                onDelete={() => handleDeleteVariable(variable.variableId)}
                onAddValue={() => handleAddValue(variable.variableId)}
                onUpdateValue={(index, updates) => handleUpdateValue(variable.variableId, index, updates)}
                onDeleteValue={(index) => handleDeleteValue(variable.variableId, index)}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Variable Button */}
      {!readOnly && (
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleAddVariable}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Variable
          </button>
        </div>
      )}
    </div>
  );
}

interface VariableItemProps {
  variable: WorkflowVariable;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<WorkflowVariable>) => void;
  onDelete: () => void;
  onAddValue: () => void;
  onUpdateValue: (index: number, updates: Partial<WorkflowVariableValue>) => void;
  onDeleteValue: (index: number) => void;
  readOnly: boolean;
}

function VariableItem({
  variable,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onAddValue,
  onUpdateValue,
  onDeleteValue,
  readOnly,
}: VariableItemProps) {
  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-800/50"
        onClick={onToggleExpand}
      >
        {!readOnly && (
          <GripVertical className="w-4 h-4 text-gray-600 cursor-grab" />
        )}
        
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {variable.variableType === 'resource' ? (
              <FileText className="w-4 h-4 text-purple-400" />
            ) : (
              <Variable className="w-4 h-4 text-blue-400" />
            )}
            <span className="text-sm font-medium text-white truncate">
              {variable.name}
            </span>
            {variable.required && (
              <span className="text-xs text-red-400">*</span>
            )}
          </div>
          {variable.description && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {variable.description}
            </p>
          )}
        </div>

        {!readOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 pt-0 space-y-3 border-t border-gray-700/50">
          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={variable.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              disabled={readOnly}
              className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white disabled:opacity-50"
              placeholder="variableName"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Type</label>
            <select
              value={variable.variableType}
              onChange={(e) => onUpdate({ variableType: e.target.value as 'string' | 'resource' })}
              disabled={readOnly}
              className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white disabled:opacity-50"
            >
              <option value="string">Text</option>
              <option value="resource">File/Resource</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea
              value={variable.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              disabled={readOnly}
              rows={2}
              className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white resize-none disabled:opacity-50"
              placeholder="Describe what this variable is for..."
            />
          </div>

          {/* Required */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`required-${variable.variableId}`}
              checked={variable.required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              disabled={readOnly}
              className="rounded border-gray-600 bg-gray-900 text-blue-500"
            />
            <label 
              htmlFor={`required-${variable.variableId}`}
              className="text-xs text-gray-400"
            >
              Required
            </label>
          </div>

          {/* Default Values */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">Default Value(s)</label>
              {!readOnly && (
                <button
                  onClick={onAddValue}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  + Add
                </button>
              )}
            </div>
            
            {variable.value.length === 0 ? (
              <p className="text-xs text-gray-600 italic">No default value</p>
            ) : (
              <div className="space-y-1">
                {variable.value.map((val, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={val.text || ''}
                      onChange={(e) => onUpdateValue(index, { text: e.target.value })}
                      disabled={readOnly}
                      className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-white disabled:opacity-50"
                      placeholder="Default value..."
                    />
                    {!readOnly && (
                      <button
                        onClick={() => onDeleteValue(index)}
                        className="p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Usage Hint */}
          <div className="pt-2 border-t border-gray-700/50">
            <p className="text-xs text-gray-500">
              Reference in prompts: <code className="text-blue-400">@{'{'}var:{variable.name}{'}'}</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
