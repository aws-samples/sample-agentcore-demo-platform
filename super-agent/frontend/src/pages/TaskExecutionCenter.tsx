import { useState, useEffect } from 'react'
import { ArrowLeft, ShieldCheck, Play, CheckCircle, Clock, Loader2, FileText, Bot } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from '@/i18n'

// Types
interface AgentExecution {
  id: string
  name: string
  avatar?: string
  status: 'done' | 'processing' | 'pending'
  task: string
}

interface TaskGroup {
  id: string
  title: string
  icon: string
  iconColor: string
  startedAt: string
  workflow: string
  status: 'running' | 'success' | 'failed'
  progress: number
  agents: AgentExecution[]
}

// Mock data
const MOCK_TASK_GROUPS: TaskGroup[] = [
  {
    id: '1',
    title: 'Tech Recruitment Pipeline',
    icon: 'user-plus',
    iconColor: '#FF9F43',
    startedAt: '2h ago',
    workflow: 'Hiring v2.4',
    status: 'running',
    progress: 66,
    agents: [
      { id: 'a1', name: 'Aria', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Aria', status: 'done', task: 'Sourcing Candidates' },
      { id: 'a2', name: 'Marcus', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Marcus', status: 'processing', task: 'Reviewing Feedback' },
      { id: 'a3', name: 'Echo v2', status: 'pending', task: 'Awaiting Approval' },
    ]
  },
  {
    id: '2',
    title: 'Infrastructure Health Audit',
    icon: 'server',
    iconColor: '#00D2D3',
    startedAt: '15m ago',
    workflow: 'Security Sweep',
    status: 'success',
    progress: 100,
    agents: [
      { id: 'a4', name: 'Atlas', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Atlas', status: 'done', task: 'Nodes Inspected' },
      { id: 'a5', name: 'Shell Bot', status: 'done', task: 'Logs Analyzed' },
    ]
  },
  {
    id: '3',
    title: 'Q4 Budget Optimization',
    icon: 'chart-line',
    iconColor: '#FF6B6B',
    startedAt: '5m ago',
    workflow: 'Finance Auto-Ops',
    status: 'running',
    progress: 25,
    agents: [
      { id: 'a6', name: 'Finance Bot', status: 'processing', task: 'Analyzing Spend' },
      { id: 'a7', name: 'Marcus', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Marcus', status: 'pending', task: 'Pending Review' },
    ]
  }
]

// Components
function StatusBadge({ status }: { status: TaskGroup['status'] }) {
  const { t } = useTranslation()
  
  const config = {
    running: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', label: t('taskExec.status.running') },
    success: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', label: t('taskExec.status.success') },
    failed: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: t('taskExec.status.failed') },
  }
  
  const { bg, text, border, label } = config[status]
  
  return (
    <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${bg} ${text} border ${border}`}>
      {label}
    </span>
  )
}

function AgentStatusDot({ status }: { status: AgentExecution['status'] }) {
  const config = {
    done: 'bg-green-400 shadow-green-400/50',
    processing: 'bg-yellow-400 shadow-yellow-400/50 animate-pulse',
    pending: 'bg-gray-500',
  }
  
  return (
    <div className={`w-2 h-2 rounded-full ${config[status]} ${status !== 'pending' ? 'shadow-lg' : ''}`} />
  )
}

function AgentExecutionCard({ agent }: { agent: AgentExecution }) {
  const { t } = useTranslation()
  
  const statusText = {
    done: 'text-green-400',
    processing: 'text-yellow-400',
    pending: 'text-gray-500',
  }
  
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:border-white/10 transition-colors">
      {agent.avatar ? (
        <img src={agent.avatar} alt={agent.name} className="w-11 h-11 rounded-xl object-cover" />
      ) : (
        <div className="w-11 h-11 rounded-xl bg-purple-600 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-white truncate">{agent.name}</h4>
        <div className={`text-xs flex items-center gap-1.5 mt-1 ${statusText[agent.status]}`}>
          <AgentStatusDot status={agent.status} />
          <span>{agent.task}</span>
        </div>
      </div>
      
      {agent.status === 'done' && (
        <CheckCircle className="w-5 h-5 text-green-400" />
      )}
      {agent.status === 'processing' && (
        <button className="px-3 py-1.5 text-xs border border-white/10 text-gray-400 rounded-lg hover:text-white hover:border-purple-500 hover:bg-purple-500/10 transition-colors">
          {t('taskExec.logs')}
        </button>
      )}
    </div>
  )
}

function TaskGroupCard({ task }: { task: TaskGroup }) {
  const { t } = useTranslation()
  
  const progressColor = task.status === 'success' ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-cyan-400'
  
  return (
    <div className="bg-gray-900/40 border border-white/[0.08] rounded-2xl p-6 backdrop-blur-xl hover:border-purple-500/30 hover:bg-gray-900/60 transition-all hover:-translate-y-0.5">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-3 mb-2">
            <span style={{ color: task.iconColor }}>
              {task.icon === 'user-plus' && <Play className="w-5 h-5" />}
              {task.icon === 'server' && <ShieldCheck className="w-5 h-5" />}
              {task.icon === 'chart-line' && <FileText className="w-5 h-5" />}
            </span>
            {task.title}
          </h2>
          <div className="flex items-center gap-5 text-gray-500 text-sm">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {t('taskExec.started')} {task.startedAt}
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {t('taskExec.workflow')}: {task.workflow}
            </span>
            <StatusBadge status={task.status} />
          </div>
        </div>
        
        {/* Progress */}
        <div className="w-60 text-right">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>{t('taskExec.progress')}</span>
            <span>{task.progress}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${progressColor} shadow-lg`}
              style={{ width: `${task.progress}%`, transition: 'width 1s ease-in-out' }}
            />
          </div>
        </div>
      </div>
      
      {/* Agents Grid */}
      <div className="border-t border-white/[0.06] pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {task.agents.map(agent => (
            <AgentExecutionCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function TaskExecutionCenter() {
  const { t } = useTranslation()
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setTaskGroups(MOCK_TASK_GROUPS)
      setIsLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <header className="flex-shrink-0 h-[70px] bg-gray-950/85 backdrop-blur-xl border-b border-white/[0.08] px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/" 
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold text-white">{t('taskExec.title')}</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            {t('taskExec.allSystemsNominal')}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-8 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : taskGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Play className="w-12 h-12 mb-4 opacity-50" />
              <p>{t('taskExec.noTasks')}</p>
            </div>
          ) : (
            taskGroups.map(task => (
              <TaskGroupCard key={task.id} task={task} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
