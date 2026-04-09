/**
 * Scope Generator Service (Frontend)
 *
 * Calls the backend SSE endpoint to generate a business scope + agents
 * from a free-text description, and the confirm endpoint to persist them.
 */

import { getAuthToken } from './api/restClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Types (mirror backend GeneratedScopeConfig)
// ---------------------------------------------------------------------------

export interface GeneratedScope {
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface GeneratedSkill {
  name: string;
  description: string;
  body: string;
}

export interface GeneratedAgent {
  name: string;
  displayName: string;
  role: string;
  systemPrompt: string;
  skills?: GeneratedSkill[];
}

export interface GeneratedScopeConfig {
  scope: GeneratedScope;
  agents: GeneratedAgent[];
}

export interface ConfirmResult {
  scope: { id: string; name: string; description: string; icon: string; color: string };
  agents: Array<{ id: string; name: string; displayName: string; role: string; avatar?: string | null }>;
}

// SSE event types from the backend
export interface SSEEvent {
  type: 'session_start' | 'assistant' | 'result' | 'heartbeat' | 'error' | 'scope_config';
  sessionId?: string;
  content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> | string }> | string;
  code?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Streaming generator
// ---------------------------------------------------------------------------

export type GenerateCallback = (event: SSEEvent) => void;

/**
 * Helper: process SSE stream and accumulate the final result text.
 * Only text/tool_use from the final `result` event is used for JSON parsing.
 * Intermediate `assistant` events (tool calls, thinking) are forwarded to onEvent
 * for UI rendering but not included in the parseable output.
 */
async function processSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: GenerateCallback,
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  let resultText = '';
  let assistantText = '';
  let scopeConfigJson = '';

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
        onEvent(event);

        // Capture the scope_config event (file-based JSON from workspace)
        if (event.type === 'scope_config' && typeof event.content === 'string') {
          scopeConfigJson = event.content;
        }

        // Also accumulate text from assistant and result events as fallback
        if ((event.type === 'result' || event.type === 'assistant') && Array.isArray(event.content)) {
          for (const block of event.content) {
            if (block.type === 'text' && block.text) {
              if (event.type === 'result') {
                resultText += block.text;
              }
              assistantText += block.text;
            }
            if (block.type === 'tool_use' && block.input) {
              const inputStr = typeof block.input === 'string' ? block.input : JSON.stringify(block.input);
              if (event.type === 'result') {
                resultText += inputStr;
              }
              assistantText += inputStr;
            }
          }
        }
      } catch {
        // skip unparseable lines
      }
    }
  }

  // Priority: scope_config file > result text > assistant text
  return scopeConfigJson || resultText || assistantText;
}

/**
 * Streams scope generation via SSE. Calls onEvent for each parsed event.
 * Returns the accumulated text content when done.
 */
export async function generateScope(
  description: string,
  onEvent: GenerateCallback,
  signal?: AbortSignal,
): Promise<string> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/api/scope-generator/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ description }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Generation failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  return processSSEStream(reader, onEvent);
}

/**
 * Parse the accumulated text into a GeneratedScopeConfig.
 */
export function parseScopeConfig(text: string): GeneratedScopeConfig {
  let jsonStr = text.trim();

  // If empty, fail early with a clear message
  if (!jsonStr) {
    throw new Error('No content received from AI generation');
  }

  // Try parsing directly first (tool_use input is often already valid JSON)
  try {
    const direct = JSON.parse(jsonStr);
    if (direct.scope && direct.agents && Array.isArray(direct.agents)) {
      return direct as GeneratedScopeConfig;
    }
  } catch {
    // Not direct JSON, try extraction below
  }

  // Strip markdown code fences
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1]!.trim();
  }

  // Find JSON boundaries
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  // Try parsing the extracted JSON
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.scope && parsed.agents && Array.isArray(parsed.agents)) {
      return parsed as GeneratedScopeConfig;
    }
  } catch {
    // Fall through to brute-force search
  }

  // Brute-force: scan for all top-level JSON objects and find one with scope+agents
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        candidates.push(text.substring(start, i + 1));
        start = -1;
      }
    }
  }

  // Try candidates from largest to smallest (the scope config is usually the biggest JSON)
  candidates.sort((a, b) => b.length - a.length);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed.scope && parsed.agents && Array.isArray(parsed.agents)) {
        return parsed as GeneratedScopeConfig;
      }
    } catch {
      continue;
    }
  }

  throw new Error('Could not extract valid scope configuration from AI response');
}

/**
 * Upload a SOP document and stream scope generation via SSE.
 * The file is sent as multipart/form-data so the backend agent can parse it autonomously.
 */
export async function generateScopeWithDocument(
  file: File,
  description: string,
  onEvent: GenerateCallback,
  signal?: AbortSignal,
): Promise<string> {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('description', description);

  const response = await fetch(`${API_BASE_URL}/api/scope-generator/generate-with-document`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Generation failed: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  return processSSEStream(reader, onEvent);
}

/**
 * Confirm and persist the generated scope + agents.
 */
export async function confirmScopeGeneration(
  config: GeneratedScopeConfig,
  isDefault = false,
): Promise<ConfirmResult> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/api/scope-generator/generate/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ config, isDefault }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Confirm failed: ${response.status}`);
  }

  const result = await response.json();
  return result.data as ConfirmResult;
}
