import { Trash2, FileText, Loader2 } from 'lucide-react'
import { useTranslation } from '@/i18n'
import type { KnowledgeDocument } from '@/types'

interface DocumentListProps {
  documents: KnowledgeDocument[]
  isLoading: boolean
  onDelete: (id: string) => void
}

export function DocumentList({ documents, isLoading, onDelete }: DocumentListProps) {
  const { t } = useTranslation()

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'indexed':
        return 'bg-green-900/20 text-green-300 border-green-700'
      case 'processing':
        return 'bg-blue-900/20 text-blue-300 border-blue-700'
      case 'error':
        return 'bg-red-900/20 text-red-300 border-red-700'
      default:
        return 'bg-gray-700/20 text-gray-300 border-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />
      default:
        return null
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      onDelete(id)
    }
  }

  if (isLoading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">{t('knowledge.noDocuments') || 'No documents uploaded yet'}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {t('knowledge.documentTitle')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {t('knowledge.category')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {t('knowledge.fileName')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {t('knowledge.fileType')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {t('knowledge.uploadTime')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {t('knowledge.indexingStatus')}
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {t('common.action')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {documents.map(doc => (
            <tr key={doc.id} className="hover:bg-gray-800/50 transition-colors">
              <td className="px-6 py-4 text-sm text-white font-medium">{doc.title}</td>
              <td className="px-6 py-4 text-sm text-gray-300">{doc.category}</td>
              <td className="px-6 py-4 text-sm text-gray-400 truncate max-w-xs" title={doc.fileName}>
                {doc.fileName}
              </td>
              <td className="px-6 py-4 text-sm text-gray-300">
                <span className="px-2 py-1 bg-gray-800 rounded text-xs font-medium">
                  {doc.fileType}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-400">
                {formatDate(doc.uploadTime)}
              </td>
              <td className="px-6 py-4 text-sm">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(doc.status)}`}>
                  {getStatusIcon(doc.status)}
                  <span className="text-xs font-medium capitalize">
                    {doc.status === 'indexed' && t('knowledge.status.indexed')}
                    {doc.status === 'processing' && t('knowledge.status.processing')}
                    {doc.status === 'error' && t('knowledge.status.error')}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm">
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="inline-flex items-center gap-2 px-3 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                  title="Delete document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
