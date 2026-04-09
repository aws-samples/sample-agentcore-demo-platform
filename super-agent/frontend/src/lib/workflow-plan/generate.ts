/**
 * Workflow Plan Generation
 *
 * Generates workflow plans from natural language descriptions using
 * Claude Agent SDK via SSE streaming (same approach as Scope Generator).
 */

import type { WorkflowPlan, WorkflowVariable } from '@/types/workflow-plan';
import type { Agent } from '@/types';
import { getAuthToken } from '@/services/api/restClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateWorkflowOptions {
  description: string;
  availableAgents?: Agent[];
  businessScopeId?: string;
  existingVariables?: WorkflowVariable[];
  context?: string;
}

/** SSE event shape from the backend (mirrors scope generator) */
interface SSEEvent {
  type: 'session_start' | 'assistant' | 'result' | 'heartbeat' | 'error';
  sessionId?: string;
  content?: Array<{ type: string; text?: string }>;
  code?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// SSE Stream Consumer
// ---------------------------------------------------------------------------

/**
 * Consume an SSE stream from the workflow generation endpoint.
 * Accumulates all text content blocks and returns the full text.
 */
async function consumeSSEStream(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;

      try {
        const event: SSEEvent = JSON.parse(data);

        if (event.type === 'error') {
          throw new Error(event.message || 'Workflow generation failed');
        }

        if ((event.type === 'assistant' || event.type === 'result') && event.content) {
          for (const block of event.content) {
            if (block.type === 'text' && block.text) {
              accumulatedText += block.text;
            }
          }
        }
      } catch (e) {
        // Re-throw generation errors, skip parse errors
        if (e instanceof Error && e.message !== 'Workflow generation failed') {
          // skip unparseable SSE lines
        } else {
          throw e;
        }
      }
    }
  }

  return accumulatedText;
}

// ---------------------------------------------------------------------------
// JSON Parsing
// ---------------------------------------------------------------------------

/**
 * Parse the accumulated LLM text into a WorkflowPlan.
 */
function parseWorkflowPlan(text: string): WorkflowPlan {
  let jsonStr = text.trim();

  // Strip markdown code fences
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1]!.trim();
  }

  // Find JSON object boundaries
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(jsonStr);

  if (!parsed.title || !Array.isArray(parsed.tasks)) {
    throw new Error('Invalid workflow plan: missing title or tasks');
  }

  // Validate and normalize task types
  const validTypes = new Set(['agent', 'action', 'condition', 'document', 'codeArtifact']);

  return {
    title: parsed.title || 'Generated Workflow',
    description: parsed.description,
    tasks: (parsed.tasks || []).map((task: Record<string, unknown>) => ({
      id: task.id as string,
      title: task.title as string,
      type: validTypes.has(task.type as string) ? task.type : 'agent',
      prompt: (task.prompt as string) || '',
      dependentTasks: Array.isArray(task.dependentTasks) ? task.dependentTasks : [],
      agentId: task.agentId as string | undefined,
      config: task.config as Record<string, unknown> | undefined,
    })),
    variables: (parsed.variables || []).map((v: Record<string, unknown>) => ({
      variableId: v.variableId as string,
      variableType: v.variableType === 'resource' ? 'resource' : 'string',
      name: v.name as string,
      description: (v.description as string) || '',
      required: (v.required as boolean) || false,
      value: Array.isArray(v.value) ? v.value : [],
    })),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a workflow plan from natural language description.
 * Calls the backend SSE endpoint (Claude Agent SDK) and parses the result.
 */
export async function generateWorkflowPlan(
  options: GenerateWorkflowOptions
): Promise<WorkflowPlan> {
  const { description, availableAgents = [], businessScopeId } = options;

  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/api/workflows/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      description,
      businessScopeId,
      availableAgents: availableAgents.map(a => ({
        id: a.id,
        name: a.displayName,
        role: a.role,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to generate workflow: ${response.status}`);
  }

  const accumulatedText = await consumeSSEStream(response);

  if (!accumulatedText.trim()) {
    throw new Error('No content received from workflow generation');
  }

  return parseWorkflowPlan(accumulatedText);
}

/**
 * Build the user prompt for LLM-based generation (used by tests/debugging)
 */
export function buildGenerationPrompt(options: GenerateWorkflowOptions): string {
  const { description, availableAgents = [], existingVariables = [], context } = options;

  let prompt = `Generate a workflow plan for the following request:\n\n${description}`;

  if (availableAgents.length > 0) {
    prompt += '\n\n## Available Agents\n';
    for (const agent of availableAgents) {
      prompt += `- ${agent.displayName} (ID: ${agent.id}): ${agent.role}\n`;
    }
  }

  if (existingVariables.length > 0) {
    prompt += '\n\n## Existing Variables (can be reused)\n';
    for (const variable of existingVariables) {
      prompt += `- ${variable.name} (${variable.variableType}): ${variable.description}\n`;
    }
  }

  if (context) {
    prompt += `\n\n## Additional Context\n${context}`;
  }

  return prompt;
}
