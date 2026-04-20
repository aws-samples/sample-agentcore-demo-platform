import { useState } from 'react';
import { Loader2, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMyTokenUsage, useOrganizationTokenUsage } from '@/services/useTokenUsage';
import { useTranslation } from '@/i18n';
import type { MonthlyUsage } from '@/services/api/tokenUsageService';

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function UsageBar({ used, label }: { used: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-16 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${Math.min(100, (used / Math.max(used, 1)) * 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-300 w-16 shrink-0">{formatTokens(used)}</span>
    </div>
  );
}

function UsageTable({ rows, t }: { rows: MonthlyUsage[]; t: (key: string) => string }) {
  if (rows.length === 0) {
    return <div className="text-center py-8 text-gray-500 text-sm">{t('tokenUsage.noData')}</div>;
  }

  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-800/40">
            {rows[0]?.userName !== undefined && (
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">{t('tokenUsage.colUser')}</th>
            )}
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">{t('tokenUsage.colInput')}</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">{t('tokenUsage.colOutput')}</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">{t('tokenUsage.colTotal')}</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">{t('tokenUsage.colCost')}</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">{t('tokenUsage.colCalls')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {rows.map((row, i) => (
            <tr key={row.userId + row.month + i} className="hover:bg-gray-800/30 transition-colors">
              {row.userName !== undefined && (
                <td className="px-4 py-3">
                  <div>
                    <div className="text-white font-medium">{row.userName || row.email || 'Unknown'}</div>
                    {row.email && row.userName && (
                      <div className="text-xs text-gray-500">{row.email}</div>
                    )}
                  </div>
                </td>
              )}
              <td className="px-4 py-3 text-gray-300">{formatTokens(row.inputTokens)}</td>
              <td className="px-4 py-3 text-gray-300">{formatTokens(row.outputTokens)}</td>
              <td className="px-4 py-3 text-white font-medium">{formatTokens(row.totalTokens)}</td>
              <td className="px-4 py-3 text-green-400">{formatCost(row.totalCostUsd)}</td>
              <td className="px-4 py-3 text-gray-300">{row.invocationCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthSelector({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const d = new Date(month + '-01');
  const prev = () => {
    d.setMonth(d.getMonth() - 1);
    onChange(d.toISOString().slice(0, 7));
  };
  const next = () => {
    d.setMonth(d.getMonth() + 1);
    const now = new Date().toISOString().slice(0, 7);
    const candidate = d.toISOString().slice(0, 7);
    if (candidate <= now) onChange(candidate);
  };
  const isCurrentMonth = month === new Date().toISOString().slice(0, 7);

  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="p-1 hover:bg-gray-700 rounded text-gray-400">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-300 w-20 text-center">{month}</span>
      <button
        onClick={next}
        disabled={isCurrentMonth}
        className="p-1 hover:bg-gray-700 rounded text-gray-400 disabled:opacity-30"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

interface Props {
  isAdmin: boolean;
}

export function TokenUsageTab({ isAdmin }: Props) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const { t } = useTranslation();

  const myUsage = useMyTokenUsage(6);
  const orgUsage = useOrganizationTokenUsage(selectedMonth);

  const currentMonthUsage = myUsage.data.find((r) => r.month === currentMonth);

  return (
    <div className="space-y-8">
      {/* My Usage Summary */}
      <div>
        <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          {t('tokenUsage.myUsage')}
        </h3>
        {myUsage.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          </div>
        ) : currentMonthUsage ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">{t('tokenUsage.inputTokens')}</div>
              <div className="text-lg text-white font-semibold">{formatTokens(currentMonthUsage.inputTokens)}</div>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">{t('tokenUsage.outputTokens')}</div>
              <div className="text-lg text-white font-semibold">{formatTokens(currentMonthUsage.outputTokens)}</div>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">{t('tokenUsage.totalTokens')}</div>
              <div className="text-lg text-white font-semibold">{formatTokens(currentMonthUsage.totalTokens)}</div>
            </div>
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <div className="text-xs text-gray-400 mb-1">{t('tokenUsage.estCost')}</div>
              <div className="text-lg text-green-400 font-semibold">{formatCost(currentMonthUsage.totalCostUsd)}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 py-4">{t('tokenUsage.noUsage')}</div>
        )}

        {/* My history */}
        {myUsage.data.length > 0 && (
          <div>
            <h4 className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('tokenUsage.monthlyHistory')}</h4>
            <div className="space-y-2">
              {myUsage.data.map((row) => (
                <div key={row.month} className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400 w-20 shrink-0">{row.month}</span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (row.totalTokens / Math.max(...myUsage.data.map((r) => r.totalTokens), 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-gray-300 w-16 text-right shrink-0">{formatTokens(row.totalTokens)}</span>
                  <span className="text-green-400 w-20 text-right shrink-0">{formatCost(row.totalCostUsd)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Organization Usage (Admin/Owner only) */}
      {isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              {t('tokenUsage.orgUsage')}
            </h3>
            <MonthSelector month={selectedMonth} onChange={setSelectedMonth} />
          </div>
          {orgUsage.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            </div>
          ) : (
            <UsageTable rows={orgUsage.data} t={t} />
          )}
        </div>
      )}
    </div>
  );
}
