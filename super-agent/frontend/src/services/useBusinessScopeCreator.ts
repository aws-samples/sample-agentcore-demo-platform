/**
 * useBusinessScopeCreator Hook
 * 
 * Custom hook that manages the business scope creation workflow including:
 * - State management for the creation flow
 * - Name validation (empty, whitespace, duplicate checks)
 * - Document upload management
 * - Agent selection/removal
 * - Generation progress tracking
 * - Persistence to BusinessScopeService and AgentService
 * 
 * Requirements: 2.1-2.6, 5.5.5, 6.1-6.5, 8.3, 8.4, 9.1-9.4
 */

import { useState, useCallback, useRef } from 'react';
import { BusinessScopeService } from './businessScopeService';
import type { BusinessScope, CreateBusinessScopeInput } from './businessScopeService';
import { AgentService } from './agentService';
import { generateAgents, generateAgentsWithDocuments } from './roleGeneratorService';
import type { GeneratedAgent } from './roleGeneratorService';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Generation step identifiers
 */
export type GenerationStep =
  | 'business_analysis'
  | 'document_analysis'
  | 'role_identification'
  | 'agent_creation'
  | 'document_generation'
  | 'finalization';

/**
 * Validation error codes
 */
export type ValidationErrorCode = 
  | 'EMPTY_NAME' 
  | 'WHITESPACE_ONLY' 
  | 'DUPLICATE_NAME' 
  | 'NAME_TOO_LONG';

/**
 * Generation error codes
 */
export type GenerationErrorCode =
  | 'ANALYSIS_FAILED'
  | 'DOCUMENT_ANALYSIS_FAILED'
  | 'ROLE_GENERATION_FAILED'
  | 'AGENT_CREATION_FAILED'
  | 'PERSISTENCE_FAILED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'CANCELLED';

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  error: string | null;
  errorCode: ValidationErrorCode | null;
}

/**
 * Generation error
 */
export interface GenerationError {
  step: GenerationStep;
  message: string;
  code: GenerationErrorCode;
  retryable: boolean;
}

/**
 * Generation result
 */
export interface GenerationResult {
  success: boolean;
  agents: GeneratedAgent[];
  error?: GenerationError;
}

/**
 * Save result
 */
export interface SaveResult {
  success: boolean;
  businessScope?: BusinessScope;
  error?: string;
}

/**
 * Uploaded document
 */
export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

/**
 * Business scope customization options
 */
export interface BusinessScopeCustomization {
  icon: string;
  color: string;
  description: string;
}

/**
 * Generation progress state
 */
export interface GenerationProgress {
  currentStep: GenerationStep | null;
  completedSteps: GenerationStep[];
  progress: number;
  error: GenerationError | null;
}

/**
 * Business scope creator state
 */
export interface BusinessScopeCreatorState {
  step: 'input' | 'generating' | 'preview' | 'customizing' | 'saving' | 'error';
  businessScopeName: string;
  validationError: string | null;
  generatedAgents: GeneratedAgent[];
  uploadedDocuments: UploadedDocument[];
  removedAgentIds: string[];
  customization: BusinessScopeCustomization;
  generationProgress: GenerationProgress;
}

/**
 * Hook return type
 */
export interface UseBusinessScopeCreatorReturn {
  // State
  state: BusinessScopeCreatorState;

  // Validation
  validateName: (name: string) => Promise<ValidationResult>;

  // Document management
  addDocument: (file: File) => UploadedDocument | null;
  removeDocument: (documentId: string) => void;

  // Agent selection
  toggleAgentRemoval: (agentId: string) => boolean;
  getSelectedAgents: () => GeneratedAgent[];
  canRemoveAgent: (agentId: string) => boolean;

  // Generation
  startGeneration: (name: string) => Promise<GenerationResult>;
  cancelGeneration: () => void;

  // Customization
  setCustomization: (customization: BusinessScopeCustomization) => void;

  // Persistence
  saveBusinessScope: () => Promise<SaveResult>;

  // State management
  reset: () => void;
  setStep: (step: BusinessScopeCreatorState['step']) => void;
  setBusinessScopeName: (name: string) => void;
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

const MAX_NAME_LENGTH = 100;

const DEFAULT_CUSTOMIZATION: BusinessScopeCustomization = {
  icon: '👥',
  color: '#4CAF50',
  description: '',
};

const INITIAL_GENERATION_PROGRESS: GenerationProgress = {
  currentStep: null,
  completedSteps: [],
  progress: 0,
  error: null,
};

/**
 * Domain-based default suggestions for customization
 */
const DOMAIN_SUGGESTIONS: Record<string, { icon: string; color: string }> = {
  '资产': { icon: '💰', color: '#FF9800' },
  '逾期': { icon: '📊', color: '#FF5722' },
  'hr': { icon: '👥', color: '#4CAF50' },
  'it': { icon: '💻', color: '#2196F3' },
  'marketing': { icon: '📢', color: '#E91E63' },
  'sales': { icon: '💰', color: '#9C27B0' },
  'customer': { icon: '🎧', color: '#00BCD4' },
  'support': { icon: '🎧', color: '#00BCD4' },
  'finance': { icon: '💵', color: '#4CAF50' },
  'legal': { icon: '⚖️', color: '#607D8B' },
  'operations': { icon: '⚙️', color: '#795548' },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates a unique ID for documents
 */
function generateDocumentId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

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
 * Gets default customization based on domain keywords
 */
function getDefaultCustomization(scopeName: string): BusinessScopeCustomization {
  const lowerName = scopeName.toLowerCase();
  
  for (const [keyword, suggestion] of Object.entries(DOMAIN_SUGGESTIONS)) {
    if (lowerName.includes(keyword) || scopeName.includes(keyword)) {
      return {
        ...suggestion,
        description: '',
      };
    }
  }
  
  return { ...DEFAULT_CUSTOMIZATION };
}

/**
 * Simulates a delay for generation steps
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reads a file as text content
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing business scope creation workflow
 * 
 * Requirements: 2.1-2.6, 5.5.5, 6.1-6.5, 8.3, 8.4, 9.1-9.4
 */
export function useBusinessScopeCreator(): UseBusinessScopeCreatorReturn {
  // Cancellation ref for generation process
  const cancelledRef = useRef(false);

  // Initial state
  const getInitialState = (): BusinessScopeCreatorState => ({
    step: 'input',
    businessScopeName: '',
    validationError: null,
    generatedAgents: [],
    uploadedDocuments: [],
    removedAgentIds: [],
    customization: { ...DEFAULT_CUSTOMIZATION },
    generationProgress: { ...INITIAL_GENERATION_PROGRESS },
  });

  const [state, setState] = useState<BusinessScopeCreatorState>(getInitialState());

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validates a business scope name
   * Requirements: 2.1, 2.2, 2.3, 2.6
   */
  const validateName = useCallback(async (name: string): Promise<ValidationResult> => {
    // Check for empty name
    if (!name || name.length === 0) {
      return {
        isValid: false,
        error: 'Please enter a business scope name',
        errorCode: 'EMPTY_NAME',
      };
    }

    // Check for whitespace-only name
    if (name.trim().length === 0) {
      return {
        isValid: false,
        error: 'Business scope name cannot be empty',
        errorCode: 'WHITESPACE_ONLY',
      };
    }

    // Check for name too long
    if (name.length > MAX_NAME_LENGTH) {
      return {
        isValid: false,
        error: `Business scope name must be ${MAX_NAME_LENGTH} characters or less`,
        errorCode: 'NAME_TOO_LONG',
      };
    }

    // No duplicate check - will auto-rename if needed during save

    return {
      isValid: true,
      error: null,
      errorCode: null,
    };
  }, []);

  /**
   * Generates a unique name by appending a number if duplicate exists
   */
  const generateUniqueName = useCallback(async (baseName: string): Promise<string> => {
    try {
      const existingScopes = await BusinessScopeService.getBusinessScopes();
      const existingNames = existingScopes.map(s => s.name.toLowerCase());
      
      let name = baseName.trim();
      let counter = 1;
      
      while (existingNames.includes(name.toLowerCase())) {
        counter++;
        name = `${baseName.trim()} ${counter}`;
      }
      
      return name;
    } catch {
      return baseName;
    }
  }, []);

  // ============================================================================
  // Document Management
  // ============================================================================

  /**
   * Adds a document to the upload list
   * Requirements: 2.5.1, 2.5.2, 2.5.3
   */
  const addDocument = useCallback((file: File): UploadedDocument | null => {
    if (!isFileTypeSupported(file)) {
      return null;
    }

    const document: UploadedDocument = {
      id: generateDocumentId(),
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    };

    setState(prev => ({
      ...prev,
      uploadedDocuments: [...prev.uploadedDocuments, document],
    }));

    return document;
  }, []);

  /**
   * Removes a document from the upload list
   * Requirements: 2.5.4
   */
  const removeDocument = useCallback((documentId: string): void => {
    setState(prev => ({
      ...prev,
      uploadedDocuments: prev.uploadedDocuments.filter(doc => doc.id !== documentId),
    }));
  }, []);

  // ============================================================================
  // Agent Selection
  // ============================================================================

  /**
   * Checks if an agent can be removed (at least 1 must remain)
   * Requirements: 5.5.5
   */
  const canRemoveAgent = useCallback((agentId: string): boolean => {
    const selectedCount = state.generatedAgents.length - state.removedAgentIds.length;
    const isCurrentlyRemoved = state.removedAgentIds.includes(agentId);
    
    // Can always restore a removed agent
    if (isCurrentlyRemoved) {
      return true;
    }
    
    // Can only remove if more than 1 agent will remain
    return selectedCount > 1;
  }, [state.generatedAgents.length, state.removedAgentIds]);

  /**
   * Toggles agent removal status
   * Requirements: 5.5.3
   */
  const toggleAgentRemoval = useCallback((agentId: string): boolean => {
    const isCurrentlyRemoved = state.removedAgentIds.includes(agentId);

    if (isCurrentlyRemoved) {
      // Restore the agent
      setState(prev => ({
        ...prev,
        removedAgentIds: prev.removedAgentIds.filter(id => id !== agentId),
      }));
      return true;
    } else {
      // Check if we can remove
      const selectedCount = state.generatedAgents.length - state.removedAgentIds.length;
      if (selectedCount <= 1) {
        return false; // Cannot remove the last agent
      }

      // Remove the agent
      setState(prev => ({
        ...prev,
        removedAgentIds: [...prev.removedAgentIds, agentId],
      }));
      return true;
    }
  }, [state.generatedAgents.length, state.removedAgentIds]);

  /**
   * Gets the list of selected (non-removed) agents
   * Requirements: 5.5.6
   */
  const getSelectedAgents = useCallback((): GeneratedAgent[] => {
    return state.generatedAgents.filter(
      agent => !state.removedAgentIds.includes(agent.id)
    );
  }, [state.generatedAgents, state.removedAgentIds]);

  // ============================================================================
  // Generation
  // ============================================================================

  /**
   * Updates generation progress
   */
  const updateProgress = useCallback((
    currentStep: GenerationStep | null,
    completedSteps: GenerationStep[],
    progress: number,
    error: GenerationError | null = null
  ) => {
    setState(prev => ({
      ...prev,
      generationProgress: {
        currentStep,
        completedSteps,
        progress,
        error,
      },
    }));
  }, []);

  /**
   * Starts the generation process
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  const startGeneration = useCallback(async (name: string): Promise<GenerationResult> => {
    cancelledRef.current = false;

    // Validate name first
    const validation = await validateName(name);
    if (!validation.isValid) {
      setState(prev => ({
        ...prev,
        validationError: validation.error,
      }));
      return {
        success: false,
        agents: [],
        error: {
          step: 'business_analysis',
          message: validation.error || 'Validation failed',
          code: 'ANALYSIS_FAILED',
          retryable: true,
        },
      };
    }

    // Set initial state for generation
    const hasDocuments = state.uploadedDocuments.length > 0;
    setState(prev => ({
      ...prev,
      step: 'generating',
      businessScopeName: name,
      validationError: null,
      generatedAgents: [],
      removedAgentIds: [],
      customization: getDefaultCustomization(name),
      generationProgress: {
        currentStep: 'business_analysis',
        completedSteps: [],
        progress: 0,
        error: null,
      },
    }));

    try {
      // Step 1: Business Analysis
      if (cancelledRef.current) throw new Error('CANCELLED');
      updateProgress('business_analysis', [], 10);
      await delay(500);

      // Step 2: Document Analysis (optional)
      const completedSteps: GenerationStep[] = ['business_analysis'];
      if (hasDocuments) {
        if (cancelledRef.current) throw new Error('CANCELLED');
        updateProgress('document_analysis', completedSteps, 25);
        await delay(500);
        completedSteps.push('document_analysis');
      }

      // Step 3: Role Identification
      if (cancelledRef.current) throw new Error('CANCELLED');
      updateProgress('role_identification', completedSteps, hasDocuments ? 40 : 30);
      await delay(500);
      completedSteps.push('role_identification');

      // Step 4: Agent Creation
      if (cancelledRef.current) throw new Error('CANCELLED');
      updateProgress('agent_creation', completedSteps, hasDocuments ? 60 : 50);
      
      // Read document contents if any
      let documentContents: string[] = [];
      if (hasDocuments) {
        documentContents = await Promise.all(
          state.uploadedDocuments.map(doc => readFileAsText(doc.file))
        );
      }
      
      const agents = hasDocuments
        ? await generateAgentsWithDocuments(name, documentContents, 4)
        : await generateAgents(name, 4);
      completedSteps.push('agent_creation');

      // Step 5: Document Generation
      if (cancelledRef.current) throw new Error('CANCELLED');
      updateProgress('document_generation', completedSteps, hasDocuments ? 80 : 75);
      await delay(500);
      completedSteps.push('document_generation');

      // Step 6: Finalization
      if (cancelledRef.current) throw new Error('CANCELLED');
      updateProgress('finalization', completedSteps, 95);
      await delay(300);
      completedSteps.push('finalization');

      // Complete
      updateProgress(null, completedSteps, 100);

      setState(prev => ({
        ...prev,
        step: 'preview',
        generatedAgents: agents,
      }));

      return {
        success: true,
        agents,
      };
    } catch (error) {
      const isCancelled = error instanceof Error && error.message === 'CANCELLED';
      
      if (isCancelled) {
        // Reset state on cancellation
        setState(getInitialState());
        return {
          success: false,
          agents: [],
          error: {
            step: state.generationProgress.currentStep || 'business_analysis',
            message: 'Generation cancelled',
            code: 'CANCELLED',
            retryable: false,
          },
        };
      }

      const generationError: GenerationError = {
        step: state.generationProgress.currentStep || 'business_analysis',
        message: error instanceof Error ? error.message : 'Generation failed',
        code: 'AGENT_CREATION_FAILED',
        retryable: true,
      };

      setState(prev => ({
        ...prev,
        step: 'error',
        generationProgress: {
          ...prev.generationProgress,
          error: generationError,
        },
      }));

      return {
        success: false,
        agents: [],
        error: generationError,
      };
    }
  }, [validateName, state.uploadedDocuments.length, state.generationProgress.currentStep, updateProgress]);

  /**
   * Cancels the generation process
   * Requirements: 8.3, 8.4
   */
  const cancelGeneration = useCallback((): void => {
    cancelledRef.current = true;
    // State will be reset in startGeneration when it detects cancellation
  }, []);

  // ============================================================================
  // Customization
  // ============================================================================

  /**
   * Sets customization options
   * Requirements: 7.1, 7.2, 7.3, 7.4
   */
  const setCustomization = useCallback((customization: BusinessScopeCustomization): void => {
    setState(prev => ({
      ...prev,
      customization,
    }));
  }, []);

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Saves the business scope and agents
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
   */
  const saveBusinessScope = useCallback(async (): Promise<SaveResult> => {
    setState(prev => ({ ...prev, step: 'saving' }));

    try {
      const selectedAgents = getSelectedAgents();

      // Generate unique name if duplicate exists
      const uniqueName = await generateUniqueName(state.businessScopeName);

      // Create business scope input
      const businessScopeInput: CreateBusinessScopeInput = {
        name: uniqueName,
        description: state.customization.description || null,
        icon: state.customization.icon,
        color: state.customization.color,
        isDefault: false,
      };

      // Create business scope first
      const businessScope = await BusinessScopeService.createBusinessScope(businessScopeInput);

      // Create agents linked to the new business scope
      const createdAgents: unknown[] = [];
      const failedAgents: string[] = [];

      for (const agent of selectedAgents) {
        try {
          // Include avatar if it's a URL, relative path, or S3 key
          const hasAvatar = agent.avatar && (
            agent.avatar.startsWith('http://') || 
            agent.avatar.startsWith('https://') ||
            agent.avatar.startsWith('avatars/') ||
            agent.avatar.startsWith('/api/')
          );
          
          const createdAgent = await AgentService.createAgent({
            name: agent.name,
            displayName: agent.role,
            role: agent.role,
            avatar: hasAvatar ? agent.avatar : undefined,
            status: 'active',
            systemPrompt: agent.systemPromptSummary,
            tools: agent.tools.map((tool, index) => ({
              id: `tool-${index}`,
              name: tool.name,
              skillMd: tool.skillMd,
            })),
            scope: agent.responsibilities,
            metrics: { taskCount: 0, responseRate: 0, avgResponseTime: '0s' },
            modelConfig: { provider: 'Bedrock', modelId: 'claude-3-sonnet', agentType: 'Worker' },
            businessScopeId: businessScope.id,
          });
          createdAgents.push(createdAgent);
        } catch (agentError) {
          console.error(`Failed to create agent ${agent.name}:`, agentError);
          failedAgents.push(agent.name);
        }
      }

      // Log results
      console.log(`Business scope "${businessScope.name}" created with ${createdAgents.length} agents`);
      if (failedAgents.length > 0) {
        console.warn(`Failed to create agents: ${failedAgents.join(', ')}`);
      }

      return {
        success: true,
        businessScope,
      };
    } catch (error) {
      setState(prev => ({ ...prev, step: 'error' }));
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save business scope',
      };
    }
  }, [state.businessScopeName, state.customization, getSelectedAgents, generateUniqueName]);

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Resets the hook state
   */
  const reset = useCallback((): void => {
    cancelledRef.current = true;
    setState(getInitialState());
  }, []);

  /**
   * Sets the current step
   */
  const setStep = useCallback((step: BusinessScopeCreatorState['step']): void => {
    setState(prev => ({ ...prev, step }));
  }, []);

  /**
   * Sets the business scope name
   */
  const setBusinessScopeName = useCallback((name: string): void => {
    setState(prev => ({
      ...prev,
      businessScopeName: name,
      validationError: null,
    }));
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    state,
    validateName,
    addDocument,
    removeDocument,
    toggleAgentRemoval,
    getSelectedAgents,
    canRemoveAgent,
    startGeneration,
    cancelGeneration,
    setCustomization,
    saveBusinessScope,
    reset,
    setStep,
    setBusinessScopeName,
  };
}

export default useBusinessScopeCreator;
