/**
 * Vector Memory Service
 *
 * Lightweight Mem0-inspired semantic memory layer built on:
 *   - Amazon Nova Multimodal Embeddings (Bedrock) for vectorization
 *   - PostgreSQL + pgvector for storage and similarity search
 *   - Existing scope_memories table (extended with embedding column)
 *
 * Core behaviors inspired by Mem0:
 *   - add(): embed text, check for duplicates (cosine > 0.92), merge or insert
 *   - search(): embed query, return top-K by cosine similarity
 *   - No external dependencies beyond Bedrock + PostgreSQL
 */

import { prisma } from '../config/database.js';
import { embedText, EMBEDDING_DIMENSION } from './bedrock-embedder.js';

// Similarity threshold for dedup/merge — above this, memories are considered duplicates
const DEDUP_THRESHOLD = 0.92;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VectorMemoryInput {
  organizationId: string;
  scopeId: string;
  sessionId?: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdBy?: string;
}

export interface VectorSearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  similarity: number;
  is_pinned: boolean;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class VectorMemoryService {
  /**
   * Add a memory with embedding. If a very similar memory already exists
   * (cosine similarity > threshold), merge content instead of creating a new one.
   */
  async add(input: VectorMemoryInput): Promise<string> {
    const textToEmbed = `${input.title}: ${input.content}`;
    const embedding = await embedText(textToEmbed);
    const vecLiteral = `[${embedding.join(',')}]`;

    // Check for near-duplicates in the same scope
    const duplicates = await prisma.$queryRawUnsafe<
      Array<{ id: string; title: string; content: string; similarity: number }>
    >(
      `SELECT id, title, content,
              1 - (embedding <=> $1::vector) AS similarity
       FROM scope_memories
       WHERE business_scope_id = $2
         AND embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) > $3
       ORDER BY similarity DESC
       LIMIT 1`,
      vecLiteral,
      input.scopeId,
      DEDUP_THRESHOLD,
    );

    if (duplicates.length > 0) {
      // Merge: append new content to existing memory
      const existing = duplicates[0]!;
      const mergedContent = existing.content.length + input.content.length > 800
        ? input.content // If too long, just replace
        : `${existing.content}\n---\n${input.content}`;

      // Re-embed the merged content
      const mergedEmbedding = await embedText(`${existing.title}: ${mergedContent}`);
      const mergedVec = `[${mergedEmbedding.join(',')}]`;

      await prisma.$executeRawUnsafe(
        `UPDATE scope_memories
         SET content = $1, embedding = $2::vector, updated_at = now()
         WHERE id = $3`,
        mergedContent,
        mergedVec,
        existing.id,
      );

      return existing.id;
    }

    // Insert new memory with embedding
    const result = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO scope_memories
         (id, organization_id, business_scope_id, session_id, title, content,
          category, tags, is_pinned, created_by, embedding, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, false, $8, $9::vector, now(), now())
       RETURNING id`,
      input.organizationId,
      input.scopeId,
      input.sessionId ?? null,
      input.title,
      input.content,
      input.category,
      input.tags,
      input.createdBy ?? null,
      vecLiteral,
    );

    return result[0]?.id ?? '';
  }

  /**
   * Semantic search: embed the query and return top-K most similar memories.
   */
  async search(
    query: string,
    scopeId: string,
    limit = 10,
    minSimilarity = 0.5,
  ): Promise<VectorSearchResult[]> {
    const embedding = await embedText(query);
    const vecLiteral = `[${embedding.join(',')}]`;

    return prisma.$queryRawUnsafe<VectorSearchResult[]>(
      `SELECT id, title, content, category, tags, is_pinned, created_at,
              1 - (embedding <=> $1::vector) AS similarity
       FROM scope_memories
       WHERE business_scope_id = $2
         AND embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) > $3
       ORDER BY similarity DESC
       LIMIT $4`,
      vecLiteral,
      scopeId,
      minSimilarity,
      limit,
    );
  }

  /**
   * Backfill embeddings for existing memories that don't have one yet.
   * Useful for migrating existing scope_memories to vector search.
   */
  async backfillEmbeddings(scopeId: string, batchSize = 20): Promise<number> {
    const memories = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; content: string }>>(
      `SELECT id, title, content FROM scope_memories
       WHERE business_scope_id = $1 AND embedding IS NULL
       LIMIT $2`,
      scopeId,
      batchSize,
    );

    let count = 0;
    for (const m of memories) {
      try {
        const embedding = await embedText(`${m.title}: ${m.content}`);
        const vecLiteral = `[${embedding.join(',')}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE scope_memories SET embedding = $1::vector WHERE id = $2`,
          vecLiteral,
          m.id,
        );
        count++;
      } catch (err) {
        console.error(`[vector-memory] Failed to embed memory ${m.id}:`, err instanceof Error ? err.message : err);
      }
    }

    return count;
  }
}

export const vectorMemoryService = new VectorMemoryService();
