/**
 * GenerationProgress Component
 * 
 * Displays real-time progress during the business scope generation process.
 * Shows progress steps with icons, checkmarks for completed steps,
 * highlights current step with animation, and displays error states.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import React from 'react';
import { 
  Search, 
  FileSearch, 
  Users, 
  Bot, 
  FileText, 
  CheckCircle,
  AlertCircle,
  Check,
  Loader2
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { GenerationStep, GenerationError } from '@/services/useBusinessScopeCreator';

// ============================================================================
// Types
// ============================================================================

export interface GenerationProgressProps {
  /** Current step being processed */
  currentStep: GenerationStep | null;
  /** Array of completed steps */
  completedSteps: GenerationStep[];
  /** Error information if generation failed */
  error: GenerationError | null;
  /** Business scope name being generated */
  businessScopeName: string;
  /** Whether documents were uploaded (shows document_analysis step) */
  hasDocuments?: boolean;
}

interface GenerationStepConfig {
  id: GenerationStep;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  optional?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Configuration for all generation steps
 */
const GENERATION_STEPS: GenerationStepConfig[] = [
  { 
    id: 'business_analysis', 
    labelKey: 'generation.step.businessAnalysis',
    icon: Search 
  },
  { 
    id: 'document_analysis', 
    labelKey: 'generation.step.documentAnalysis',
    icon: FileSearch, 
    optional: true 
  },
  { 
    id: 'role_identification', 
    labelKey: 'generation.step.roleIdentification',
    icon: Users 
  },
  { 
    id: 'agent_creation', 
    labelKey: 'generation.step.agentCreation',
    icon: Bot 
  },
  { 
    id: 'document_generation', 
    labelKey: 'generation.step.documentGeneration',
    icon: FileText 
  },
  { 
    id: 'finalization', 
    labelKey: 'generation.step.finalization',
    icon: CheckCircle 
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines the status of a step
 */
function getStepStatus(
  stepId: GenerationStep,
  currentStep: GenerationStep | null,
  completedSteps: GenerationStep[],
  error: GenerationError | null
): 'completed' | 'current' | 'pending' | 'error' {
  if (error && error.step === stepId) {
    return 'error';
  }
  if (completedSteps.includes(stepId)) {
    return 'completed';
  }
  if (currentStep === stepId) {
    return 'current';
  }
  return 'pending';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface StepItemProps {
  step: GenerationStepConfig;
  status: 'completed' | 'current' | 'pending' | 'error';
  isLast: boolean;
  t: (key: string) => string;
}

const StepItem: React.FC<StepItemProps> = ({ step, status, isLast, t }) => {
  const Icon = step.icon;
  
  const getIconContainerClasses = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 border-green-500 text-green-400';
      case 'current':
        return 'bg-blue-500/20 border-blue-500 text-blue-400 animate-pulse';
      case 'error':
        return 'bg-red-500/20 border-red-500 text-red-400';
      case 'pending':
      default:
        return 'bg-gray-700/50 border-gray-600 text-gray-500';
    }
  };

  const getLabelClasses = () => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'current':
        return 'text-blue-400 font-medium';
      case 'error':
        return 'text-red-400';
      case 'pending':
      default:
        return 'text-gray-500';
    }
  };

  const getConnectorClasses = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'current':
        return 'bg-gradient-to-b from-green-500 to-blue-500';
      default:
        return 'bg-gray-600';
    }
  };

  const renderIcon = () => {
    if (status === 'completed') {
      return <Check className="h-4 w-4" />;
    }
    if (status === 'current') {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (status === 'error') {
      return <AlertCircle className="h-4 w-4" />;
    }
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="flex items-start">
      {/* Icon and connector */}
      <div className="flex flex-col items-center">
        <div 
          className={`
            w-8 h-8 rounded-full border-2 flex items-center justify-center
            transition-all duration-300 ${getIconContainerClasses()}
          `}
        >
          {renderIcon()}
        </div>
        {!isLast && (
          <div 
            className={`w-0.5 h-8 mt-1 transition-colors duration-300 ${getConnectorClasses()}`}
          />
        )}
      </div>
      
      {/* Label */}
      <div className="ml-3 pt-1">
        <p className={`text-sm transition-colors duration-300 ${getLabelClasses()}`}>
          {t(step.labelKey)}
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  currentStep,
  completedSteps,
  error,
  businessScopeName,
  hasDocuments = false,
}) => {
  const { t } = useTranslation();
  
  // Filter steps based on whether documents were uploaded
  const visibleSteps = GENERATION_STEPS.filter(
    step => !step.optional || (step.id === 'document_analysis' && hasDocuments)
  );

  const isComplete = completedSteps.includes('finalization');

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-1">
          {isComplete ? t('generation.complete') : t('generation.inProgress')}
        </h3>
        <p className="text-sm text-gray-400">
          {isComplete 
            ? t('generation.scopeCreated').replace('{name}', businessScopeName)
            : t('generation.generatingTeam').replace('{name}', businessScopeName)
          }
        </p>
      </div>

      {/* Progress Steps */}
      <div className="space-y-0">
        {visibleSteps.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            status={getStepStatus(step.id, currentStep, completedSteps, error)}
            isLast={index === visibleSteps.length - 1}
            t={t}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">
                {t('generation.failed')}
              </p>
              <p className="text-xs text-red-300 mt-1">
                {error.message}
              </p>
              {error.retryable && (
                <p className="text-xs text-gray-400 mt-2">
                  {t('generation.retryHint')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {isComplete && !error && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-400">
                {t('generation.success')}
              </p>
              <p className="text-xs text-green-300 mt-1">
                {t('generation.successMessage').replace('{count}', '5')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerationProgress;
