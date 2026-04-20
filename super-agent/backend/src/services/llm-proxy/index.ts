/**
 * LLM Proxy Module
 *
 * OpenAI-compatible LLM proxy layer that routes requests to AWS Bedrock.
 * Provides /v1/chat/completions and /v1/models endpoints authenticated
 * via the platform's API key system.
 */

export { LLMProxyService, recordLLMProxyUsage } from './llm-proxy.service.js';
export { OpenAIToBedrockConverter } from './openai-to-bedrock.js';
export { BedrockToOpenAIConverter } from './bedrock-to-openai.js';
export * from './types.js';
