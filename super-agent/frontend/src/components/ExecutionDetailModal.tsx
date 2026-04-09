/**
 * Execution Detail Modal
 *
 * Shows full execution log with node-by-node status, outputs, and errors.
 */

import { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { getAuthToken } from '@/services/api/restClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

interface NodeExecution {
  id: string;
  node_id: string;
  node_type: string;
  node_data: { title?: string; prompt?: string } | null;
  status: string;
  progress: number;
  output_data: Record<string, unknown> | string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface ExecutionDetail {
  id: string;
  workflow_id: string;
  status: string;
  title: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  variables: Array<{ name?: string; value?: string }>;
  canvas_data: { nodes?: Array<{ id: string }> };
  node_executions: NodeExecution[];
}

interface Props {
  executionId: string;
  onClose: () => void;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'finish':
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'executing':
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    default:
      return <Clock className="w-4 h-4 text-gray-500" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    finish: 'bg-green-500/20 text-green-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    executing: 'bg-blue-500/20 text-blue-400',
    running: 'bg-blue-500/20 text-blue-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
    init: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || colors.init}`}>
      {status}
    </span>
  );
}

function NodeRow({ node }: { node: NodeExecution }) {
  const [expanded, setExpanded] = useState(node.status === 'failed');
  const title = node.node_data?.title || node.node_id;
  const hasDetails = node.output_data || node.error_message;

  return (
    <div className="border border-gray-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
          hasDetails ? 'hover:bg-gray-800/50 cursor-pointer' : 'cursor-default'
        }`}
      >
        <StatusIcon status={node.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium truncate">{title}</span>
            <span className="text-xs text-gray-500 flex-shrink-0">[{node.node_type}]</span>
          </div>
          {node.started_at && (
            <div className="text-xs text-gray-500 mt-0.5">
              {new Date(node.started_at).toLocaleTimeString()}
              {node.completed_at && ` - ${new Date(node.completed_at).toLocaleTimeString()}`}
            </div>
          )}
        </div>
        <StatusBadge status={node.status} />
        {hasDetails && (
          expanded
            ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            : <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
      </button>

      {expanded && hasDetails && (
        <div className="px-4 pb-3 space-y-2 border-t border-gray-700/50">
          {node.error_message && (
            <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-medium text-red-400">Error</span>
              </div>
              <pre className="text-xs text-red-300 whitespace-pre-wrap break-words font-mono">
                {node.error_message}
              </pre>
            </div>
          )}
          {node.output_data && (
            <div className="mt-2 p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg">
              <div className="text-xs font-medium text-gray-400 mb-1">Output</div>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono max-h-48 overflow-y-auto">
                {typeof node.output_data === 'string'
                  ? node.output_data
                  : JSON.stringify(node.output_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ExecutionDetailModal({ executionId, onClose }: Props) {
  const [detail, setDetail] = useState<ExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    fetch(`${API_BASE_URL}/api/executions/${executionId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        return res.json();
      })
      .then((data) => { setDetail(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [executionId]);

  const completedCount = detail?.node_executions.filter(
    n => n.status === 'finish' || n.status === 'completed'
  ).length ?? 0;
  const failedCount = detail?.node_executions.filter(n => n.status === 'failed').length ?? 0;
  const totalCount = detail?.node_executions.length ?? 0;

  // Sort nodes by the original plan order (canvas_data.nodes)
  const sortedNodes = (() => {
    if (!detail) return [];
    const planNodeIds = (detail.canvas_data?.nodes || []).map((n: { id: string }) => n.id);
    if (planNodeIds.length === 0) return detail.node_executions;
    const orderMap = new Map(planNodeIds.map((id: string, i: number) => [id, i]));
    return [...detail.node_executions].sort((a, b) => {
      const aIdx = orderMap.get(a.node_id) ?? 999;
      const bIdx = orderMap.get(b.node_id) ?? 999;
      return aIdx - bIdx;
    });
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {detail?.title || 'Execution Detail'}
            </h2>
            {detail && (
              <div className="flex items-center gap-3 mt-1">
                <StatusBadge status={detail.status} />
                <span className="text-xs text-gray-400">
                  {new Date(detail.started_at).toLocaleString()}
                </span>
                {detail.completed_at && (
                  <span className="text-xs text-gray-500">
                    Duration: {Math.round((new Date(detail.completed_at).getTime() - new Date(detail.started_at).getTime()) / 1000)}s
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="ml-2 text-sm text-gray-400">Loading execution details...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {detail && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-400">{completedCount} completed</span>
                {failedCount > 0 && <span className="text-red-400">{failedCount} failed</span>}
                <span className="text-gray-500">{totalCount} total nodes</span>
              </div>

              {/* Execution error */}
              {detail.error_message && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-red-400">Execution Error</span>
                  </div>
                  <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">{detail.error_message}</pre>
                </div>
              )}

              {/* Variables */}
              {detail.variables && detail.variables.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Input Variables</h3>
                  <div className="flex flex-wrap gap-2">
                    {detail.variables.map((v, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-300">
                        {v.name}: {v.value || '(empty)'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Node executions — sorted by plan order */}
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Node Execution Log</h3>
                <div className="space-y-2">
                  {sortedNodes.map((node) => (
                    <NodeRow key={node.id} node={node} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
