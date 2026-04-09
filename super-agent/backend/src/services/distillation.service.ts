/**
 * Distillation Service
 *
 * Analyzes completed conversations and automatically extracts memories
 * (patterns, lessons, gaps) into scope_memories.
 *
 * Runs asynchronously after each chat turn — never blocks the SSE stream.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { config } from '../config/index.js';
import { scopeMemoryRepository } from '../repositories/scope-memory.repository.js';
import type { ContentBlock } from './claude-agent.service.js';

// Use a lightweight model for distillation to keep costs low
const DISTILLATION_MODEL_ID = 'us.amazon.nova-2-lite-v1:0';

const bedrockClient = new BedrockRuntimeClient({ region: config.aws.region });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistillationInput {
  organizationId: string;
  scopeId: string;
  sessionId: string;
  agentId: string;
  contentBlocks: ContentBlock[];
  userMessage: string;
}

interface ExtractedMemory {
  title: string;
  content: string;
  category: 'pattern' | 'lesson' | 'gap';
  tags: string[];
}

// ---------------------------------------------------------------------------
// Rate limiting — per-scope cooldown to avoid cost explosion
// ---------------------------------------------------------------------------

const lastDistillationTime = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes per scope

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const DISTILLATION_SYSTEM_PROMPT = `You are a conversation analyst for an AI agent platform. Your job is to analyze a completed agent conversation and extract valuable memories that will help the agent improve over time.

Analyze the conversation from three dimensions:

1. **pattern**: Recurring user needs or effective solution paths the agent used.
   - Only extract if the pattern is reusable and non-obvious.
2. **lesson**: Mistakes, corrections, or improvements discovered during the conversation.
   - Include cases where the user corrected the agent, or the agent had to retry.
3. **gap**: Capabilities the agent lacked — questions it couldn't answer, tools it didn't have, or tasks it failed.
   - Only flag genuine capability gaps, not normal conversation flow.

Rules:
- Be selective. Most conversations are routine — return an empty array [] if nothing is worth remembering.
- Each memory should be concise: title ≤ 60 chars, content ≤ 300 chars.
- Tags should be lowercase, kebab-case, 1-4 tags per memory.
- Maximum 3 memories per conversation.
- Write in the same language as the conversation.

Output ONLY a JSON array (no markdown fences, no explanation):
[{"title":"...","content":"...","category":"pattern|lesson|gap","tags":["..."]}]

If nothing is worth extracting, output: []`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DistillationService {
  /**
   * Enqueue a conversation for distillation. Fire-and-forget.
   * Respects per-scope cooldown to avoid cost explosion on high-frequency scopes.
   */
  async enqueue(input: DistillationInput): Promise<void> {
    const now = Date.now();
    const lastTime = lastDistillationTime.get(input.scopeId) ?? 0;
    if (now - lastTime < COOLDOWN_MS) {
      return; // Skip — too soon since last distillation for this scope
    }
    lastDistillationTime.set(input.scopeId, now);

    // Run in background — caller should .catch(() => {}) the returned promise
    try {
      await this.distill(input);
    } catch (err) {
      console.error('[distillation] Failed:', err instanceof Error ? err.message : err);
    }
  }

  private async distill(input: DistillationInput): Promise<void> {
    const conversationText = this.formatConversation(input.userMessage, input.contentBlocks);

    // Skip very short conversations — nothing to learn from
    if (conversationText.length < 200) return;

    const memories = await this.callLLM(conversationText);
    if (memories.length === 0) return;

    // Deduplicate against existing memories (simple title similarity check)
    const existing = await scopeMemoryRepository.findByScope(
      input.organizationId,
      input.scopeId,
      { limit: 50 },
    );
    const existingTitles = new Set(existing.map(m => m.title.toLowerCase()));

    for (const memory of memories) {
      // Skip if a memory with very similar title already exists
      if (existingTitles.has(memory.title.toLowerCase())) continue;

      await scopeMemoryRepository.create({
        organization_id: input.organizationId,
        business_scope_id: input.scopeId,
        session_id: input.sessionId,
        title: memory.title,
        content: memory.content,
        category: memory.category,
        tags: [...memory.tags, 'auto-distilled'],
        is_pinned: false,
        created_by: null, // system-generated
      });

      // Sync to vector memory if configured (fire-and-forget)
      this.syncToVectorMemory(memory, input).catch(() => {});
    }
  }

  private async syncToVectorMemory(memory: ExtractedMemory, input: DistillationInput): Promise<void> {
    const { isVectorMemoryEnabled, getVectorProvider } = await import('./memory-provider.js');
    if (!isVectorMemoryEnabled()) return;
    const provider = getVectorProvider();
    if (!provider) return;
    await provider.add(
      { title: memory.title, content: memory.content, category: memory.category, tags: [...memory.tags, 'auto-distilled'], is_pinned: false },
      { organizationId: input.organizationId, scopeId: input.scopeId, agentId: input.agentId },
    );
  }

  private formatConversation(userMessage: string, contentBlocks: ContentBlock[]): string {
    const parts: string[] = [`User: ${userMessage}`];

    for (const block of contentBlocks) {
      if (block.type === 'text') {
        parts.push(`Agent: ${block.text}`);
      } else if (block.type === 'tool_use') {
        parts.push(`Agent [tool: ${block.name}]: ${JSON.stringify(block.input).slice(0, 500)}`);
      } else if (block.type === 'tool_result') {
        const preview = (block.content ?? '').slice(0, 300);
        parts.push(`Tool result: ${preview}`);
      }
    }

    // Cap at ~8K chars to keep distillation prompt reasonable
    const full = parts.join('\n');
    return full.length > 8000 ? full.slice(0, 8000) + '\n[...truncated]' : full;
  }

  private async callLLM(conversationText: string): Promise<ExtractedMemory[]> {
    const command = new InvokeModelCommand({
      modelId: DISTILLATION_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: [{ text: `Analyze this conversation:\n\n${conversationText}` }] },
        ],
        system: [{ text: DISTILLATION_SYSTEM_PROMPT }],
        inferenceConfig: {
          max_new_tokens: 1024,
          temperature: 0.3,
        },
      }),
    });

    const response = await bedrockClient.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));

    const text: string = body?.output?.message?.content?.[0]?.text ?? '[]';

    return this.parseResponse(text);
  }

  private parseResponse(text: string): ExtractedMemory[] {
    try {
      // Strip markdown fences if present
      let json = text.trim();
      const fenceMatch = json.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) json = fenceMatch[1]!.trim();

      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return [];

      // Validate and sanitize each entry
      const validCategories = new Set(['pattern', 'lesson', 'gap']);
      return parsed
        .filter(
          (m: unknown): m is ExtractedMemory =>
            typeof m === 'object' &&
            m !== null &&
            typeof (m as ExtractedMemory).title === 'string' &&
            typeof (m as ExtractedMemory).content === 'string' &&
            validCategories.has((m as ExtractedMemory).category) &&
            Array.isArray((m as ExtractedMemory).tags),
        )
        .slice(0, 3) // Hard cap at 3 memories per conversation
        .map(m => ({
          title: m.title.slice(0, 100),
          content: m.content.slice(0, 500),
          category: m.category,
          tags: m.tags.filter((t: unknown) => typeof t === 'string').slice(0, 5),
        }));
    } catch {
      console.error('[distillation] Failed to parse LLM response:', text.slice(0, 200));
      return [];
    }
  }
}

export const distillationService = new DistillationService();
