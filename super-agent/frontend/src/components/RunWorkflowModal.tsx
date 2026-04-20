/**
 * Run Workflow Modal
 *
 * Prompts the user to fill in input variables before executing a workflow.
 * Required variables must have values before execution can start.
 */

import { useState } from 'react';
import { X, Play, AlertCircle } from 'lucide-react';
import type { WorkflowVariableDefinition } from '@/types/canvas/metadata';
import { useTranslation } from '@/i18n';

interface Props {
  workflowName: string;
  workflowId: string;
  variables: WorkflowVariableDefinition[];
  onRun: (variables: WorkflowVariableDefinition[]) => void;
  onClose: () => void;
}

/** Variable names that are auto-populated by the system */
const SYSTEM_VARIABLES: Record<string, (props: Props) => string> = {
  workflowid: (props) => props.workflowId,
  workflow_id: (props) => props.workflowId,
};

function isSystemVariable(name: string): boolean {
  return name.toLowerCase() in SYSTEM_VARIABLES;
}

export function RunWorkflowModal({ workflowName, workflowId, variables, onRun, onClose }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const v of variables) {
      // Auto-populate system variables
      const systemFn = SYSTEM_VARIABLES[v.name.toLowerCase()];
      if (systemFn) {
        initial[v.variableId] = systemFn({ workflowName, workflowId, variables, onRun, onClose });
        continue;
      }
      // Pre-fill from existing value if any
      const existing = Array.isArray(v.value)
        ? v.value.map(val => typeof val === 'string' ? val : (val as { text?: string })?.text || '').join(', ')
        : '';
      initial[v.variableId] = existing;
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);

  const handleRun = () => {
    // Validate required fields
    const missing = variables
      .filter(v => v.required && !values[v.variableId]?.trim())
      .map(v => v.name);

    if (missing.length > 0) {
      setError(t('runWorkflow.requiredMissing').replace('{fields}', missing.join(', ')));
      return;
    }

    // Build updated variables with user-provided values
    const updated = variables.map(v => ({
      ...v,
      value: values[v.variableId]
        ? [{ type: 'text' as const, text: values[v.variableId] }]
        : v.value,
    }));

    onRun(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('runWorkflow.title')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{workflowName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {variables.length === 0 ? (
            <p className="text-sm text-gray-400">{t('runWorkflow.noVariables')}</p>
          ) : (
            <>
              <p className="text-sm text-gray-400">
                {t('runWorkflow.fillVariables')}
              </p>
              {variables.filter(v => !isSystemVariable(v.name)).map(v => (
                <div key={v.variableId}>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {v.name}
                    {v.required && <span className="text-red-400 ml-1">*</span>}
                    {v.description && (
                      <span className="text-xs text-gray-500 font-normal ml-2">{v.description}</span>
                    )}
                  </label>
                  {v.variableType === 'resource' ? (
                    <textarea
                      rows={4}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none font-mono"
                      placeholder={`Enter ${v.name}...`}
                      value={values[v.variableId] || ''}
                      onChange={e => {
                        setValues(prev => ({ ...prev, [v.variableId]: e.target.value }));
                        setError(null);
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                      placeholder={`Enter ${v.name}...`}
                      value={values[v.variableId] || ''}
                      onChange={e => {
                        setValues(prev => ({ ...prev, [v.variableId]: e.target.value }));
                        setError(null);
                      }}
                    />
                  )}
                </div>
              ))}
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleRun}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            {t('runWorkflow.run')}
          </button>
        </div>
      </div>
    </div>
  );
}
