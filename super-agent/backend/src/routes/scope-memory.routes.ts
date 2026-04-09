/**
 * Scope Memory Routes
 *
 * CRUD endpoints for managing scope memories + session summarization.
 * All routes require authentication.
 */

import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { scopeMemoryRepository } from '../repositories/scope-memory.repository.js';

interface ScopeParam { Params: { scopeId: string } }
interface MemoryParam { Params: { scopeId: string; memoryId: string } }

interface CreateMemoryBody {
  Params: { scopeId: string };
  Body: {
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    is_pinned?: boolean;
    session_id?: string;
  };
}

interface UpdateMemoryBody {
  Params: { scopeId: string; memoryId: string };
  Body: {
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    is_pinned?: boolean;
  };
}

interface SummarizeBody {
  Params: { scopeId: string };
  Body: { session_id: string };
}

export async function scopeMemoryRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /:scopeId/memories — List memories with optional filters */
  fastify.get<ScopeParam & { Querystring: { category?: string; q?: string; pinned?: string } }>(
    '/:scopeId/memories',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const query = request.query as { category?: string; q?: string; pinned?: string };
      const memories = await scopeMemoryRepository.findByScope(
        request.user!.orgId,
        request.params.scopeId,
        {
          category: query.category,
          q: query.q,
          pinned: query.pinned === 'true' ? true : query.pinned === 'false' ? false : undefined,
        },
      );
      return reply.status(200).send({ data: memories });
    },
  );

  /** POST /:scopeId/memories — Create a memory */
  fastify.post<CreateMemoryBody>(
    '/:scopeId/memories',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { title, content, category, tags, is_pinned, session_id } = request.body;
      if (!title || !content) {
        return reply.status(400).send({ error: 'title and content are required', code: 'VALIDATION_ERROR' });
      }

      const memory = await scopeMemoryRepository.create({
        organization_id: request.user!.orgId,
        business_scope_id: request.params.scopeId,
        session_id: session_id ?? null,
        title,
        content,
        category: category ?? 'lesson',
        tags: tags ?? [],
        is_pinned: is_pinned ?? false,
        created_by: request.user!.id,
      });

      return reply.status(201).send({ data: memory });
    },
  );

  /** PUT /:scopeId/memories/:memoryId — Update a memory */
  fastify.put<UpdateMemoryBody>(
    '/:scopeId/memories/:memoryId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const updated = await scopeMemoryRepository.update(
        request.params.memoryId,
        request.user!.orgId,
        request.body,
      );
      if (!updated) {
        return reply.status(404).send({ error: 'Memory not found', code: 'NOT_FOUND' });
      }
      return reply.status(200).send({ data: updated });
    },
  );

  /** DELETE /:scopeId/memories/:memoryId — Delete a memory */
  fastify.delete<MemoryParam>(
    '/:scopeId/memories/:memoryId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const deleted = await scopeMemoryRepository.delete(request.params.memoryId, request.user!.orgId);
      if (!deleted) {
        return reply.status(404).send({ error: 'Memory not found', code: 'NOT_FOUND' });
      }
      return reply.status(204).send();
    },
  );

  /** POST /:scopeId/memories/summarize — Summarize a chat session into a draft memory */
  fastify.post<SummarizeBody>(
    '/:scopeId/memories/summarize',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { session_id } = request.body;
      if (!session_id) {
        return reply.status(400).send({ error: 'session_id is required', code: 'VALIDATION_ERROR' });
      }

      const { chatService } = await import('../services/chat.service.js');
      const messages = await chatService.getSessionMessages(request.user!.orgId, session_id);

      if (messages.length === 0) {
        return reply.status(400).send({ error: 'Session has no messages', code: 'EMPTY_SESSION' });
      }

      // Build conversation transcript
      const transcript = messages
        .map(m => `[${m.type}]: ${m.content}`)
        .join('\n\n');

      const { aiService } = await import('../services/ai.service.js');
      const result = await aiService.chatCompletion({
        system_prompt: `You summarize chat sessions into concise, reusable knowledge entries for a business scope's memory system. Output valid JSON only, no markdown fences.

Format:
{
  "title": "Short descriptive title (max 80 chars)",
  "content": "Key takeaways, decisions, procedures, or facts learned. Be concise but preserve actionable details.",
  "category": "lesson|decision|procedure|fact",
  "tags": ["relevant", "tags"]
}

Pick the most appropriate category:
- lesson: something learned from experience
- decision: a decision that was made and why
- procedure: a step-by-step process discovered or refined
- fact: a domain fact or reference information`,
        messages: [
          { role: 'user', content: `Summarize this chat session into a knowledge entry:\n\n${transcript.slice(0, 20000)}` },
        ],
        max_tokens: 1024,
      });

      try {
        const parsed = JSON.parse(result);
        return reply.status(200).send({
          data: {
            title: parsed.title || 'Untitled',
            content: parsed.content || result,
            category: parsed.category || 'lesson',
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
            session_id,
          },
        });
      } catch {
        // If AI didn't return valid JSON, return raw text as content
        return reply.status(200).send({
          data: {
            title: 'Session Summary',
            content: result,
            category: 'lesson',
            tags: [],
            session_id,
          },
        });
      }
    },
  );
}
