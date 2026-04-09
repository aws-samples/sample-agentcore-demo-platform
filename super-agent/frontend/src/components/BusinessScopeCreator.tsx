/**
 * BusinessScopeCreator Component
 * 
 * Main modal component for creating new business scopes with AI-powered
 * agent generation. Orchestrates the entire creation workflow including
 * input, generation, preview, customization, and saving steps.
 * 
 * Requirements: 1.1, 1.3, 1.4, 5.4, 5.5, 5.5.4, 8.1, 8.2
 */

import React, { useEffect, useCallback, useState } from 'react';
import { 
  X, 
  Sparkles, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Loader2,
  ChevronRight,
  Palette
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useBusinessScopeCreator } from '@/services/useBusinessScopeCreator';
import { GenerationProgress } from './GenerationProgress';
import { AgentPreviewCard } from './AgentPreviewCard';
import { DocumentUploader } from './DocumentUploader';
import { BusinessScopeCustomizer } from './BusinessScopeCustomizer';
import type { BusinessScope } from '@/services/businessScopeService';

// ============================================================================
// Types
// ============================================================================

export interface BusinessScopeCreatorProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when business scope is successfully created */
  onSuccess?: (businessScope: BusinessScope) => void;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-gray-800 rounded-xl p-6 max-w-sm mx-4 border border-gray-700 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-2">
          {t('businessScope.confirmCancel')}
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          {t('businessScope.cancelWarning')}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            {t('businessScope.continueGeneration')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            {t('businessScope.confirmCancelBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const BusinessScopeCreator: React.FC<BusinessScopeCreatorProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const {
    state,
    validateName,
    addDocument,
    removeDocument,
    toggleAgentRemoval,
    getSelectedAgents,
    startGeneration,
    cancelGeneration,
    setCustomization,
    saveBusinessScope,
    reset,
    setStep,
    setBusinessScopeName,
  } = useBusinessScopeCreator();

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, state.step]);

  const handleClose = useCallback(() => {
    if (state.step === 'generating') {
      setShowConfirmDialog(true);
    } else {
      reset();
      onClose();
    }
  }, [state.step, reset, onClose]);

  const handleConfirmClose = useCallback(() => {
    cancelGeneration();
    setShowConfirmDialog(false);
    reset();
    onClose();
  }, [cancelGeneration, reset, onClose]);

  const handleCancelClose = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!state.businessScopeName.trim()) return;

    setIsValidating(true);
    const validation = await validateName(state.businessScopeName);
    setIsValidating(false);

    if (!validation.isValid) {
      return;
    }

    await startGeneration(state.businessScopeName);
  }, [state.businessScopeName, validateName, startGeneration]);

  const handleRegenerate = useCallback(() => {
    setStep('input');
  }, [setStep]);

  const handleProceedToCustomize = useCallback(() => {
    setStep('customizing');
  }, [setStep]);

  const handleBackToPreview = useCallback(() => {
    setStep('preview');
  }, [setStep]);

  const handleSave = useCallback(async () => {
    const result = await saveBusinessScope();
    if (result.success && result.businessScope) {
      onSuccess?.(result.businessScope);
      reset();
      onClose();
    }
  }, [saveBusinessScope, onSuccess, reset, onClose]);

  const handleAgentExpand = useCallback((agentId: string) => {
    setExpandedAgentId(prev => prev === agentId ? null : agentId);
  }, []);

  const selectedAgents = getSelectedAgents();
  const selectedCount = selectedAgents.length;
  const totalCount = state.generatedAgents.length;

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop with glass-morphism effect */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal Content */}
        <div className="relative w-full max-w-2xl max-h-[90vh] bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {t('businessScope.create')}
                </h2>
                <p className="text-xs text-gray-400">
                  {state.step === 'input' && t('businessScope.inputName')}
                  {state.step === 'generating' && t('businessScope.generating')}
                  {state.step === 'preview' && t('businessScope.preview')}
                  {state.step === 'customizing' && t('businessScope.customizing')}
                  {state.step === 'saving' && t('businessScope.saving')}
                  {state.step === 'error' && t('businessScope.errorOccurred')}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Input Step */}
            {state.step === 'input' && (
              <div className="space-y-6">
                {/* Name Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('businessScope.name')}
                  </label>
                  <input
                    type="text"
                    value={state.businessScopeName}
                    onChange={(e) => setBusinessScopeName(e.target.value)}
                    placeholder={t('businessScope.namePlaceholder')}
                    className={`
                      w-full px-4 py-3 bg-gray-800/50 border rounded-xl text-white placeholder-gray-500
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      ${state.validationError ? 'border-red-500' : 'border-gray-700'}
                    `}
                    autoFocus
                  />
                  {state.validationError && (
                    <div className="flex items-center gap-2 mt-2 text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{state.validationError}</span>
                    </div>
                  )}
                </div>

                {/* Document Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('businessScope.uploadDocs')}
                  </label>
                  <DocumentUploader
                    documents={state.uploadedDocuments}
                    onAddDocument={addDocument}
                    onRemoveDocument={removeDocument}
                  />
                </div>
              </div>
            )}

            {/* Generating Step */}
            {state.step === 'generating' && (
              <GenerationProgress
                currentStep={state.generationProgress.currentStep}
                completedSteps={state.generationProgress.completedSteps}
                error={state.generationProgress.error}
                businessScopeName={state.businessScopeName}
                hasDocuments={state.uploadedDocuments.length > 0}
              />
            )}

            {/* Preview Step */}
            {state.step === 'preview' && (
              <div className="space-y-4">
                {/* Agent Count Badge */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">
                    {t('businessScope.generatedCount').replace('{count}', String(totalCount))}
                  </p>
                  <span className="px-3 py-1 text-sm bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/30">
                    {t('businessScope.selectedCount').replace('{selected}', String(selectedCount)).replace('{total}', String(totalCount))}
                  </span>
                </div>

                {/* Agent Cards */}
                <div className="space-y-3">
                  {state.generatedAgents.map((agent) => (
                    <AgentPreviewCard
                      key={agent.id}
                      agent={agent}
                      isRemoved={state.removedAgentIds.includes(agent.id)}
                      isLastAgent={selectedCount === 1 && !state.removedAgentIds.includes(agent.id)}
                      onToggleRemoval={toggleAgentRemoval}
                      onExpand={handleAgentExpand}
                      isExpanded={expandedAgentId === agent.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Customizing Step */}
            {state.step === 'customizing' && (
              <BusinessScopeCustomizer
                customization={state.customization}
                onChange={setCustomization}
                businessScopeName={state.businessScopeName}
                agentCount={selectedCount}
              />
            )}

            {/* Saving Step */}
            {state.step === 'saving' && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                <p className="text-lg font-medium text-white">{t('businessScope.saving')}...</p>
                <p className="text-sm text-gray-400 mt-1">
                  {t('businessScope.savingProgress').replace('{count}', String(selectedCount))}
                </p>
              </div>
            )}

            {/* Error Step */}
            {state.step === 'error' && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                </div>
                <p className="text-lg font-medium text-white">{t('businessScope.createFailed')}</p>
                <p className="text-sm text-gray-400 mt-1 text-center max-w-sm">
                  {state.generationProgress.error?.message || t('businessScope.unknownError')}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-700/50 bg-gray-800/30">
            <div className="flex items-center justify-between">
              {/* Left side - Cancel/Back button */}
              <div>
                {state.step === 'customizing' ? (
                  <button
                    onClick={handleBackToPreview}
                    className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    {t('businessScope.backToPreview')}
                  </button>
                ) : state.step !== 'saving' && (
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                )}
              </div>

              {/* Right side - Action buttons */}
              <div className="flex items-center gap-3">
                {/* Input Step */}
                {state.step === 'input' && (
                  <button
                    onClick={handleGenerate}
                    disabled={!state.businessScopeName.trim() || isValidating}
                    className={`
                      flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all
                      ${state.businessScopeName.trim() && !isValidating
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }
                    `}
                  >
                    {isValidating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {t('businessScope.generateAgents')}
                  </button>
                )}

                {/* Preview Step */}
                {state.step === 'preview' && (
                  <>
                    <button
                      onClick={handleRegenerate}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {t('businessScope.regenerate')}
                    </button>
                    <button
                      onClick={handleProceedToCustomize}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all"
                    >
                      <Palette className="h-4 w-4" />
                      {t('businessScope.customizeAppearance')}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}

                {/* Customizing Step */}
                {state.step === 'customizing' && (
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 transition-all"
                  >
                    <Check className="h-4 w-4" />
                    {t('businessScope.confirmCreate')}
                  </button>
                )}

                {/* Error Step */}
                {state.step === 'error' && (
                  <>
                    <button
                      onClick={handleRegenerate}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {t('businessScope.retry')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
    </>
  );
};

export default BusinessScopeCreator;
