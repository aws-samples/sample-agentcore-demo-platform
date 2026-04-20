/**
 * LLM Proxy Routes
 *
 * OpenAI-compatible endpoints for LLM access via the platform's API keys.
 * Provides /v1/chat/completions and /v1/models — drop-in replacement for
 * OpenAI SDK base_url.
 *
 * Authentication: Bearer API key (same as openapi.routes.ts)
 * Required scope: model:invoke
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { apiKeyService } from '../services/apiKey.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { LLMProxyService, recordLLMProxyUsage } from '../services/llm-proxy/index.js';
import type { ChatCompletionRequest } from '../services/llm-proxy/types.js';

// ============================================================================
// API Key Auth (reuses platform API key system)
// ============================================================================

async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  const xApiKey = request.headers['x-api-key'] as string | undefined;

  let apiKey: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7);
  } else if (xApiKey) {
    // Anthropic SDK sends key via x-api-key header
    apiKey = xApiKey;
  }

  if (!apiKey) {
    throw AppError.unauthorized('Missing or invalid API key');
  }

  const keyData = await apiKeyService.validateApiKey(apiKey);

  if (!keyData) {
    throw AppError.unauthorized('Invalid or expired API key');
  }

  // Check rate limit
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const withinLimit = await apiKeyService.checkRateLimit(keyHash, keyData.rateLimitPerMinute);

  if (!withinLimit) {
    throw AppError.tooManyRequests('Rate limit exceeded');
  }

  (request as any).apiKeyData = keyData;
}

// ============================================================================
// Route Registration
// ============================================================================

const llmProxyService = new LLMProxyService();

export async function llmProxyRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/chat/completions
   * OpenAI-compatible chat completion endpoint.
   */
  fastify.post(
    '/v1/chat/completions',
    {
      preHandler: [apiKeyAuth],
      schema: {
        description: 'OpenAI-compatible chat completion (proxied to Bedrock)',
        tags: ['LLM Proxy'],
        security: [{ apiKey: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const keyData = (request as any).apiKeyData;
      const scopes = keyData.scopes as string[];

      // Check scope — allow model:invoke or wildcard
      if (!scopes.includes('model:invoke') && !scopes.includes('*')) {
        throw AppError.forbidden('API key does not have model:invoke scope');
      }

      const body = request.body as ChatCompletionRequest;
      if (!body?.model || !body?.messages?.length) {
        throw AppError.validation('model and messages are required');
      }

      const requestId = `chatcmpl-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      const startTime = Date.now();

      // Resolve cache TTL
      const cacheTtl = body.caching === false ? null : (body.cache_ttl ?? '5m');

      try {
        if (body.stream) {
          // ---- Streaming ----
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Request-ID': requestId,
          });

          let promptTokens = 0;
          let completionTokens = 0;
          let cachedTokens = 0;
          let cacheWriteTokens = 0;

          for await (const chunk of llmProxyService.chatCompletionStream(body, requestId, cacheTtl)) {
            // Internal usage marker — extract but don't send
            if (chunk.startsWith('__usage__:')) {
              try {
                const usage = JSON.parse(chunk.slice('__usage__:'.length));
                promptTokens = usage.prompt_tokens ?? 0;
                completionTokens = usage.completion_tokens ?? 0;
                cachedTokens = usage.cached_tokens ?? 0;
                cacheWriteTokens = usage.cache_write_tokens ?? 0;
              } catch { /* ignore */ }
              continue;
            }
            reply.raw.write(chunk);
          }

          reply.raw.end();

          // Record usage (fire-and-forget)
          recordLLMProxyUsage({
            organizationId: keyData.organizationId,
            userId: keyData.userId,
            model: body.model,
            promptTokens,
            completionTokens,
            cachedTokens,
            cacheWriteTokens,
          }).catch(() => {});

          return;
        }

        // ---- Non-streaming ----
        const { response, cacheUsage } = await llmProxyService.chatCompletion(body, requestId, cacheTtl);

        // Record usage (fire-and-forget)
        recordLLMProxyUsage({
          organizationId: keyData.organizationId,
          userId: keyData.userId,
          model: body.model,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          cachedTokens: cacheUsage.cached_tokens ?? 0,
          cacheWriteTokens: cacheUsage.cache_write_tokens ?? 0,
        }).catch(() => {});

        return reply.status(200).send(response);
      } catch (error: any) {
        request.log.error({ err: error, model: body.model }, 'LLM proxy error');

        // Map Bedrock errors to OpenAI-style errors
        const statusCode = error.httpStatusCode ?? error.$metadata?.httpStatusCode ?? 500;
        const errorType = statusCode === 429 ? 'rate_limit_error'
          : statusCode === 400 ? 'invalid_request_error'
          : 'server_error';

        return reply.status(statusCode).send({
          error: {
            message: error.message ?? 'Internal server error',
            type: errorType,
            code: error.name ?? 'internal_error',
          },
        });
      }
    },
  );

  /**
   * GET /v1/models
   * List available models.
   */
  fastify.get(
    '/v1/models',
    {
      preHandler: [apiKeyAuth],
      schema: {
        description: 'List available models',
        tags: ['LLM Proxy'],
        security: [{ apiKey: [] }],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const models = llmProxyService.listModels();
      return reply.status(200).send({
        object: 'list',
        data: models,
      });
    },
  );

  // ==========================================================================
  // Anthropic Messages API (/v1/messages)
  // ==========================================================================

  /**
   * POST /v1/messages
   * Anthropic-native Messages API endpoint.
   * Converts Anthropic format → internal ChatCompletionRequest → Bedrock.
   *
   * This lets users who prefer the Anthropic SDK (or Claude Code / OpenCode)
   * call the proxy directly without switching to the OpenAI protocol.
   */
  fastify.post(
    '/v1/messages',
    {
      preHandler: [apiKeyAuth],
      schema: {
        description: 'Anthropic-compatible Messages API (proxied to Bedrock)',
        tags: ['LLM Proxy'],
        security: [{ apiKey: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const keyData = (request as any).apiKeyData;
      const scopes = keyData.scopes as string[];

      if (!scopes.includes('model:invoke') && !scopes.includes('*')) {
        throw AppError.forbidden('API key does not have model:invoke scope');
      }

      const body = request.body as Record<string, unknown>;
      if (!body?.model || !body?.messages) {
        throw AppError.validation('model and messages are required');
      }

      const requestId = `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

      // Convert Anthropic messages format → OpenAI chat completion format
      const anthropicMessages = body.messages as Array<{ role: string; content: unknown }>;
      const convertedMessages: ChatCompletionRequest['messages'] = [];

      // System prompt (Anthropic puts it as a top-level field)
      if (body.system) {
        const systemText = typeof body.system === 'string'
          ? body.system
          : Array.isArray(body.system)
            ? (body.system as Array<{ text: string }>).map((b) => b.text).join('\n')
            : '';
        if (systemText) {
          convertedMessages.push({ role: 'system', content: systemText });
        }
      }

      for (const msg of anthropicMessages) {
        if (typeof msg.content === 'string') {
          convertedMessages.push({ role: msg.role as any, content: msg.content });
        } else if (Array.isArray(msg.content)) {
          // Convert Anthropic content blocks to OpenAI content parts
          const parts = (msg.content as Array<Record<string, unknown>>).map((block) => {
            if (block.type === 'text') return { type: 'text' as const, text: block.text as string };
            if (block.type === 'image') {
              const source = block.source as Record<string, string>;
              return {
                type: 'image_url' as const,
                image_url: { url: `data:${source.media_type};base64,${source.data}` },
              };
            }
            if (block.type === 'tool_use') {
              // Will be handled as tool_calls on assistant messages
              return { type: 'text' as const, text: '' };
            }
            if (block.type === 'tool_result') {
              return { type: 'text' as const, text: String(block.content ?? '') };
            }
            return { type: 'text' as const, text: JSON.stringify(block) };
          });
          convertedMessages.push({ role: msg.role as any, content: parts });
        }
      }

      const internalRequest: ChatCompletionRequest = {
        model: body.model as string,
        messages: convertedMessages,
        max_tokens: (body.max_tokens as number) ?? 4096,
        temperature: body.temperature as number | undefined,
        top_p: body.top_p as number | undefined,
        stream: body.stream as boolean | undefined,
        stop: body.stop_sequences as string[] | undefined,
      };

      // Extended thinking
      if (body.thinking) {
        internalRequest.thinking = body.thinking as any;
      }

      // Tools
      if (body.tools) {
        internalRequest.tools = (body.tools as Array<Record<string, unknown>>).map((t) => ({
          type: 'function' as const,
          function: {
            name: t.name as string,
            description: t.description as string | undefined,
            parameters: t.input_schema as any,
          },
        }));
      }

      const cacheTtl = '5m';

      try {
        if (internalRequest.stream) {
          // Streaming — convert SSE chunks to Anthropic event format
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          for await (const chunk of llmProxyService.chatCompletionStream(internalRequest, requestId, cacheTtl)) {
            if (chunk.startsWith('__usage__:')) continue;
            // Pass through SSE as-is (OpenAI chunk format)
            // Clients using Anthropic SDK with this endpoint should handle OpenAI SSE format
            reply.raw.write(chunk);
          }

          reply.raw.end();

          recordLLMProxyUsage({
            organizationId: keyData.organizationId,
            userId: keyData.userId,
            model: internalRequest.model,
            promptTokens: 0,
            completionTokens: 0,
          }).catch(() => {});

          return;
        }

        // Non-streaming — convert OpenAI response to Anthropic format
        const { response, cacheUsage } = await llmProxyService.chatCompletion(internalRequest, requestId, cacheTtl);

        const choice = response.choices[0];
        const contentBlocks: Record<string, unknown>[] = [];

        if (choice?.message.content) {
          contentBlocks.push({ type: 'text', text: choice.message.content });
        }
        if (choice?.message.tool_calls) {
          for (const tc of choice.message.tool_calls) {
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input: JSON.parse(tc.function.arguments || '{}'),
            });
          }
        }

        recordLLMProxyUsage({
          organizationId: keyData.organizationId,
          userId: keyData.userId,
          model: internalRequest.model,
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          cachedTokens: cacheUsage.cached_tokens ?? 0,
          cacheWriteTokens: cacheUsage.cache_write_tokens ?? 0,
        }).catch(() => {});

        // Return Anthropic Messages format
        return reply.status(200).send({
          id: requestId,
          type: 'message',
          role: 'assistant',
          model: response.model,
          content: contentBlocks,
          stop_reason: choice?.finish_reason === 'stop' ? 'end_turn'
            : choice?.finish_reason === 'length' ? 'max_tokens'
            : choice?.finish_reason === 'tool_calls' ? 'tool_use'
            : 'end_turn',
          usage: {
            input_tokens: response.usage.prompt_tokens,
            output_tokens: response.usage.completion_tokens,
            cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
          },
        });
      } catch (error: any) {
        request.log.error({ err: error, model: body.model }, 'LLM proxy messages error');
        const statusCode = error.httpStatusCode ?? error.$metadata?.httpStatusCode ?? 500;
        return reply.status(statusCode).send({
          type: 'error',
          error: {
            type: statusCode === 429 ? 'rate_limit_error' : 'api_error',
            message: error.message ?? 'Internal server error',
          },
        });
      }
    },
  );
}
