import { useState } from 'react'
import { Server, Database, Rocket, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { Framework, Database as DatabaseType } from '@/types'

interface ToastState {
  show: boolean
  type: 'success' | 'error'
  message: string
}

interface FrameworkOption {
  id: Framework
  name: string
  description: string
  icon: React.ReactNode
}

interface DatabaseOption {
  id: DatabaseType
  name: string
  description: string
  icon: React.ReactNode
}

const frameworkOptions: FrameworkOption[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Open source Firebase alternative with PostgreSQL',
    icon: <Server className="w-8 h-8" />,
  },
  {
    id: 'railway',
    name: 'Railway',
    description: 'Infrastructure platform for deploying apps',
    icon: <Server className="w-8 h-8" />,
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Platform for frontend frameworks and static sites',
    icon: <Server className="w-8 h-8" />,
  },
]

const databaseOptions: DatabaseOption[] = [
  {
    id: 'aurora',
    name: 'Aurora PostgreSQL',
    description: 'AWS managed PostgreSQL-compatible database',
    icon: <Database className="w-8 h-8" />,
  },
  {
    id: 'pgvector',
    name: 'PG Vector',
    description: 'PostgreSQL extension for vector similarity search',
    icon: <Database className="w-8 h-8" />,
  },
  {
    id: 'neon',
    name: 'Neon Serverless',
    description: 'Serverless PostgreSQL with branching',
    icon: <Database className="w-8 h-8" />,
  },
]

export function InfrastructureConfigurator() {
  const { t } = useTranslation()
  const [selectedFramework, setSelectedFramework] = useState<Framework | null>(null)
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseType | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)
  const [toast, setToast] = useState<ToastState>({ show: false, type: 'success', message: '' })

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }

  const canDeploy = selectedFramework !== null && selectedDatabase !== null

  const handleDeploy = async () => {
    if (!canDeploy) return

    const confirmed = window.confirm(
      `Are you sure you want to deploy with ${frameworkOptions.find(f => f.id === selectedFramework)?.name} and ${databaseOptions.find(d => d.id === selectedDatabase)?.name}?`
    )

    if (!confirmed) return

    setIsDeploying(true)

    try {
      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 2000))
      showToast('success', 'Deployment initiated successfully')
    } catch {
      showToast('error', 'Failed to initiate deployment')
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-950">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg transition-all ${
          toast.type === 'success' 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{t('infra.title')}</h1>
            <p className="text-sm text-gray-400">{t('infra.subtitle') || 'Configure deployment infrastructure for your agents'}</p>
          </div>
          <button
            onClick={handleDeploy}
            disabled={!canDeploy || isDeploying}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white transition-colors ${
              canDeploy && !isDeploying
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-700 cursor-not-allowed opacity-50'
            }`}
          >
            {isDeploying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            <span>{t('infra.deploy')}</span>
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl">
        {/* Framework Selection */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" />
            {t('infra.framework')}
          </h2>
          <p className="text-sm text-gray-400 mb-4">{t('infra.selectFramework')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {frameworkOptions.map(option => (
              <SelectionCard
                key={option.id}
                name={option.name}
                description={option.description}
                icon={option.icon}
                isSelected={selectedFramework === option.id}
                onClick={() => setSelectedFramework(option.id)}
              />
            ))}
          </div>
        </section>

        {/* Database Selection */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-green-400" />
            {t('infra.database')}
          </h2>
          <p className="text-sm text-gray-400 mb-4">{t('infra.selectDatabase')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {databaseOptions.map(option => (
              <SelectionCard
                key={option.id}
                name={option.name}
                description={option.description}
                icon={option.icon}
                isSelected={selectedDatabase === option.id}
                onClick={() => setSelectedDatabase(option.id)}
              />
            ))}
          </div>
        </section>

        {/* Selection Summary */}
        {(selectedFramework || selectedDatabase) && (
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-white mb-4">{t('infra.summary') || 'Configuration Summary'}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">{t('infra.framework')}:</span>
                <span className="text-white font-medium">
                  {selectedFramework 
                    ? frameworkOptions.find(f => f.id === selectedFramework)?.name 
                    : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">{t('infra.database')}:</span>
                <span className="text-white font-medium">
                  {selectedDatabase 
                    ? databaseOptions.find(d => d.id === selectedDatabase)?.name 
                    : '-'}
                </span>
              </div>
            </div>
            {!canDeploy && (
              <p className="mt-4 text-sm text-amber-400">
                {t('infra.selectBoth') || 'Please select both a framework and database to deploy'}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

interface SelectionCardProps {
  name: string
  description: string
  icon: React.ReactNode
  isSelected: boolean
  onClick: () => void
}

function SelectionCard({ name, description, icon, isSelected, onClick }: SelectionCardProps) {
  return (
    <button
      onClick={onClick}
      className={`relative p-6 rounded-lg border-2 text-left transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-gray-700 bg-gray-900 hover:border-gray-600 hover:bg-gray-800/50'
      }`}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3">
          <CheckCircle className="w-5 h-5 text-blue-500" />
        </div>
      )}
      
      <div className={`mb-4 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`}>
        {icon}
      </div>
      
      <h3 className={`text-lg font-semibold mb-2 ${isSelected ? 'text-white' : 'text-gray-200'}`}>
        {name}
      </h3>
      
      <p className="text-sm text-gray-400">
        {description}
      </p>
    </button>
  )
}
