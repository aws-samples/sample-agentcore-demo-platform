/**
 * DocumentUploader Component
 * 
 * Handles document upload for business scope creation context.
 * Supports drag-and-drop and click-to-select file input.
 * Validates file types and displays uploaded files list.
 * 
 * Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4
 */

import React, { useRef, useState, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  X, 
  AlertCircle
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { UploadedDocument } from '@/services/useBusinessScopeCreator';

// ============================================================================
// Types
// ============================================================================

export interface DocumentUploaderProps {
  /** List of uploaded documents */
  documents: UploadedDocument[];
  /** Callback when a document is added */
  onAddDocument: (file: File) => UploadedDocument | null;
  /** Callback when a document is removed */
  onRemoveDocument: (documentId: string) => void;
  /** Whether the uploader is disabled */
  disabled?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

const SUPPORTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'md'];

const FILE_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'text/plain': 'TXT',
  'text/markdown': 'MD',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets file extension from filename
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Checks if a file type is supported
 */
function isFileTypeSupported(file: File): boolean {
  const extension = getFileExtension(file.name);
  return SUPPORTED_FILE_TYPES.includes(file.type) || SUPPORTED_EXTENSIONS.includes(extension);
}

/**
 * Formats file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Gets file type label for display
 */
function getFileTypeLabel(file: UploadedDocument): string {
  if (FILE_TYPE_LABELS[file.type]) {
    return FILE_TYPE_LABELS[file.type];
  }
  const ext = getFileExtension(file.name).toUpperCase();
  return ext || 'FILE';
}

/**
 * Gets icon color based on file type
 */
function getFileIconColor(file: UploadedDocument): string {
  const ext = getFileExtension(file.name);
  switch (ext) {
    case 'pdf':
      return 'text-red-400';
    case 'doc':
    case 'docx':
      return 'text-blue-400';
    case 'txt':
      return 'text-gray-400';
    case 'md':
      return 'text-purple-400';
    default:
      return 'text-gray-400';
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

interface DocumentItemProps {
  document: UploadedDocument;
  onRemove: (id: string) => void;
  disabled?: boolean;
  t: (key: string) => string;
}

const DocumentItem: React.FC<DocumentItemProps> = ({ document, onRemove, disabled, t }) => {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700 group">
      {/* File Icon */}
      <div className={`flex-shrink-0 ${getFileIconColor(document)}`}>
        <FileText className="h-5 w-5" />
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate" title={document.name}>
          {document.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">
            {formatFileSize(document.size)}
          </span>
          <span className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded">
            {getFileTypeLabel(document)}
          </span>
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(document.id)}
        disabled={disabled}
        className={`
          p-1.5 rounded-lg transition-all flex-shrink-0
          ${disabled 
            ? 'text-gray-600 cursor-not-allowed' 
            : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
          }
        `}
        title={t('docUploader.removeDoc')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  documents,
  onAddDocument,
  onRemoveDocument,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || disabled) return;

    setError(null);
    const unsupportedFiles: string[] = [];

    Array.from(files).forEach(file => {
      if (isFileTypeSupported(file)) {
        const result = onAddDocument(file);
        if (!result) {
          unsupportedFiles.push(file.name);
        }
      } else {
        unsupportedFiles.push(file.name);
      }
    });

    if (unsupportedFiles.length > 0) {
      setError(t('docUploader.unsupportedType').replace('{files}', unsupportedFiles.join(', ')));
    }
  }, [onAddDocument, disabled, t]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
          ${disabled 
            ? 'border-gray-700 bg-gray-800/30 cursor-not-allowed' 
            : isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/30'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-3">
          <div 
            className={`
              w-12 h-12 rounded-full flex items-center justify-center
              ${disabled 
                ? 'bg-gray-700/50 text-gray-600' 
                : isDragging
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-700/50 text-gray-400'
              }
            `}
          >
            <Upload className="h-6 w-6" />
          </div>

          <div>
            <p className={`text-sm font-medium ${disabled ? 'text-gray-600' : 'text-gray-300'}`}>
              {isDragging ? t('docUploader.releaseToUpload') : t('docUploader.dropOrClick')}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t('docUploader.supportedFormats')}
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Uploaded Files List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {t('docUploader.uploadedCount').replace('{count}', String(documents.length))}
            </p>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {documents.map(doc => (
              <DocumentItem
                key={doc.id}
                document={doc}
                onRemove={onRemoveDocument}
                disabled={disabled}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Helper Text */}
      {documents.length === 0 && (
        <p className="text-xs text-gray-500 text-center">
          {t('docUploader.helperText')}
        </p>
      )}
    </div>
  );
};

export default DocumentUploader;
