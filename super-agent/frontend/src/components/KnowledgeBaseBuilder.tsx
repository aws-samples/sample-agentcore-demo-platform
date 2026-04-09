import { useState } from 'react'
import { Plus, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { KnowledgeBaseConfig, VectorDatabase } from '@/types'

interface KnowledgeBaseBuilderProps {
  onCreateKnowledgeBase: (config: KnowledgeBaseConfig) => Promise<void>
}

interface FormState {
  name: string
  vectorDatabase: VectorDatabase | ''
  databaseEndpoint: string
  storageUri: string
}

interface ToastState {
  show: boolean
  type: 'success' | 'error'
  message: string
}

interface ValidationErrors {
  [key: string]: string
}

export function KnowledgeBaseBuilder({ onCreateKnowledgeBase }: KnowledgeBaseBuilderProps) {
  const { t } = useTranslation()

  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [toast, setToast] = useState<ToastState>({ show: false, type: 'success', message: '' })
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  const [form, setForm] = useState<FormState>({
    name: '',
    vectorDatabase: '',
    databaseEndpoint: '',
    storageUri: '',
  })

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {}

    if (!form.name.trim()) {
      errors.name = 'Knowledge base name is required'
    }

    if (!form.vectorDatabase) {
      errors.vectorDatabase = 'Vector database selection is required'
    }

    if (!form.storageUri.trim()) {
      errors.storageUri = 'S3 storage URI is required'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const resetForm = () => {
    setForm({
      name: '',
      vectorDatabase: '',
      databaseEndpoint: '',
      storageUri: '',
    })
    setValidationErrors({})
  }

  const handleCreate = async () => {
    if (!validateForm()) {
      showToast('error', 'Please fix validation errors')
      return
    }

    setIsCreating(true)

    try {
      await onCreateKnowledgeBase({
        name: form.name,
        componentType: 'bedrock',
        componentId: `kb-${Date.now()}`,
        vectorDatabase: form.vectorDatabase as VectorDatabase,
        databaseEndpoint: form.databaseEndpoint,
        storageUri: form.storageUri,
      })

      showToast('success', 'Knowledge base created successfully')
      setIsOpen(false)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create knowledge base'
      showToast('error', message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))
    // Clear error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  return (
    <>
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

      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>{t('knowledge.createKb')}</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{t('knowledge.createKb')}</h2>
              <button
                onClick={() => {
                  setIsOpen(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <FormField 
                label={t('knowledge.title') || 'Knowledge Base Name'}
                error={validationErrors.name}
              >
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-4 py-2 bg-gray-800 border rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                    validationErrors.name ? 'border-red-500' : 'border-gray-700'
                  }`}
                  placeholder="e.g., Company Knowledge Base"
                />
              </FormField>

              {/* Vector Database */}
              <FormField 
                label={t('knowledge.vectorDb')}
                error={validationErrors.vectorDatabase}
              >
                <select
                  value={form.vectorDatabase}
                  onChange={(e) => handleInputChange('vectorDatabase', e.target.value)}
                  className={`w-full px-4 py-2 bg-gray-800 border rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                    validationErrors.vectorDatabase ? 'border-red-500' : 'border-gray-700'
                  }`}
                >
                  <option value="">Select a vector database</option>
                  <option value="aurora">Aurora PostgreSQL</option>
                  <option value="opensearch">Amazon OpenSearch</option>
                  <option value="pgvector">PG Vector</option>
                </select>
              </FormField>

              {/* Database Endpoint */}
              <FormField label={t('knowledge.databaseEndpoint') || 'Database Endpoint'}>
                <input
                  type="text"
                  value={form.databaseEndpoint}
                  onChange={(e) => handleInputChange('databaseEndpoint', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                  placeholder="e.g., db.example.com:5432"
                />
              </FormField>

              {/* S3 Storage URI */}
              <FormField 
                label={t('knowledge.storageUri')}
                error={validationErrors.storageUri}
              >
                <input
                  type="text"
                  value={form.storageUri}
                  onChange={(e) => handleInputChange('storageUri', e.target.value)}
                  className={`w-full px-4 py-2 bg-gray-800 border rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                    validationErrors.storageUri ? 'border-red-500' : 'border-gray-700'
                  }`}
                  placeholder="e.g., s3://my-bucket/knowledge-base"
                />
              </FormField>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>{t('common.create')}</span>
                </button>

                <button
                  onClick={() => {
                    setIsOpen(false)
                    resetForm()
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface FormFieldProps {
  label: string
  error?: string
  children: React.ReactNode
}

function FormField({ label, error, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  )
}
