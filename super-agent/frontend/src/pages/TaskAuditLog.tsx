import { useState, useEffect } from 'react'
import { ClipboardList, Download, Filter, Loader2 } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useTasks } from '@/services'
import { TaskTable } from '@/components'
import type { TaskFilters } from '@/types'

export function TaskAuditLog() {
  const { t } = useTranslation()
  const { tasks, isLoading, error, getTasks, getTasksFiltered, exportToCSV } = useTasks()
  
  const [, setFilters] = useState<TaskFilters>({})
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false)

  // Load tasks on mount
  useEffect(() => {
    getTasks()
  }, [getTasks])

  // Get unique agents from tasks for filter dropdown
  const uniqueAgents = Array.from(
    new Map(tasks.map(task => [task.agent.id, task.agent])).values()
  )

  const handleAgentFilterChange = async (agentId: string) => {
    setSelectedAgentId(agentId)
    
    if (agentId === '') {
      setFilters({})
      await getTasks()
    } else {
      const newFilters: TaskFilters = { agentId }
      setFilters(newFilters)
      await getTasksFiltered(newFilters)
    }
  }

  const handleExportCSV = async () => {
    setIsExporting(true)
    try {
      const csv = await exportToCSV(tasks)
      if (csv) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        
        link.setAttribute('href', url)
        link.setAttribute('download', `tasks-${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } finally {
      setIsExporting(false)
    }
  }

  const handleViewDetails = (taskId: string) => {
    console.log('View details for task:', taskId)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => getTasks()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-400" />
            {t('taskAudit.title')}
          </h1>
          
          <button
            onClick={handleExportCSV}
            disabled={isExporting || tasks.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('common.loading')}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>{t('tasks.exportCsv')}</span>
              </>
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedAgentId}
            onChange={(e) => handleAgentFilterChange(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="">{t('tasks.filterByAgent')}</option>
            {uniqueAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <TaskTable tasks={tasks} onViewDetails={handleViewDetails} />
          </div>
        )}
      </div>
    </div>
  )
}
