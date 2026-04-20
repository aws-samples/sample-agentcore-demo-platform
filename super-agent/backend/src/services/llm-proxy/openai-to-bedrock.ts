/**
 * OpenAI → Bedrock Converse Converter
 *
 * Converts OpenAI Chat Completion requests to AWS Bedrock Converse API format.
 * Ported from openai-api-convertor/app/converters/openai_to_bedrock.py
 */

import {
  ChatCompletionRequest,
  ChatMessage,
  ContentPart,
  Tool,
  DEFAULT_MODEL_MAPPING,
  REASONING_EFFORT_MAP,
  CACHING_UNSUPPORTED_MODELS,
  MODEL_CACHE_MIN_TOKENS,
} from './types.js';

const DEFAULT_CACHE_MIN_TOKENS = 1024;

export class OpenAIToBedrockConverter {
  private modelMapping: Record<string, string>;
  private resolvedModelId: string | null = null;

  constructor(customMapping?: Record<string, string>) {
    this.modelMapping = { ...DEFAULT_MODEL_MAPPING, ...customMapping };
  }

  getResolvedModelId(): string | null {
    return this.resolvedModelId;
  }

  convertRequest(request: ChatCompletionRequest, cacheTtl?: string | null): Record<string, unknown> {
    this.resolvedModelId = this.convertModelId(request.model);

    const bedrockRequest: Record<string, unknown> = {
      modelId: this.resolvedModelId,
      messages: this.convertMessages(request.messages),
      inferenceConfig: this.buildInferenceConfig(request),
    };

    const hasExplicitCache = this.hasExplicitCacheControl(request);

    // Extract system messages + inject response_format instructions
    let systemContent = this.extractSystem(request.messages);
    if (request.response_format) {
      const formatInstruction = this.buildResponseFormatInstruction(request.response_format);
      if (formatInstruction) {
        if (!systemContent) systemContent = [];
        systemContent.push({ text: formatInstruction });
      }
    }
    if (systemContent) {
      bedrockRequest.system = systemContent;
    }

    // Convert tools
    if (request.tools?.length) {
      bedrockRequest.toolConfig = this.convertTools(request.tools, request.tool_choice);
    }

    // Auto cache injection
    if (cacheTtl && !hasExplicitCache) {
      if (this.modelSupportsCaching(request.model, this.resolvedModelId)) {
        this.injectCachePoints(bedrockRequest, cacheTtl, request.model);
      }
    }

    // Extended thinking
    let thinkingConfig = request.thinking;
    if (!thinkingConfig && request.reasoning_effort) {
      const budget = REASONING_EFFORT_MAP[request.reasoning_effort] ?? 10000;
      thinkingConfig = { type: 'enabled', budget_tokens: budget };
    }

    if (thinkingConfig && thinkingConfig.type === 'enabled') {
      const additional = (bedrockRequest.additionalModelRequestFields as Record<string, unknown>) || {};
      additional.thinking = thinkingConfig;
      bedrockRequest.additionalModelRequestFields = additional;

      const inferenceConfig = bedrockRequest.inferenceConfig as Record<string, unknown>;
      delete inferenceConfig.topP;
      inferenceConfig.temperature = 1.0;

      const budget = thinkingConfig.budget_tokens ?? 0;
      const currentMax = (inferenceConfig.maxTokens as number) ?? 4096;
      if (currentMax <= budget) {
        inferenceConfig.maxTokens = budget + 4096;
      }
    }

    return bedrockRequest;
  }

  private convertModelId(openaiModelId: string): string {
    return this.modelMapping[openaiModelId] ?? openaiModelId;
  }

  private convertMessages(messages: ChatMessage[]): Record<string, unknown>[] {
    const bedrockMessages: Record<string, unknown>[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      const role = msg.role === 'user' || msg.role === 'tool' ? 'user' : 'assistant';
      const content = this.convertContent(msg);

      // Merge consecutive same-role messages (Bedrock requires alternating turns)
      if (bedrockMessages.length > 0 && bedrockMessages[bedrockMessages.length - 1].role === role) {
        const prev = bedrockMessages[bedrockMessages.length - 1].content as unknown[];
        prev.push(...content);
      } else {
        bedrockMessages.push({ role, content });
      }
    }

    return bedrockMessages;
  }

  private convertContent(msg: ChatMessage): Record<string, unknown>[] {
    const content: Record<string, unknown>[] = [];

    // Tool result
    if (msg.role === 'tool' && msg.tool_call_id) {
      content.push({
        toolResult: {
          toolUseId: msg.tool_call_id,
          content: [{ text: msg.content || '' }],
          status: 'success',
        },
      });
      return content;
    }

    // Assistant tool calls
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        content.push({
          toolUse: {
            toolUseId: tc.id,
            name: tc.function.name,
            input: this.parseJsonSafe(tc.function.arguments),
          },
        });
      }
      if (msg.content && typeof msg.content === 'string') {
        content.unshift({ text: msg.content });
      }
      return content;
    }

    // String content
    if (typeof msg.content === 'string') {
      return [{ text: msg.content }];
    }

    // Array content (vision / multi-part)
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'text') {
          content.push({ text: (part as { text: string }).text });
        } else if (part.type === 'image_url') {
          const imageData = this.processImage((part as { image_url: { url: string } }).image_url.url);
          if (imageData) content.push({ image: imageData });
        }
      }
    }

    return content.length > 0 ? content : [{ text: '' }];
  }

  private processImage(url: string): Record<string, unknown> | null {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:image\/(\w+);base64,(.+)/);
      if (match) {
        return {
          format: match[1],
          source: { bytes: Buffer.from(match[2], 'base64') },
        };
      }
    }
    // For HTTP URLs, we'd need to fetch — skip for now (can be added later)
    return null;
  }

  private extractSystem(messages: ChatMessage[]): Record<string, unknown>[] | null {
    const parts: Record<string, unknown>[] = [];
    for (const msg of messages) {
      if (msg.role === 'system' && msg.content) {
        if (typeof msg.content === 'string') {
          parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'text') {
              parts.push({ text: (part as { text: string }).text });
            }
          }
        }
      }
    }
    return parts.length > 0 ? parts : null;
  }

  private buildInferenceConfig(request: ChatCompletionRequest): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    const maxTok = request.max_completion_tokens ?? request.max_tokens;
    if (maxTok) config.maxTokens = maxTok;
    if (request.temperature != null) {
      config.temperature = Math.min(request.temperature, 1.0);
    } else if (request.top_p != null) {
      config.topP = request.top_p;
    }
    if (request.stop) {
      const stops = Array.isArray(request.stop) ? request.stop : [request.stop];
      config.stopSequences = stops.slice(0, 4);
    }
    return config;
  }

  private convertTools(tools: Tool[], toolChoice?: ChatCompletionRequest['tool_choice']): Record<string, unknown> {
    const bedrockTools = tools.map((tool) => ({
      toolSpec: {
        name: tool.function.name,
        description: tool.function.description || '',
        inputSchema: {
          json: {
            type: 'object',
            properties: tool.function.parameters?.properties ?? {},
            required: tool.function.parameters?.required ?? [],
          },
        },
      },
    }));

    const toolConfig: Record<string, unknown> = { tools: bedrockTools };

    if (toolChoice) {
      if (toolChoice === 'none' || toolChoice === 'auto') {
        toolConfig.toolChoice = { auto: {} };
      } else if (toolChoice === 'required') {
        toolConfig.toolChoice = { any: {} };
      } else if (typeof toolChoice === 'object' && toolChoice.type === 'function') {
        toolConfig.toolChoice = { tool: { name: toolChoice.function.name } };
      }
    }

    return toolConfig;
  }

  private buildResponseFormatInstruction(responseFormat: NonNullable<ChatCompletionRequest['response_format']>): string | null {
    if (responseFormat.type === 'text') return null;
    if (responseFormat.type === 'json_object') {
      return (
        '\n\n[RESPONSE FORMAT REQUIREMENT] ' +
        'Your entire response must be a single valid JSON object. ' +
        'Do NOT include ```json or ``` markers. ' +
        'Do NOT include any explanatory text before or after the JSON. ' +
        'Start your response with { and end with }.'
      );
    }
    if (responseFormat.type === 'json_schema' && responseFormat.json_schema) {
      const schema = responseFormat.json_schema;
      const schemaJson = JSON.stringify(schema.schema ?? {}, null, 2);
      return (
        `\n\n[RESPONSE FORMAT REQUIREMENT] ` +
        `Your entire response must be a single valid JSON object that strictly conforms to this schema:\n` +
        `Schema name: ${schema.name}\n` +
        `${schemaJson}\n` +
        `Do NOT include \`\`\`json or \`\`\` markers. ` +
        `Do NOT include any explanatory text before or after the JSON. ` +
        `Start your response with { and end with }.`
      );
    }
    return null;
  }

  private hasExplicitCacheControl(request: ChatCompletionRequest): boolean {
    for (const msg of request.messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text' && (part as any).cache_control) return true;
        }
      }
    }
    return false;
  }

  private modelSupportsCaching(openaiModel: string, bedrockModel: string): boolean {
    return !CACHING_UNSUPPORTED_MODELS.has(openaiModel) && !CACHING_UNSUPPORTED_MODELS.has(bedrockModel);
  }

  private estimateTokens(text: string): number {
    let cjkChars = 0;
    for (const c of text) {
      const code = c.charCodeAt(0);
      if (
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0x3400 && code <= 0x4dbf) ||
        (code >= 0x3000 && code <= 0x303f) ||
        (code >= 0x3040 && code <= 0x309f) ||
        (code >= 0x30a0 && code <= 0x30ff) ||
        (code >= 0xac00 && code <= 0xd7af)
      ) {
        cjkChars++;
      }
    }
    const otherChars = text.length - cjkChars;
    return cjkChars / 1.5 + otherChars / 4;
  }

  private estimateMessageTokens(message: Record<string, unknown>): number {
    const content = message.content;
    if (typeof content === 'string') return this.estimateTokens(content);
    if (!Array.isArray(content)) return 0;
    let total = 0;
    for (const block of content) {
      if (typeof block === 'object' && block && 'text' in block) {
        total += this.estimateTokens(String((block as any).text));
      }
    }
    return total;
  }

  private injectCachePoints(bedrockRequest: Record<string, unknown>, ttl: string, model: string): void {
    const cachePoint = { cachePoint: { type: 'default', ttl } };
    const minTokens = MODEL_CACHE_MIN_TOKENS[model] ?? DEFAULT_CACHE_MIN_TOKENS;
    let cumulativeTokens = 0;
    let cachePlaced = false;

    // 1. System prompt end
    const system = bedrockRequest.system as Record<string, unknown>[] | undefined;
    if (system) {
      const systemText = system.map((b) => (b as any).text ?? '').join(' ');
      cumulativeTokens += this.estimateTokens(systemText);
      if (cumulativeTokens >= minTokens) {
        system.push({ ...cachePoint });
        cachePlaced = true;
      }
    }

    // 2. Tools definition end
    const toolConfig = bedrockRequest.toolConfig as Record<string, unknown> | undefined;
    if (toolConfig) {
      const tools = toolConfig.tools as unknown[];
      if (tools?.length) {
        cumulativeTokens += this.estimateTokens(JSON.stringify(tools));
        if (!cachePlaced && cumulativeTokens >= minTokens) {
          tools.push({ ...cachePoint });
          cachePlaced = true;
        } else if (cachePlaced) {
          tools.push({ ...cachePoint });
        }
      }
    }

    // 3. Messages
    const messages = bedrockRequest.messages as Record<string, unknown>[];
    if (!cachePlaced && messages?.length >= 1) {
      for (let i = 0; i < messages.length; i++) {
        cumulativeTokens += this.estimateMessageTokens(messages[i]);
        if (cumulativeTokens >= minTokens && Array.isArray(messages[i].content)) {
          (messages[i].content as unknown[]).push({ ...cachePoint });
          cachePlaced = true;
          break;
        }
      }
    }

    // 4. Multi-turn: cache last assistant message
    if (cachePlaced && messages?.length >= 3) {
      for (let i = messages.length - 2; i >= 0; i--) {
        if (messages[i].role === 'assistant' && Array.isArray(messages[i].content)) {
          (messages[i].content as unknown[]).push({ ...cachePoint });
          break;
        }
      }
    }
  }

  private parseJsonSafe(s: string): Record<string, unknown> {
    try {
      return JSON.parse(s);
    } catch {
      return {};
    }
  }
}
