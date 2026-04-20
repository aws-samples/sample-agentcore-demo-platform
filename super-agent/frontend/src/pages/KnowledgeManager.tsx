import { useState, useRef } from 'react'
import { Upload, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useKnowledge } from '@/services'
import { DocumentList, KnowledgeBaseBuilder } from '@/components'
import type { DocumentUpload } from '@/types'

interface FormState {
  title: string
  category: string
}

interface ToastState {
  show: boolean
  type: 'success' | 'error'
  message: string
}

interface ValidationErrors {
  [key: string]: string
}

export function KnowledgeManager() {
  const { t } = useTranslation()
  const { documents, isLoading, error, uploadDocument, deleteDocument, createKnowledgeBase, syncAll, getSupportedFileTypes } = useKnowledge()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [toast, setToast] = useState<ToastState>({ show: false, type: 'success', message: '' })
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  const [form, setForm] = useState<FormState>({
    title: '',
    category: '',
  })

  const supportedFileTypes = getSupportedFileTypes()

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }

  const validateForm = (file: File): boolean => {
    const errors: ValidationErrors = {}

    if (!form.title.trim()) {
      errors.title = t('knowledge.titleRequired')
    }

    if (!form.category.trim()) {
      errors.category = t('knowledge.categoryRequired')
    }

    if (!file) {
      errors.file = t('knowledge.fileRequired')
    } else {
      const fileExtension = file.name.split('.').pop()?.toUpperCase()
      if (!supportedFileTypes.includes(fileExtension as any)) {
        errors.file = t('knowledge.unsupportedType').replace('{types}', supportedFileTypes.join(', '))
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const resetForm = () => {
    setForm({
      title: '',
      category: '',
    })
    setValidationErrors({})
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!validateForm(file)) {
      showToast('error', t('knowledge.fixErrors'))
      return
    }

    setIsUploading(true)

    try {
      const upload: DocumentUpload = {
        title: form.title,
        category: form.category,
        file,
      }

      await uploadDocument(upload)
      showToast('success', t('knowledge.uploadSuccess'))
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('knowledge.uploadFailed')
      showToast('error', message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocument(id)
      showToast('success', t('knowledge.deleteSuccess'))
    } catch (err) {
      const message = err instanceof Error ? err.message : t('knowledge.deleteFailed')
      showToast('error', message)
    }
  }

  const handleSyncAll = async () => {
    setIsSyncing(true)
    try {
      await syncAll()
      showToast('success', t('knowledge.syncSuccess'))
    } catch (err) {
      const message = err instanceof Error ? err.message : t('knowledge.syncFailed')
      showToast('error', message)
    } finally {
      setIsSyncing(false)
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
            <h1 className="text-xl font-bold text-white">{t('knowledge.title')}</h1>
            <p className="text-sm text-gray-400">{t('knowledge.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncAll}
              disabled={isSyncing || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>{t('knowledge.sync')}</span>
            </button>
            <KnowledgeBaseBuilder onCreateKnowledgeBase={createKnowledgeBase} />
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-700 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Upload Section */}
        <div className="mb-8 bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">{t('knowledge.upload')}</h2>

          <div className="space-y-4">
            {/* Title Input */}
            <FormField 
              label={t('knowledge.documentTitle')}
              error={validationErrors.title}
            >
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className={`w-full px-4 py-2 bg-gray-800 border rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                  validationErrors.title ? 'border-red-500' : 'border-gray-700'
                }`}
                placeholder={t('knowledge.titlePlaceholder')}
              />
            </FormField>

            {/* Category Input */}
            <FormField 
              label={t('knowledge.category')}
              error={validationErrors.category}
            >
              <input
                type="text"
                value={form.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className={`w-full px-4 py-2 bg-gray-800 border rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${
                  validationErrors.category ? 'border-red-500' : 'border-gray-700'
                }`}
                placeholder={t('knowledge.categoryPlaceholder')}
              />
            </FormField>

            {/* File Upload */}
            <FormField 
              label={t('knowledge.fileType')}
              error={validationErrors.file}
            >
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  accept={supportedFileTypes.map(type => {
                    switch (type) {
                      case 'PDF':
                        return '.pdf'
                      case 'TXT':
                        return '.txt'
                      case 'MD':
                        return '.md'
                      case 'DOCX':
                        return '.docx'
                      default:
                        return ''
                    }
                  }).join(',')}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg transition-colors ${
                    isUploading
                      ? 'border-gray-600 bg-gray-800/50 cursor-not-allowed'
                      : 'border-gray-600 hover:border-blue-500 hover:bg-gray-800/50'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      <span className="text-gray-300">{t('knowledge.uploading')}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-300">{t('knowledge.clickToSelect')}</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {t('knowledge.supportedFormats')}
              </p>
            </FormField>
          </div>
        </div>

        {/* Documents Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">
              {t('knowledge.documents')} ({documents.length})
            </h2>
          </div>
          <div className="p-6">
            <DocumentList 
              documents={documents}
              isLoading={isLoading}
              onDelete={handleDeleteDocument}
            />
          </div>
        </div>
      </div>
    </div>
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
