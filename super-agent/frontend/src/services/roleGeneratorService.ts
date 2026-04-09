/**
 * Role Generator Service
 * 
 * This module provides AI-powered role generation for business scope creation.
 * It calls the backend API to generate agent suggestions using AI.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 9.5
 */

import { RestBusinessScopeService, type SuggestedAgent, type SuggestedTool } from './api/restBusinessScopeService';
import { shouldUseRestApi } from './api/index';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Generated tool with skill definition
 */
export interface GeneratedTool {
  name: string;
  displayName: string;
  description: string;
  skillMd: string;
}

/**
 * Generated agent with full configuration
 */
export interface GeneratedAgent {
  id: string;
  name: string;
  roleId: string;
  role: string;
  avatar: string;
  description: string;
  responsibilities: string[];
  capabilities: string[];
  systemPromptSummary: string;
  tools: GeneratedTool[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates a unique ID for an agent
 */
function generateAgentId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Gets an avatar character from a role name (fallback for when image generation is disabled)
 */
function getAvatarFromRole(roleName: string): string {
  // For Chinese names, use the first character
  if (/[\u4e00-\u9fa5]/.test(roleName)) {
    return roleName.charAt(0);
  }
  // For English names, use the first letter of each word (max 2)
  const words = roleName.split(' ');
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return roleName.charAt(0).toUpperCase();
}

/**
 * Generates avatar (image or text) based on environment configuration
 */
async function generateAvatar(roleName: string, description?: string): Promise<string> {
  // Check if avatar generation is enabled via environment variable
  const enableAvatarGeneration = import.meta.env?.VITE_ENABLE_AVATAR_GENERATION === 'true';
  
  if (!enableAvatarGeneration) {
    return getAvatarFromRole(roleName);
  }

  try {
    // Get backend URL from environment
    const backendUrl = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:3000';
    
    console.log('Generating avatar for:', roleName);
    
    // Call backend API to generate avatar image with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout
    
    const response = await fetch(`${backendUrl}/api/avatars/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: roleName, description }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Avatar generation failed: ${response.status}`);
    }

    const { avatarKey } = await response.json();
    console.log('Avatar generated:', avatarKey);
    
    // Return the raw S3 key — avatarUtils.ts resolves it to a backend URL for display
    return avatarKey;
  } catch (error) {
    console.warn('Avatar generation failed, falling back to text:', error);
    return getAvatarFromRole(roleName);
  }
}

/**
 * Converts a suggested agent from API to GeneratedAgent format
 */
async function mapSuggestedAgentToGeneratedAgent(suggested: SuggestedAgent): Promise<GeneratedAgent> {
  let avatar: string;
  try {
    avatar = await generateAvatar(suggested.displayName, suggested.description);
  } catch (error) {
    console.warn('Avatar generation error, using fallback:', error);
    avatar = getAvatarFromRole(suggested.displayName);
  }
  
  return {
    id: generateAgentId(),
    name: suggested.name,
    roleId: suggested.name,
    role: suggested.displayName,
    avatar,
    description: suggested.description,
    responsibilities: suggested.responsibilities,
    capabilities: suggested.capabilities,
    systemPromptSummary: suggested.systemPrompt,
    tools: suggested.suggestedTools.map(tool => ({
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      skillMd: tool.skillMd,
    })),
  };
}

// ============================================================================
// Main Service Functions
// ============================================================================

/**
 * Generates agents using AI via backend API.
 * Throws error if API call fails - no fallback.
 * 
 * @param scopeName - The business scope name to analyze
 * @param count - Number of agents to generate (default: 5)
 * @returns Promise resolving to array of generated agents
 */
export async function generateAgents(scopeName: string, count: number = 5): Promise<GeneratedAgent[]> {
  if (!shouldUseRestApi()) {
    throw new Error('REST API mode is required for AI agent generation');
  }

  console.log('Generating agents for scope:', scopeName);
  
  const suggestedAgents = await RestBusinessScopeService.suggestAgents({
    businessScopeName: scopeName,
    agentCount: count,
  });

  console.log('Suggested agents received:', suggestedAgents.length);

  // Generate avatars in parallel for all agents
  const agents = await Promise.all(suggestedAgents.map(mapSuggestedAgentToGeneratedAgent));
  
  console.log('Agents with avatars ready:', agents.length);
  return agents;
}

/**
 * Generates agents with document context using AI via backend API.
 * 
 * @param scopeName - The business scope name
 * @param documentContents - Array of document text contents
 * @param count - Number of agents to generate
 * @returns Promise resolving to array of generated agents
 */
export async function generateAgentsWithDocuments(
  scopeName: string,
  documentContents: string[],
  count: number = 5
): Promise<GeneratedAgent[]> {
  if (!shouldUseRestApi()) {
    throw new Error('REST API mode is required for AI agent generation');
  }

  console.log('Generating agents with documents for scope:', scopeName);

  const suggestedAgents = await RestBusinessScopeService.suggestAgents({
    businessScopeName: scopeName,
    documentContents,
    agentCount: count,
  });

  console.log('Suggested agents received:', suggestedAgents.length);

  // Generate avatars in parallel for all agents
  const agents = await Promise.all(suggestedAgents.map(mapSuggestedAgentToGeneratedAgent));
  
  console.log('Agents with avatars ready:', agents.length);
  return agents;
}

// ============================================================================
// Service Export
// ============================================================================

/**
 * Role Generator Service
 * Provides AI-powered role generation for business scope creation
 */
export const RoleGeneratorService = {
  generateAgents,
  generateAgentsWithDocuments,
};

export default RoleGeneratorService;
