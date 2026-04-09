/**
 * Quick Questions Service
 *
 * Uses Amazon Nova 2 Lite (via Bedrock) to generate contextual quick questions/tasks
 * based on the business scope, available agents, and conversation history.
 *
 * This deliberately bypasses the Claude Agent SDK to keep latency low and cost minimal.
 */

import { aiService } from './ai.service.js';
import { businessScopeService } from './businessScope.service.js';

export interface QuickQuestion {
  id: string;
  icon: string;
  category: string;
  text: string;
}

interface GenerateQuestionsInput {
  organizationId: string;
  businessScopeId?: string;
  agentId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const SYSTEM_PROMPT = `You generate contextual quick-action suggestions for an enterprise AI agent platform.

Given a business scope with its agents and skills, produce exactly 6 actionable suggestions the user would realistically ask.

Rules:
- Every suggestion MUST reference the specific business domain, agent names, or skill capabilities described
- Never produce generic suggestions like "What can you help me with" or "How do I get started"
- Phrase as direct requests (e.g. "Generate a sales pitch for cloud migration")
- Max 55 characters per text
- Each needs an emoji icon and a 1-2 word category from the business domain

Return ONLY a JSON array — no markdown, no explanation:
[{"icon":"emoji","category":"Category","text":"Specific action text"}]`;

/**
 * Generate LLM-powered quick questions based on business scope context.
 */
export async function generateQuickQuestions(
  input: GenerateQuestionsInput,
): Promise<QuickQuestion[]> {
  const { organizationId, businessScopeId, conversationHistory } = input;

  console.log('[quick-questions] Generating for scope:', businessScopeId, 'org:', organizationId);

  // Build rich context from the business scope
  const contextParts: string[] = [];
  let scopeName = '';

  if (businessScopeId) {
    // Load scope info — catch independently so agents can still load
    try {
      const scope = await businessScopeService.getBusinessScopeById(businessScopeId, organizationId);
      if (scope) {
        scopeName = scope.name;
        contextParts.push(`Business Scope: "${scope.name}"`);
        if (scope.description) {
          contextParts.push(`Description: ${scope.description}`);
        }
        console.log('[quick-questions] Loaded scope:', scope.name);
      }
    } catch (err) {
      console.warn('[quick-questions] Failed to load scope:', err instanceof Error ? err.message : err);
    }

    // Load agents — catch independently
    try {
      const agents = await businessScopeService.getScopeAgentsWithSkills(businessScopeId, organizationId);
      console.log('[quick-questions] Found', agents.length, 'agents');
      if (agents.length > 0) {
        contextParts.push('\nAgents:');
        for (const agent of agents) {
          let agentInfo = `- ${agent.display_name || agent.name}`;
          if (agent.role) agentInfo += ` (${agent.role})`;
          if (agent.skills && agent.skills.length > 0) {
            agentInfo += ` — skills: ${agent.skills.map(s => s.name).join(', ')}`;
          }
          if (agent.system_prompt) {
            agentInfo += ` — purpose: "${agent.system_prompt.slice(0, 150)}"`;
          }
          contextParts.push(agentInfo);
        }
      }
    } catch (err) {
      console.warn('[quick-questions] Failed to load agents:', err instanceof Error ? err.message : err);
    }
  }

  if (conversationHistory && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-4);
    const summary = recent.map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n');
    contextParts.push(`\nRecent conversation:\n${summary}`);
  }

  // If we couldn't load any context, generate based on scope name at minimum
  if (contextParts.length === 0) {
    if (scopeName) {
      contextParts.push(`Business Scope: "${scopeName}"`);
    } else {
      console.warn('[quick-questions] No context available, returning defaults');
      return getDefaultQuestions();
    }
  }

  const userMessage = `Generate 6 quick questions for this business:\n\n${contextParts.join('\n')}`;
  console.log('[quick-questions] Calling Nova with context length:', userMessage.length);

  try {
    const responseText = await aiService.chatCompletion({
      system_prompt: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 1024,
    });

    console.log('[quick-questions] Nova response:', responseText.slice(0, 300));

    // Parse the JSON response
    const cleaned = responseText.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as Array<{ icon: string; category: string; text: string }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn('[quick-questions] Parsed empty array from Nova');
      return getDefaultQuestions();
    }

    return parsed.slice(0, 6).map((q, i) => ({
      id: `qq-llm-${Date.now()}-${i}`,
      icon: q.icon || '�',
      category: q.category || 'Suggestion',
      text: q.text || 'How can I help you?',
    }));
  } catch (err) {
    console.error('[quick-questions] Nova call or parse failed:', err instanceof Error ? err.message : err);
    return getDefaultQuestions();
  }
}

function getDefaultQuestions(): QuickQuestion[] {
  return [
    { id: 'qq-default-1', icon: '❓', category: 'General', text: 'What can you help me with?' },
    { id: 'qq-default-2', icon: '📝', category: 'General', text: 'How do I get started?' },
    { id: 'qq-default-3', icon: '🤖', category: 'Agents', text: 'Show me available agents' },
  ];
}
