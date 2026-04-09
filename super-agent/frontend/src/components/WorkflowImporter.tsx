import { useState, useCallback, useRef } from 'react'
import { Upload, Image, X, Loader2, Check, Bot, ArrowRight } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { WorkflowImportResult } from '@/types'

interface WorkflowImporterProps {
  onImport: (file: File) => Promise<WorkflowImportResult | null>
  onAcceptImport: (result: WorkflowImportResult) => void
  onCancel: () => void
}

export function WorkflowImporter({ onImport, onAcceptImport, onCancel }: WorkflowImporterProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<WorkflowImportResult | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(t('workflow.import.invalidFileType'))
      return
    }

    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setError(null)
    setIsProcessing(true)

    try {
      const result = await onImport(file)
      if (result) {
        setImportResult(result)
      } else {
        setError(t('workflow.import.processingError'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('workflow.import.processingError'))
    } finally {
      setIsProcessing(false)
    }
  }, [onImport, t])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      void handleFile(file)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void handleFile(file)
    }
  }, [handleFile])

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleAccept = useCallback(() => {
    if (importResult) {
      onAcceptImport(importResult)
    }
  }, [importResult, onAcceptImport])

  const handleReset = useCallback(() => {
    setImportResult(null)
    setPreviewUrl(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Image className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-medium text-white">{t('workflow.import.title')}</h3>
        </div>
        <button
          onClick={onCancel}
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {!importResult ? (
        <>
          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
              }
              ${isProcessing ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            `}
            onClick={handleBrowseClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Upload image"
            />

            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                <p className="text-sm text-gray-400">{t('workflow.import.analyzing')}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-300">{t('workflow.import.dropzone')}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('workflow.import.supportedFormats')}</p>
                </div>
              </div>
            )}

            {previewUrl && !importResult && (
              <div className="mt-4">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-32 mx-auto rounded-lg border border-gray-600"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}
        </>
      ) : (
        <>
          {/* Import Results */}
          <div className="space-y-4">
            {/* Preview Image */}
            {previewUrl && (
              <div className="flex justify-center">
                <img
                  src={previewUrl}
                  alt="Uploaded flowchart"
                  className="max-h-40 rounded-lg border border-gray-600"
                />
              </div>
            )}

            {/* Detected Agents */}
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-green-400" />
                <h4 className="text-sm font-medium text-white">{t('workflow.import.detectedAgents')}</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {importResult.detectedAgents.map((agent, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full"
                  >
                    {agent}
                  </span>
                ))}
              </div>
            </div>

            {/* Detected Flow */}
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight className="w-4 h-4 text-blue-400" />
                <h4 className="text-sm font-medium text-white">{t('workflow.import.detectedFlow')}</h4>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {importResult.detectedFlow.map((step, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-md">
                      {step}
                    </span>
                    {index < importResult.detectedFlow.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                {t('workflow.import.tryAnother')}
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm"
              >
                <Check className="w-4 h-4" />
                {t('workflow.import.accept')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
