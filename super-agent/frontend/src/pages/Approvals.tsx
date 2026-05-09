/**
 * Approvals Page - Approval inbox for workflow human approval checkpoints
 * 
 * Two tabs: Pending (waiting checkpoints) and Processed (resolved/cancelled/expired).
 * Clicking a pending item shows details with approve/reject actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { RestApprovalService, type Checkpoint } from '@/services/api/restApprovalService';
import { notifyApprovalsChanged } from '@/hooks/usePendingApprovals';

type Tab = 'pending' | 'processed';

export function Approvals() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [pendingItems, setPendingItems] = useState<Checkpoint[]>([]);
  const [processedItems, setProcessedItems] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Checkpoint | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'pending') {
        const data = await RestApprovalService.getPendingCheckpoints();
        setPendingItems(data);
      } else {
        const data = await RestApprovalService.getProcessedCheckpoints();
        setProcessedItems(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleApprove = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      await RestApprovalService.approveCheckpoint(
        selectedItem.executionId,
        selectedItem.id,
        reason || undefined
      );
      setSelectedItem(null);
      setReason('');
      notifyApprovalsChanged();
      void fetchData();
    } catch {
      // Error handled by service
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      await RestApprovalService.rejectCheckpoint(
        selectedItem.executionId,
        selectedItem.id,
        reason || undefined
      );
      setSelectedItem(null);
      setReason('');
      notifyApprovalsChanged();
      void fetchData();
    } catch {
      // Error handled by service
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return `${Math.floor(diff / (1000 * 60))}m ${t('approvals.timeAgo')}`;
    if (hours < 24) return `${hours}h ${t('approvals.timeAgo')}`;
    return `${Math.floor(hours / 24)}d ${t('approvals.timeAgo')}`;
  };

  const formatRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return t('approvals.expired');
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return `${Math.floor(diff / (1000 * 60))}m ${t('approvals.remaining')}`;
    return `${hours}h ${t('approvals.remaining')}`;
  };

  // Detail view
  if (selectedItem) {
    return (
      <div className="flex-1 p-6 overflow-y-auto">
        <button
          onClick={() => { setSelectedItem(null); setReason(''); }}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('approvals.back')}
        </button>

        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-xl font-semibold text-white">{selectedItem.nodeTitle}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
              <span>{t('approvals.createdAt')}: {new Date(selectedItem.createdAt).toLocaleString()}</span>
              {selectedItem.expiresAt && (
                <span>{t('approvals.expiresAt')}: {new Date(selectedItem.expiresAt).toLocaleString()} ({formatRemaining(selectedItem.expiresAt)})</span>
              )}
            </div>
          </div>

          {/* Instructions */}
          {selectedItem.config?.instructions && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">{t('approvals.instructions')}</h3>
              <p className="text-white whitespace-pre-wrap">{selectedItem.config.instructions}</p>
            </div>
          )}

          {/* Upstream Outputs */}
          {selectedItem.inputContext?.upstream_outputs && Object.keys(selectedItem.inputContext.upstream_outputs).length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">{t('approvals.upstreamOutputs')}</h3>
              <div className="space-y-3">
                {Object.entries(selectedItem.inputContext.upstream_outputs).map(([key, value]) => (
                  <UpstreamOutputItem key={key} nodeKey={key} data={value} />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">{t('approvals.actions')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('approvals.reason')}</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('approvals.reasonPlaceholder')}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none text-sm resize-none h-20"
                />
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={handleReject}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {t('approvals.reject')}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {t('approvals.approve')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">{t('approvals.title')}</h1>
        {activeTab === 'pending' && pendingItems.length > 0 && (
          <span className="px-2 py-1 bg-red-500/10 text-red-400 text-sm rounded-full">
            {pendingItems.length}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {t('approvals.pending')}
        </button>
        <button
          onClick={() => setActiveTab('processed')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'processed'
              ? 'bg-gray-700 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {t('approvals.processed')}
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div className="text-center py-12 text-gray-400">{t('approvals.loading')}</div>
      )}

      {error && (
        <div className="text-center py-12 text-red-400">{t('approvals.error')}</div>
      )}

      {!loading && !error && activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{t('approvals.noPending')}</div>
          ) : (
            pendingItems.map((item) => (
              <CheckpointCard
                key={item.id}
                checkpoint={item}
                onClick={() => setSelectedItem(item)}
                formatTimeAgo={formatTimeAgo}
                formatRemaining={formatRemaining}
              />
            ))
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'processed' && (
        <div className="space-y-3">
          {processedItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">{t('approvals.noProcessed')}</div>
          ) : (
            processedItems.map((item) => (
              <ProcessedCard key={item.id} checkpoint={item} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Checkpoint card for pending list
function CheckpointCard({
  checkpoint,
  onClick,
  formatTimeAgo,
  formatRemaining,
}: {
  checkpoint: Checkpoint;
  onClick: () => void;
  formatTimeAgo: (d: string) => string;
  formatRemaining: (d: string | null) => string | null;
}) {
  const { t } = useTranslation();
  const remaining = formatRemaining(checkpoint.expiresAt);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-lg p-4 transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{checkpoint.nodeTitle}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {t('approvals.waitingApproval')} · {formatTimeAgo(checkpoint.createdAt)}
            </span>
            {remaining && (
              <span className={remaining === t('approvals.expired') ? 'text-red-400' : 'text-yellow-400'}>
                · {remaining}
              </span>
            )}
          </div>
          {checkpoint.config?.instructions && (
            <p className="mt-2 text-sm text-gray-400 line-clamp-2">
              {checkpoint.config.instructions}
            </p>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-gray-300 mt-1 flex-shrink-0" />
      </div>
    </button>
  );
}

// Processed card for history list
function ProcessedCard({ checkpoint }: { checkpoint: Checkpoint }) {
  const { t } = useTranslation();

  const getStatusBadge = () => {
    if (checkpoint.status === 'resolved' && checkpoint.result?.approved) {
      return (
        <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
          <CheckCircle className="w-3 h-3" />
          {t('approvals.approved')}
        </span>
      );
    }
    if (checkpoint.status === 'cancelled') {
      return (
        <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
          <XCircle className="w-3 h-3" />
          {t('approvals.rejected')}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-500/10 px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3 h-3" />
        {t('approvals.expired')}
      </span>
    );
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{checkpoint.nodeTitle}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>{new Date(checkpoint.createdAt).toLocaleString()}</span>
            {checkpoint.resolvedAt && (
              <span>{t('approvals.resolvedAt')}: {new Date(checkpoint.resolvedAt).toLocaleString()}</span>
            )}
          </div>
          {(checkpoint.result?.reason || checkpoint.reason) && (
            <p className="mt-2 text-sm text-gray-400">
              {checkpoint.result?.reason || checkpoint.reason}
            </p>
          )}
        </div>
        {getStatusBadge()}
      </div>
    </div>
  );
}

// Upstream output display component
function UpstreamOutputItem({ nodeKey, data }: { nodeKey: string; data: { title: string; output: unknown } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-300 hover:bg-gray-700/50 transition-colors"
      >
        <span className="font-medium">{data.title || nodeKey}</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-gray-700 bg-gray-900/50">
          <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto">
            {typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
