/**
 * SchedulePanel - Manage schedules for a workflow
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Clock,
  Loader2,
  AlertCircle,
  Play,
  Calendar,
  Edit2,
  Check,
} from 'lucide-react';
import { useSchedules } from '@/services/useSchedules';
import type { Schedule, ScheduleRecord } from '@/services/useSchedules';
import type { ScheduleExecutionLog } from '@/services/api/restScheduleService';

interface SchedulePanelProps {
  workflowId: string;
  onClose: () => void;
}

// Common cron presets
const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 9am', value: '0 9 * * *' },
  { label: 'Every Monday at 9am', value: '0 9 * * 1' },
  { label: 'First of month at midnight', value: '0 0 1 * *' },
];

export function SchedulePanel({ workflowId, onClose }: SchedulePanelProps) {
  const {
    schedules,
    isLoading,
    error,
    loadSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    triggerSchedule,
    getExecutionRecords,
    clearError,
  } = useSchedules();

  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [executionRecords, setExecutionRecords] = useState<ScheduleRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<ScheduleRecord | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newCron, setNewCron] = useState('0 9 * * *');
  const [newTimezone, setNewTimezone] = useState('UTC');

  useEffect(() => {
    loadSchedules(workflowId);
  }, [workflowId, loadSchedules]);

  // Poll execution records while any are in 'running' status
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshRecords = useCallback(async () => {
    if (!selectedSchedule) return;
    const result = await getExecutionRecords(selectedSchedule.id);
    if (result) {
      setExecutionRecords(result.records);
      // Update the viewed record if modal is open
      if (viewingRecord) {
        const updated = result.records.find(r => r.id === viewingRecord.id);
        if (updated) setViewingRecord(updated);
      }
      // Stop polling if no records are running
      const hasRunning = result.records.some(r => r.status === 'running');
      if (!hasRunning && pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        // Also refresh schedule stats (run count, last run)
        loadSchedules(workflowId);
      }
    }
  }, [selectedSchedule, viewingRecord, getExecutionRecords, loadSchedules, workflowId]);

  useEffect(() => {
    const hasRunning = executionRecords.some(r => r.status === 'running');
    if (hasRunning && selectedSchedule && !pollIntervalRef.current) {
      pollIntervalRef.current = setInterval(refreshRecords, 5000);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [executionRecords, selectedSchedule, refreshRecords]);

  const handleCreate = async () => {
    if (!newName.trim() || !newCron.trim()) return;
    
    setIsCreating(true);
    const result = await createSchedule(workflowId, {
      name: newName.trim(),
      cronExpression: newCron.trim(),
      timezone: newTimezone,
      isEnabled: true,
    });
    setIsCreating(false);
    
    if (result) {
      setShowCreateForm(false);
      setNewName('');
      setNewCron('0 9 * * *');
    }
  };

  const handleToggle = async (schedule: Schedule) => {
    await updateSchedule(schedule.id, { isEnabled: !schedule.isEnabled });
  };

  const handleDelete = async (schedule: Schedule) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      await deleteSchedule(schedule.id);
      if (selectedSchedule?.id === schedule.id) {
        setSelectedSchedule(null);
        setExecutionRecords([]);
      }
    }
  };

  const handleTrigger = async (schedule: Schedule) => {
    const result = await triggerSchedule(schedule.id);
    if (result) {
      // Auto-show execution history after triggering
      setSelectedSchedule(schedule);
      setIsLoadingRecords(true);
      const records = await getExecutionRecords(schedule.id);
      if (records) {
        setExecutionRecords(records.records);
      }
      setIsLoadingRecords(false);
      // Reload schedules to update run count
      loadSchedules(workflowId);
    }
  };

  const handleViewRecords = async (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setIsLoadingRecords(true);
    const result = await getExecutionRecords(schedule.id);
    if (result) {
      setExecutionRecords(result.records);
    }
    setIsLoadingRecords(false);
  };

  const handleUpdateCron = async (schedule: Schedule, newCronValue: string) => {
    await updateSchedule(schedule.id, { cronExpression: newCronValue });
    setEditingId(null);
  };

  const formatNextRun = (nextRunAt: string | null) => {
    if (!nextRunAt) return 'Not scheduled';
    const date = new Date(nextRunAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return 'Overdue';
    if (diff < 60000) return 'In less than a minute';
    if (diff < 3600000) return `In ${Math.round(diff / 60000)} minutes`;
    if (diff < 86400000) return `In ${Math.round(diff / 3600000)} hours`;
    return date.toLocaleString();
  };

  return (
    <div className="w-96 border-l border-gray-800 bg-gray-900/95 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Schedules</h3>
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

      {/* Create Form */}
      {showCreateForm && (
        <div className="mx-4 mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
          <h4 className="text-sm font-medium text-white mb-3">New Schedule</h4>
          
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Daily Report"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Cron Expression</label>
              <input
                type="text"
                value={newCron}
                onChange={(e) => setNewCron(e.target.value)}
                placeholder="0 9 * * *"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white font-mono focus:border-blue-500 outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {CRON_PRESETS.slice(0, 4).map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setNewCron(preset.value)}
                    className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Timezone</label>
              <select
                value={newTimezone}
                onChange={(e) => setNewTimezone(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white focus:border-blue-500 outline-none"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
                <option value="Asia/Shanghai">Asia/Shanghai</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || !newName.trim() || !newCron.trim()}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-sm flex items-center justify-center gap-2"
              >
                {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : schedules.length === 0 && !showCreateForm ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">No schedules configured</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Create Schedule
            </button>
          </div>
        ) : (
          <>
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`p-3 rounded-lg border ${
                  selectedSchedule?.id === schedule.id
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">
                    {schedule.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTrigger(schedule)}
                      className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-green-400"
                      title="Run Now"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggle(schedule)}
                      className="p-1 hover:bg-gray-700 rounded"
                      title={schedule.isEnabled ? 'Disable' : 'Enable'}
                    >
                      {schedule.isEnabled ? (
                        <ToggleRight className="w-5 h-5 text-green-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-500" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(schedule)}
                      className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Cron Expression */}
                <div className="flex items-center gap-2 mb-2">
                  {editingId === schedule.id ? (
                    <input
                      type="text"
                      defaultValue={schedule.cronExpression}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateCron(schedule, e.currentTarget.value);
                        } else if (e.key === 'Escape') {
                          setEditingId(null);
                        }
                      }}
                      className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-xs text-white font-mono focus:border-blue-500 outline-none"
                      autoFocus
                    />
                  ) : (
                    <code className="flex-1 text-xs text-gray-400 bg-gray-900 px-2 py-1 rounded font-mono">
                      {schedule.cronExpression}
                    </code>
                  )}
                  <button
                    onClick={() => setEditingId(editingId === schedule.id ? null : schedule.id)}
                    className="p-1 hover:bg-gray-700 rounded text-gray-400"
                    title="Edit"
                  >
                    {editingId === schedule.id ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Edit2 className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {/* Status & Next Run */}
                <div className="flex items-center justify-between text-xs">
                  <span className={`px-2 py-0.5 rounded ${
                    schedule.isEnabled 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {schedule.isEnabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className="text-gray-500">
                    {schedule.timezone}
                  </span>
                </div>

                {/* Next Run */}
                {schedule.isEnabled && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    Next: {formatNextRun(schedule.nextRunAt)}
                  </div>
                )}

                {/* Stats */}
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <span>{schedule.runCount} runs</span>
                  {schedule.failureCount > 0 && (
                    <span className="text-red-400">{schedule.failureCount} failures</span>
                  )}
                  <button
                    onClick={() => handleViewRecords(schedule)}
                    className="text-blue-400 hover:text-blue-300 ml-auto"
                  >
                    View History
                  </button>
                </div>
              </div>
            ))}

            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full px-4 py-2 border border-dashed border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300 rounded-lg text-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Schedule
              </button>
            )}
          </>
        )}
      </div>

      {/* Execution Records */}
      {selectedSchedule && (
        <div className="border-t border-gray-800 p-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-gray-400">
              Execution History - {selectedSchedule.name}
            </h4>
            <button
              onClick={() => handleViewRecords(selectedSchedule)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              {executionRecords.some(r => r.status === 'running') && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              Refresh
            </button>
          </div>
          {isLoadingRecords ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            </div>
          ) : executionRecords.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No executions yet</p>
          ) : (
            <div className="space-y-2">
              {executionRecords.map((record) => {
                const duration = record.completedAt && record.triggeredAt
                  ? Math.round((new Date(record.completedAt).getTime() - new Date(record.triggeredAt).getTime()) / 1000)
                  : record.triggeredAt && record.status === 'running'
                  ? Math.round((Date.now() - new Date(record.triggeredAt).getTime()) / 1000)
                  : null;

                return (
                  <div
                    key={record.id}
                    className="p-2 bg-gray-800/50 rounded text-xs cursor-pointer hover:bg-gray-700/50 transition-colors"
                    onClick={() => setViewingRecord(record)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">
                          {new Date(record.scheduledAt).toLocaleString()}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          record.triggerType === 'manual'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-cyan-500/20 text-cyan-400'
                        }`}>
                          {record.triggerType === 'manual' ? 'Manual' : 'Cron'}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${
                        record.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : record.status === 'failed'
                          ? 'bg-red-500/20 text-red-400'
                          : record.status === 'running'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {record.status === 'running' && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        {record.status}
                      </span>
                    </div>
                    {duration !== null && (
                      <div className="text-gray-500 mt-1">
                        {record.status === 'running' ? 'Running for' : 'Duration'}: {duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`}
                      </div>
                    )}
                    {record.errorMessage && (
                      <div className="text-red-400 mt-1 break-words">
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
      {/* Execution Log Modal */}
      {viewingRecord && (
        <ExecutionLogModal
          record={viewingRecord}
          onClose={() => setViewingRecord(null)}
        />
      )}
    </div>
  );
}

/**
 * Modal showing execution logs in a chat-like format
 */
function ExecutionLogModal({ record, onClose }: { record: ScheduleRecord; onClose: () => void }) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logs = (record.logs || []) as ScheduleExecutionLog[];

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Execution Log</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(record.scheduledAt).toLocaleString()} · <span className={
                record.status === 'completed' ? 'text-green-400'
                : record.status === 'failed' ? 'text-red-400'
                : record.status === 'running' ? 'text-blue-400'
                : 'text-gray-400'
              }>{record.status}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Log Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              {record.status === 'running' ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Waiting for events...
                </div>
              ) : (
                'No log events recorded'
              )}
            </div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-3">
                {/* Icon */}
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                  log.type === 'step_start' ? 'bg-blue-500/20 text-blue-400'
                  : log.type === 'step_complete' ? 'bg-green-500/20 text-green-400'
                  : log.type === 'step_failed' ? 'bg-red-500/20 text-red-400'
                  : log.type === 'error' ? 'bg-red-500/20 text-red-400'
                  : log.type === 'done' ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {log.type === 'step_start' && <Play className="w-3 h-3" />}
                  {log.type === 'step_complete' && <Check className="w-3 h-3" />}
                  {log.type === 'step_failed' && <AlertCircle className="w-3 h-3" />}
                  {log.type === 'error' && <AlertCircle className="w-3 h-3" />}
                  {log.type === 'done' && <Check className="w-3 h-3" />}
                  {log.type === 'log' && <Clock className="w-3 h-3" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-medium ${
                      log.type === 'step_start' ? 'text-blue-400'
                      : log.type === 'step_complete' ? 'text-green-400'
                      : log.type === 'step_failed' || log.type === 'error' ? 'text-red-400'
                      : log.type === 'done' ? 'text-green-400'
                      : 'text-gray-300'
                    }`}>
                      {log.type === 'step_start' && `▶ Starting: ${log.taskTitle || log.taskId || 'task'}`}
                      {log.type === 'step_complete' && `✓ Completed: ${log.taskTitle || log.taskId || 'task'}`}
                      {log.type === 'step_failed' && `✗ Failed: ${log.taskTitle || log.taskId || 'task'}`}
                      {log.type === 'error' && 'Error'}
                      {log.type === 'done' && '✓ Workflow completed'}
                      {log.type === 'log' && 'Agent'}
                    </span>
                    <span className="text-xs text-gray-600">{formatTime(log.timestamp)}</span>
                  </div>
                  {log.content && (
                    <div className={`text-xs leading-relaxed whitespace-pre-wrap break-words ${
                      log.type === 'error' || log.type === 'step_failed'
                        ? 'text-red-300 bg-red-500/10 p-2 rounded'
                        : 'text-gray-300 bg-gray-800/50 p-2 rounded'
                    }`}>
                      {log.content}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Footer */}
        {record.status === 'running' && (
          <div className="p-3 border-t border-gray-800 flex items-center gap-2 text-xs text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            Execution in progress — logs update automatically
          </div>
        )}
      </div>
    </div>
  );
}

export default SchedulePanel;
