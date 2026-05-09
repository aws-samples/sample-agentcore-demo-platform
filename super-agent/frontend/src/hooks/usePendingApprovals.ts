/**
 * usePendingApprovals hook
 * 
 * Polls for pending approval checkpoints every 30 seconds.
 * Also listens for 'approvals:changed' custom event for immediate refresh
 * (fired after approve/reject actions).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { RestApprovalService, type Checkpoint } from '@/services/api/restApprovalService';

const POLL_INTERVAL_MS = 30_000;

/** Call this after approve/reject to immediately update the badge */
export function notifyApprovalsChanged() {
  window.dispatchEvent(new CustomEvent('approvals:changed'));
}

export function usePendingApprovals() {
  const [pendingCheckpoints, setPendingCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const checkpoints = await RestApprovalService.getPendingCheckpoints();
      setPendingCheckpoints(checkpoints);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPending();

    intervalRef.current = setInterval(() => {
      void fetchPending();
    }, POLL_INTERVAL_MS);

    // Listen for immediate refresh events
    const handleChanged = () => { void fetchPending(); };
    window.addEventListener('approvals:changed', handleChanged);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('approvals:changed', handleChanged);
    };
  }, [fetchPending]);

  return {
    pendingCheckpoints,
    pendingCount: pendingCheckpoints.length,
    loading,
    error,
    refresh: fetchPending,
  };
}
