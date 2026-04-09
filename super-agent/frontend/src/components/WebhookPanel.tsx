/**
 * WebhookPanel - Manage webhooks for a workflow
 */

import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  ExternalLink,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useWebhooks } from '@/services/useWebhooks';
import type { Webhook, WebhookCallRecord } from '@/services/useWebhooks';

interface WebhookPanelProps {
  workflowId: string;
  onClose: () => void;
}

export function WebhookPanel({ workflowId, onClose }: WebhookPanelProps) {
  const {
    webhooks,
    isLoading,
    error,
    loadWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    getCallHistory,
    clearError,
  } = useWebhooks();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<{ secret: string; webhookUrl: string } | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null);
  const [callHistory, setCallHistory] = useState<WebhookCallRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<WebhookCallRecord | null>(null);

  useEffect(() => {
    loadWebhooks(workflowId);
  }, [workflowId, loadWebhooks]);

  const handleCopyUrl = async (webhook: Webhook) => {
    await navigator.clipboard.writeText(webhook.webhookUrl);
    setCopiedId(webhook.webhookId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = async () => {
    setIsCreating(true);
    const result = await createWebhook(workflowId, {
      name: `Webhook ${webhooks.length + 1}`,
      generateSecret: true,
    });
    setIsCreating(false);
    if (result?.secret) {
      setShowSecret({ secret: result.secret, webhookUrl: result.webhookUrl });
    }
  };

  const handleToggle = async (webhook: Webhook) => {
    await updateWebhook(webhook.webhookId, { isEnabled: !webhook.isEnabled });
  };

  const handleDelete = async (webhook: Webhook) => {
    if (confirm('Are you sure you want to delete this webhook?')) {
      await deleteWebhook(webhook.webhookId);
      if (selectedWebhook?.webhookId === webhook.webhookId) {
        setSelectedWebhook(null);
        setCallHistory([]);
      }
    }
  };

  const handleViewHistory = async (webhook: Webhook) => {
    setSelectedWebhook(webhook);
    setIsLoadingHistory(true);
    const result = await getCallHistory(webhook.webhookId);
    if (result) {
      setCallHistory(result.records);
    }
    setIsLoadingHistory(false);
  };

  return (
    <div className="w-96 border-l border-gray-800 bg-gray-900/95 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Webhooks</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Secret Modal */}
      {showSecret && (
        <div className="mx-4 mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-400 mb-2 font-medium">
            ⚠️ Save this secret - it won't be shown again!
          </p>
          <code className="block p-2 bg-gray-800 rounded text-xs text-gray-300 break-all">
            {showSecret.secret}
          </code>
          <div className="mt-2 text-xs text-gray-400">
            <p className="mb-1">Example:</p>
            <code className="block p-2 bg-gray-800 rounded text-[11px] text-gray-300 break-all whitespace-pre-wrap">
{`curl -X POST ${showSecret.webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Secret: ${showSecret.secret}" \\
  -d '{"variables": {"key": "value"}}'`}
            </code>
          </div>
          <button
            onClick={() => setShowSecret(null)}
            className="mt-2 text-xs text-yellow-400 hover:text-yellow-300"
          >
            I've saved it
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">No webhooks configured</p>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-2 mx-auto"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create Webhook
            </button>
          </div>
        ) : (
          <>
            {webhooks.map((webhook) => (
              <div
                key={webhook.webhookId}
                className={`p-3 rounded-lg border ${
                  selectedWebhook?.webhookId === webhook.webhookId
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">
                    {webhook.name || 'Unnamed Webhook'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggle(webhook)}
                      className="p-1 hover:bg-gray-700 rounded"
                      title={webhook.isEnabled ? 'Disable' : 'Enable'}
                    >
                      {webhook.isEnabled ? (
                        <ToggleRight className="w-5 h-5 text-green-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-500" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(webhook)}
                      className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <code className="flex-1 text-xs text-gray-400 break-all bg-gray-900 px-2 py-1 rounded">
                    {webhook.webhookUrl}
                  </code>
                  <button
                    onClick={() => handleCopyUrl(webhook)}
                    className="p-1 hover:bg-gray-700 rounded"
                    title="Copy URL"
                  >
                    {copiedId === webhook.webhookId ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    webhook.isEnabled 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {webhook.isEnabled ? 'Active' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => handleViewHistory(webhook)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Clock className="w-3 h-3" />
                    History
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full px-4 py-2 border border-dashed border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300 rounded-lg text-sm flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Webhook
            </button>
          </>
        )}
      </div>

      {/* Call History — styled like SchedulePanel execution history */}
      {selectedWebhook && (
        <div className="border-t border-gray-800 p-4 max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-gray-400">
              Execution History - {selectedWebhook.name || 'Webhook'}
            </h4>
            <button
              onClick={() => handleViewHistory(selectedWebhook)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Refresh
            </button>
          </div>
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            </div>
          ) : callHistory.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No calls yet</p>
          ) : (
            <div className="space-y-2">
              {callHistory.map((record) => {
                const duration = record.responseTimeMs != null
                  ? record.responseTimeMs >= 60000
                    ? `${Math.floor(record.responseTimeMs / 60000)}m ${Math.round((record.responseTimeMs % 60000) / 1000)}s`
                    : record.responseTimeMs >= 1000
                    ? `${(record.responseTimeMs / 1000).toFixed(1)}s`
                    : `${record.responseTimeMs}ms`
                  : null;

                return (
                  <div
                    key={record.id}
                    onClick={() => setViewingRecord(record)}
                    className="p-3 bg-gray-800/50 rounded-lg text-xs cursor-pointer hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400">
                        {new Date(record.createdAt).toLocaleString()}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${
                        record.status === 'success'
                          ? 'bg-green-500/20 text-green-400'
                          : record.status === 'running'
                          ? 'bg-blue-500/20 text-blue-400'
                          : record.status === 'pending'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {record.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {record.status}
                      </span>
                    </div>
                    {duration && (
                      <div className="text-gray-500">
                        {record.status === 'running' ? 'Running for' : 'Duration'}: {duration}
                      </div>
                    )}
                    {record.errorMessage && (
                      <div className="text-red-400 mt-1 break-words line-clamp-2">
                        {record.errorMessage}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Execution Log Modal — same as SchedulePanel */}
      {viewingRecord && (
        <WebhookLogModal record={viewingRecord} onClose={() => setViewingRecord(null)} />
      )}
    </div>
  );
}

function WebhookLogModal({ record, onClose }: { record: WebhookCallRecord; onClose: () => void }) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logs = (record.logs || []) as Array<{ type: string; content?: string; taskId?: string; taskTitle?: string; timestamp: string }>;

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Execution Log</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(record.createdAt).toLocaleString()} · <span className={
                record.status === 'success' ? 'text-green-400'
                : record.status === 'failed' ? 'text-red-400'
                : record.status === 'running' ? 'text-blue-400'
                : 'text-gray-400'
              }>{record.status}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Log entries */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              {record.status === 'running' ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Execution in progress...</span>
                </div>
              ) : (
                'No log events recorded'
              )}
            </div>
          ) : (
            logs.map((log, i) => {
              const icon = log.type === 'step_start' ? '🔄'
                : log.type === 'step_complete' ? '✅'
                : log.type === 'step_failed' ? '❌'
                : log.type === 'error' ? '⚠️'
                : log.type === 'done' ? '🏁'
                : '📝';
              const color = log.type === 'step_complete' || log.type === 'done' ? 'text-green-400'
                : log.type === 'step_failed' || log.type === 'error' ? 'text-red-400'
                : log.type === 'step_start' ? 'text-blue-400'
                : 'text-gray-400';

              return (
                <div key={i} className={`flex gap-2 ${color}`}>
                  <span className="flex-shrink-0">{icon}</span>
                  <span className="text-gray-500 flex-shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="flex-1">
                    {log.taskTitle || log.content || log.type}
                    {log.content && log.taskTitle && ` — ${log.content}`}
                  </span>
                </div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Footer */}
        {record.status === 'running' && (
          <div className="p-3 border-t border-gray-800 flex items-center gap-2 text-xs text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Execution in progress — logs update automatically</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default WebhookPanel;
