/**
 * LLM Proxy Types
 *
 * OpenAI-compatible request/response types for the LLM proxy layer.
 * Ported from openai-api-convertor (Python Pydantic schemas → TypeScript).
 */

// ============================================================================
// Request Types
// ============================================================================

export interface StreamOptions {
  include_usage?: boolean;
}

export interface JsonSchema {
  name: string;
  strict?: boolean;
  schema?: Record<string, unknown>;
}

export interface ResponseFormat {
  type: 'text' | 'json_object' | 'json_schema';
  json_schema?: JsonSchema;
}

export interface CacheControl {
  type: string; // "ephemeral"
}

export interface TextContent {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
}

export interface ImageURL {
  url: string;
  detail?: 'auto' | 'low' | 'high';
}

export interface ImageContent {
  type: 'image_url';
  image_url: ImageURL;
}

export type ContentPart = TextContent | ImageContent;

export interface FunctionParameters {
  type: string;
  properties: Record<string, unknown>;
  required?: string[];
}

export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: FunctionParameters;
}

export interface Tool {
  type: 'function';
  function: FunctionDefinition;
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface ToolCallRequest {
  id: string;
  type: 'function';
  function: FunctionCall;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | ContentPart[] | null;
  name?: string;
  tool_calls?: ToolCallRequest[];
  tool_call_id?: string;
}

export interface ThinkingConfig {
  type: 'enabled' | 'disabled';
  budget_tokens?: number;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
  response_format?: ResponseFormat;
  stream_options?: StreamOptions;
  reasoning_effort?: 'low' | 'medium' | 'high';
  thinking?: ThinkingConfig;
  caching?: boolean;
  cache_ttl?: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface PromptTokensDetails {
  cached_tokens: number;
}

export interface CacheCreation {
  ephemeral_5m_input_tokens: number;
  ephemeral_1h_input_tokens: number;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: PromptTokensDetails | null;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: CacheCreation | null;
}

export interface ToolCallResponse {
  index?: number;
  id: string;
  type: 'function';
  function: FunctionCall;
}

export interface ChoiceMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: ToolCallResponse[] | null;
  thinking?: string | null;
}

export interface Choice {
  index: number;
  message: ChoiceMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Choice[];
  usage: Usage;
}

// ============================================================================
// Streaming Types
// ============================================================================

export interface DeltaMessage {
  role?: 'assistant';
  content?: string | null;
  tool_calls?: ToolCallResponse[] | null;
}

export interface StreamChoice {
  index: number;
  delta: DeltaMessage;
  finish_reason: string | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: StreamChoice[];
  usage?: Usage | null;
}

// ============================================================================
// Model Mapping
// ============================================================================

export interface ModelMapping {
  openaiModelId: string;
  bedrockModelId: string;
}

export interface ModelInfo {
  id: string;
  bedrockModelId: string;
  provider: string;
  displayName: string;
  capabilities: {
    vision: boolean;
    toolUse: boolean;
    streaming: boolean;
    extendedThinking: boolean;
  };
  /** Which API protocols this model supports */
  protocols: ('chat_completions' | 'messages')[];
}

export const MODEL_CATALOG: ModelInfo[] = [
  // ---- Anthropic Claude ----
  {
    id: 'claude-opus-4-5',
    bedrockModelId: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.5',
    capabilities: { vision: true, toolUse: true, streaming: true, extendedThinking: true },
    protocols: ['chat_completions', 'messages'],
  },
  {
    id: 'claude-opus-4-6',
    bedrockModelId: 'us.anthropic.claude-opus-4-6-v1',
    provider: 'anthropic',
    displayName: 'Claude Opus 4.6',
    capabilities: { vision: true, toolUse: true, streaming: true, extendedThinking: true },
    protocols: ['chat_completions', 'messages'],
  },
  {
    id: 'claude-sonnet-4-5',
    bedrockModelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.5',
    capabilities: { vision: true, toolUse: true, streaming: true, extendedThinking: true },
    protocols: ['chat_completions', 'messages'],
  },
  {
    id: 'claude-sonnet-4-6',
    bedrockModelId: 'us.anthropic.claude-sonnet-4-6-v1',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.6',
    capabilities: { vision: true, toolUse: true, streaming: true, extendedThinking: true },
    protocols: ['chat_completions', 'messages'],
  },
  {
    id: 'claude-haiku-4-5',
    bedrockModelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    provider: 'anthropic',
    displayName: 'Claude Haiku 4.5',
    capabilities: { vision: true, toolUse: true, streaming: true, extendedThinking: false },
    protocols: ['chat_completions', 'messages'],
  },
  {
    id: 'claude-3-5-haiku',
    bedrockModelId: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    capabilities: { vision: false, toolUse: true, streaming: true, extendedThinking: false },
    protocols: ['chat_completions', 'messages'],
  },
  // ---- Moonshot AI ----
  {
    id: 'kimi-k2.5',
    bedrockModelId: 'moonshotai.kimi-k2.5',
    provider: 'moonshot',
    displayName: 'Kimi K2.5',
    capabilities: { vision: true, toolUse: true, streaming: true, extendedThinking: false },
    protocols: ['chat_completions'],
  },
  // ---- Zhipu AI ----
  {
    id: 'glm-4.7',
    bedrockModelId: 'zai.glm-4.7',
    provider: 'zhipu',
    displayName: 'GLM 4.7',
    capabilities: { vision: false, toolUse: true, streaming: true, extendedThinking: false },
    protocols: ['chat_completions'],
  },
  {
    id: 'glm-4.7-flash',
    bedrockModelId: 'zai.glm-4.7-flash',
    provider: 'zhipu',
    displayName: 'GLM 4.7 Flash',
    capabilities: { vision: false, toolUse: true, streaming: true, extendedThinking: false },
    protocols: ['chat_completions'],
  },
  // ---- DeepSeek ----
  {
    id: 'deepseek-v3.2',
    bedrockModelId: 'deepseek.deepseek-v3-0324-v1:0',
    provider: 'deepseek',
    displayName: 'DeepSeek V3.2',
    capabilities: { vision: false, toolUse: true, streaming: true, extendedThinking: false },
    protocols: ['chat_completions'],
  },
  // ---- Amazon Nova ----
  {
    id: 'nova-pro',
    bedrockModelId: 'us.amazon.nova-pro-v1:0',
    provider: 'amazon',
    displayName: 'Amazon Nova Pro',
    capabilities: { vision: true, toolUse: true, streaming: true, extendedThinking: false },
    protocols: ['chat_completions'],
  },
  {
    id: 'nova-lite',
    bedrockModelId: 'us.amazon.nova-lite-v1:0',
    provider: 'amazon',
    displayName: 'Amazon Nova Lite',
    capabilities: { vision: true, toolUse: true, streaming: true, extendedThinking: false },
    protocols: ['chat_completions'],
  },
];

/** Quick lookup: friendly model ID → Bedrock model ID */
export const DEFAULT_MODEL_MAPPING: Record<string, string> = Object.fromEntries(
  MODEL_CATALOG.map((m) => [m.id, m.bedrockModelId]),
);

export const REASONING_EFFORT_MAP: Record<string, number> = {
  low: 1024,
  medium: 10000,
  high: 32000,
};

export const CACHING_UNSUPPORTED_MODELS = new Set([
  'claude-3-5-haiku',
  'us.anthropic.claude-3-5-haiku-20241022-v1:0',
]);

export const MODEL_CACHE_MIN_TOKENS: Record<string, number> = {
  'claude-sonnet-4-5': 1024,
  'claude-sonnet-4-6': 2048,
  'claude-opus-4-5': 4096,
  'claude-opus-4-6': 4096,
  'claude-haiku-4-5': 2048,
};
