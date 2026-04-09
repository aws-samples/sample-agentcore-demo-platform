import { Eye } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { AgentCell } from './AgentCell'
import type { Task } from '@/types'

interface TaskTableProps {
  tasks: Task[]
  onViewDetails?: (taskId: string) => void
}

const statusConfig = {
  complete: { bg: 'bg-green-500/10', text: 'text-green-400', label: 'tasks.status.complete' },
  running: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'tasks.status.running' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'tasks.status.failed' },
}

function formatTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

export function TaskTable({ tasks, onViewDetails }: TaskTableProps) {
  const { t } = useTranslation()

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-gray-400 mb-2">{t('common.loading')}</p>
        <p className="text-sm text-gray-500">No tasks found</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/50">
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t('tasks.agent')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t('tasks.description')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t('tasks.workflow')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t('tasks.status')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t('tasks.time')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {t('tasks.action')}
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const statusStyle = statusConfig[task.status]
            return (
              <tr
                key={task.id}
                className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
              >
                {/* Agent Cell */}
                <td className="px-6 py-4">
                  <AgentCell agent={task.agent} />
                </td>

                {/* Description */}
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-300 max-w-xs truncate">{task.description}</p>
                </td>

                {/* Workflow */}
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-400">{task.workflow}</p>
                </td>

                {/* Status */}
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                    {t(statusStyle.label)}
                  </span>
                </td>

                {/* Time */}
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-400">{formatTime(task.timestamp)}</p>
                </td>

                {/* Action */}
                <td className="px-6 py-4">
                  <button
                    onClick={() => onViewDetails?.(task.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{t('tasks.viewDetails')}</span>
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
