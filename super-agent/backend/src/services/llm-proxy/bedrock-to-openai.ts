/**
 * Bedrock → OpenAI Response Converter
 *
 * Converts Bedrock Converse API responses to OpenAI Chat Completion format.
 * Ported from openai-api-convertor/app/converters/bedrock_to_openai.py
 */

import { randomUUID } from 'crypto';
import {
  ChatCompletionResponse,
  ChatCompletionChunk,
  Choice,
  ChoiceMessage,
  StreamChoice,
  DeltaMessage,
  ToolCallResponse,
  Usage,
  PromptTokensDetails,
  CacheCreation,
} from './types.js';

const STOP_REASON_MAP: Record<string, string> = {
  end_turn: 'stop',
  stop_sequence: 'stop',
  max_tokens: 'length',
  tool_use: 'tool_calls',
  content_filtered: 'content_filter',
};

export class BedrockToOpenAIConverter {
  // Streaming state
  private streamToolState = new Map<number, { id: string; name: string; index: number }>();
  private streamToolCallCount = 0;

  resetStreamState(): void {
    this.streamToolState.clear();
    this.streamToolCallCount = 0;
  }

  convertResponse(
    bedrockResponse: Record<string, unknown>,
    model: string,
    requestId?: string,
    cacheTtl?: string | null,
  ): ChatCompletionResponse {
    const responseId = requestId ?? `chatcmpl-${randomUUID().replace(/-/g, '').slice(0, 24)}`;

    const output = (bedrockResponse.output as Record<string, unknown>) ?? {};
    const message = (output.message as Record<string, unknown>) ?? {};
    const contentBlocks = (message.content as Record<string, unknown>[]) ?? [];

    let textContent = '';
    const toolCalls: ToolCallResponse[] = [];
    let thinkingContent: string | null = null;

    for (const block of contentBlocks) {
      if ('text' in block) {
        textContent += block.text;
      } else if ('toolUse' in block) {
        const tu = block.toolUse as Record<string, unknown>;
        toolCalls.push({
          id: (tu.toolUseId as string) ?? `call_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
          type: 'function',
          function: {
            name: (tu.name as string) ?? '',
            arguments: JSON.stringify(tu.input ?? {}),
          },
        });
      } else if ('reasoningContent' in block) {
        const rc = block.reasoningContent as Record<string, unknown>;
        if ('reasoningText' in rc) {
          thinkingContent = ((rc.reasoningText as Record<string, unknown>)?.text as string) ?? '';
        }
      }
    }

    const choiceMessage: ChoiceMessage = {
      role: 'assistant',
      content: textContent || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : null,
      thinking: thinkingContent,
    };

    const stopReason = (bedrockResponse.stopReason as string) ?? 'end_turn';
    let finishReason = STOP_REASON_MAP[stopReason] ?? 'stop';
    if (toolCalls.length > 0) finishReason = 'tool_calls';

    const usage = this.buildUsage(bedrockResponse, cacheTtl);

    return {
      id: responseId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: choiceMessage,
          finish_reason: finishReason as Choice['finish_reason'],
        },
      ],
      usage,
    };
  }

  convertStreamEvent(
    event: Record<string, unknown>,
    model: string,
    requestId: string,
    currentIndex: number = 0,
  ): string[] {
    const events: string[] = [];

    // Message start
    if ('messageStart' in event) {
      this.resetStreamState();
      events.push(this.sseChunk({
        id: requestId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
      }));
    }

    // Content block start (tool use)
    else if ('contentBlockStart' in event) {
      const cbs = event.contentBlockStart as Record<string, unknown>;
      const blockIndex = (cbs.contentBlockIndex as number) ?? currentIndex;
      const start = (cbs.start as Record<string, unknown>) ?? {};

      if ('toolUse' in start) {
        const tu = start.toolUse as Record<string, unknown>;
        const toolId = (tu.toolUseId as string) ?? `call_${currentIndex}`;
        const toolName = (tu.name as string) ?? '';
        const toolCallIdx = this.streamToolCallCount++;
        this.streamToolState.set(blockIndex, { id: toolId, name: toolName, index: toolCallIdx });

        events.push(this.sseChunk({
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{
            index: 0,
            delta: {
              tool_calls: [{
                index: toolCallIdx,
                id: toolId,
                type: 'function',
                function: { name: toolName, arguments: '' },
              }],
            },
            finish_reason: null,
          }],
        }));
      }
    }

    // Content block delta
    else if ('contentBlockDelta' in event) {
      const cbd = event.contentBlockDelta as Record<string, unknown>;
      const delta = (cbd.delta as Record<string, unknown>) ?? {};

      if ('text' in delta) {
        events.push(this.sseChunk({
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: { content: delta.text as string }, finish_reason: null }],
        }));
      } else if ('toolUse' in delta) {
        const tu = delta.toolUse as Record<string, unknown>;
        const inputChunk = (tu.input as string) ?? '';
        if (inputChunk) {
          const blockIndex = (cbd.contentBlockIndex as number) ?? currentIndex;
          const state = this.streamToolState.get(blockIndex) ?? { id: `call_${currentIndex}`, name: '', index: 0 };

          events.push(this.sseChunk({
            id: requestId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [{
              index: 0,
              delta: {
                tool_calls: [{
                  index: state.index,
                  id: state.id,
                  type: 'function',
                  function: { name: state.name, arguments: inputChunk },
                }],
              },
              finish_reason: null,
            }],
          }));
        }
      }
    }

    // Message stop
    else if ('messageStop' in event) {
      const ms = event.messageStop as Record<string, unknown>;
      const stopReason = (ms.stopReason as string) ?? 'end_turn';
      const finishReason = STOP_REASON_MAP[stopReason] ?? 'stop';

      events.push(this.sseChunk({
        id: requestId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
      }));
    }

    return events;
  }

  extractStreamUsage(event: Record<string, unknown>): Record<string, number> | null {
    if (!('metadata' in event)) return null;
    const metadata = event.metadata as Record<string, unknown>;
    const usage = (metadata.usage as Record<string, number>) ?? {};
    if (!usage.inputTokens && !usage.outputTokens) return null;

    const inputTokens = usage.inputTokens ?? 0;
    const cacheRead = usage.cacheReadInputTokens ?? 0;
    const cacheWrite = usage.cacheWriteInputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;
    const promptTokens = inputTokens + cacheRead + cacheWrite;

    return {
      prompt_tokens: promptTokens,
      completion_tokens: outputTokens,
      total_tokens: promptTokens + outputTokens,
      cached_tokens: cacheRead,
      cache_write_tokens: cacheWrite,
    };
  }

  buildUsageChunk(requestId: string, model: string, usageData: Record<string, number>, cacheTtl?: string | null): string {
    const usage = this.buildUsageFromData(usageData, cacheTtl);
    return this.sseChunk({
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [],
      usage,
    });
  }

  extractCacheUsage(bedrockResponse: Record<string, unknown>): Record<string, number> {
    const usageData = (bedrockResponse.usage as Record<string, number>) ?? {};
    return {
      cached_tokens: usageData.cacheReadInputTokens ?? 0,
      cache_write_tokens: usageData.cacheWriteInputTokens ?? 0,
    };
  }

  private buildUsage(bedrockResponse: Record<string, unknown>, cacheTtl?: string | null): Usage {
    const usageData = (bedrockResponse.usage as Record<string, number>) ?? {};
    const inputTokens = usageData.inputTokens ?? 0;
    const cacheRead = usageData.cacheReadInputTokens ?? 0;
    const cacheWrite = usageData.cacheWriteInputTokens ?? 0;
    const outputTokens = usageData.outputTokens ?? 0;
    const promptTokens = inputTokens + cacheRead + cacheWrite;

    let promptDetails: PromptTokensDetails | null = null;
    let cacheCreation: CacheCreation | null = null;

    if (cacheRead > 0 || cacheWrite > 0) {
      promptDetails = { cached_tokens: cacheRead };
      const ttl = cacheTtl ?? '5m';
      cacheCreation = {
        ephemeral_5m_input_tokens: ttl === '5m' ? cacheWrite : 0,
        ephemeral_1h_input_tokens: ttl === '1h' ? cacheWrite : 0,
      };
    }

    return {
      prompt_tokens: promptTokens,
      completion_tokens: outputTokens,
      total_tokens: promptTokens + outputTokens,
      prompt_tokens_details: promptDetails,
      cache_creation_input_tokens: cacheWrite,
      cache_read_input_tokens: cacheRead,
      cache_creation: cacheCreation,
    };
  }

  private buildUsageFromData(usageData: Record<string, number>, cacheTtl?: string | null): Usage {
    const cached = usageData.cached_tokens ?? 0;
    const cacheWrite = usageData.cache_write_tokens ?? 0;

    let promptDetails: PromptTokensDetails | null = null;
    let cacheCreation: CacheCreation | null = null;

    if (cached > 0 || cacheWrite > 0) {
      promptDetails = { cached_tokens: cached };
      const ttl = cacheTtl ?? '5m';
      cacheCreation = {
        ephemeral_5m_input_tokens: ttl === '5m' ? cacheWrite : 0,
        ephemeral_1h_input_tokens: ttl === '1h' ? cacheWrite : 0,
      };
    }

    return {
      prompt_tokens: usageData.prompt_tokens ?? 0,
      completion_tokens: usageData.completion_tokens ?? 0,
      total_tokens: usageData.total_tokens ?? 0,
      prompt_tokens_details: promptDetails,
      cache_creation_input_tokens: cacheWrite,
      cache_read_input_tokens: cached,
      cache_creation: cacheCreation,
    };
  }

  private sseChunk(chunk: Record<string, unknown>): string {
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }
}
