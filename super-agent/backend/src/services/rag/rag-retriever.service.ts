/**
 * RAG Retriever Service
 *
 * Semantic search over document chunks scoped to a business scope's
 * assigned document groups. Uses pgvector cosine similarity.
 */

import { prisma } from '../../config/database.js';
import { embedText } from '../bedrock-embedder.js';

export interface RAGResult {
  chunkId: string;
  filename: string;
  content: string;
  similarity: number;
  chunkIndex: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

export class RagRetrieverService {
  /**
   * Search document chunks relevant to a query, scoped to a business scope's
   * assigned document groups.
   */
  async retrieve(
    query: string,
    scopeId: string,
    topK = 5,
    minSimilarity = 0.5,
  ): Promise<RAGResult[]> {
    // Get document group IDs assigned to this scope
    const assignments = await prisma.scope_document_groups.findMany({
      where: { business_scope_id: scopeId },
      select: { document_group_id: true },
    });

    if (assignments.length === 0) return [];

    const groupIds = assignments.map(a => a.document_group_id);

    // Embed the query
    const embedding = await embedText(query);
    const vecLiteral = `[${embedding.join(',')}]`;

    // Build placeholders for group IDs: $3, $4, $5, ...
    const placeholders = groupIds.map((_, i) => `$${i + 4}`).join(', ');

    const results = await prisma.$queryRawUnsafe<Array<{
      id: string;
      content: string;
      chunk_index: number;
      token_count: number;
      metadata: Record<string, unknown>;
      similarity: number;
    }>>(
      `SELECT dc.id, dc.content, dc.chunk_index, dc.token_count, dc.metadata,
              1 - (dc.embedding <=> $1::vector) AS similarity
       FROM document_chunks dc
       WHERE dc.document_group_id IN (${placeholders})
         AND dc.embedding IS NOT NULL
         AND 1 - (dc.embedding <=> $1::vector) > $2
       ORDER BY similarity DESC
       LIMIT $3`,
      vecLiteral,
      minSimilarity,
      topK,
      ...groupIds,
    );

    return results.map(r => ({
      chunkId: r.id,
      filename: (r.metadata?.filename as string) ?? 'unknown',
      content: r.content,
      similarity: r.similarity,
      chunkIndex: r.chunk_index,
      tokenCount: r.token_count,
      metadata: r.metadata,
    }));
  }
}

export const ragRetrieverService = new RagRetrieverService();
