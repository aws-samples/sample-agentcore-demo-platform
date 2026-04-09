/**
 * Document Indexer Service
 *
 * Extracts text from uploaded files, chunks it, vectorizes with Nova Embed,
 * and stores in document_chunks (pgvector). Runs asynchronously after file upload.
 */

import { prisma } from '../../config/database.js';
import { embedText } from '../bedrock-embedder.js';
import { extractText } from './document-extractor.js';
import { chunkText } from './document-chunker.js';
import { join } from 'path';

export function isRagEnabled(): boolean {
  return process.env.RAG_ENABLED === 'true' || process.env.RAG_ENABLED === '1';
}

export class DocumentIndexerService {
  /**
   * Index a single file: extract text → chunk → embed → store.
   * Fire-and-forget safe — logs errors but doesn't throw.
   */
  async indexFile(
    fileId: string,
    organizationId: string,
    documentGroupId: string,
    storagePath: string,
    storedFilename: string,
    mimeType: string,
    originalFilename: string,
  ): Promise<number> {
    if (!isRagEnabled()) return 0;

    const filePath = join(storagePath, storedFilename);

    // Extract text
    let text: string;
    try {
      text = await extractText(filePath, mimeType);
    } catch (err) {
      console.error(`[rag-indexer] Failed to extract text from ${originalFilename}:`, err instanceof Error ? err.message : err);
      return 0;
    }

    if (text.trim().length < 50) return 0; // Too short to index

    // Chunk
    const chunks = chunkText(text);
    if (chunks.length === 0) return 0;

    // Delete existing chunks for this file (re-index support)
    await prisma.$executeRawUnsafe(
      `DELETE FROM document_chunks WHERE file_id = $1`,
      fileId,
    );

    // Embed and insert each chunk
    let indexed = 0;
    for (const chunk of chunks) {
      try {
        const embedding = await embedText(chunk.content);
        const vecLiteral = `[${embedding.join(',')}]`;

        await prisma.$executeRawUnsafe(
          `INSERT INTO document_chunks
             (id, organization_id, document_group_id, file_id, chunk_index,
              content, token_count, embedding, metadata, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::vector, $8, now())`,
          organizationId,
          documentGroupId,
          fileId,
          chunk.index,
          chunk.content,
          chunk.tokenEstimate,
          vecLiteral,
          JSON.stringify({
            filename: originalFilename,
            startChar: chunk.startChar,
            endChar: chunk.endChar,
          }),
        );
        indexed++;
      } catch (err) {
        console.error(`[rag-indexer] Failed to index chunk ${chunk.index} of ${originalFilename}:`, err instanceof Error ? err.message : err);
      }
    }

    console.log(`[rag-indexer] Indexed ${indexed}/${chunks.length} chunks for ${originalFilename}`);
    return indexed;
  }

  /**
   * Index all files in a document group.
   */
  async indexGroup(groupId: string, organizationId: string): Promise<number> {
    if (!isRagEnabled()) return 0;

    const group = await prisma.document_groups.findFirst({
      where: { id: groupId, organization_id: organizationId },
      include: { files: true },
    });
    if (!group) return 0;

    let total = 0;
    for (const file of group.files) {
      const count = await this.indexFile(
        file.id,
        organizationId,
        groupId,
        group.storage_path,
        file.stored_filename,
        file.mime_type,
        file.original_filename,
      );
      total += count;
    }
    return total;
  }

  /**
   * Delete all chunks for a file.
   */
  async deleteFileIndex(fileId: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `DELETE FROM document_chunks WHERE file_id = $1`,
      fileId,
    );
  }

  /**
   * Get indexing status for a document group.
   */
  async getGroupStatus(groupId: string, organizationId: string): Promise<{
    totalFiles: number;
    indexedFiles: number;
    totalChunks: number;
  }> {
    const files = await prisma.document_group_files.findMany({
      where: { document_group_id: groupId, organization_id: organizationId },
      select: { id: true },
    });

    const indexedResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(DISTINCT file_id) as count FROM document_chunks WHERE document_group_id = $1`,
      groupId,
    );

    const chunkResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM document_chunks WHERE document_group_id = $1`,
      groupId,
    );

    return {
      totalFiles: files.length,
      indexedFiles: Number(indexedResult[0]?.count ?? 0),
      totalChunks: Number(chunkResult[0]?.count ?? 0),
    };
  }
}

export const documentIndexerService = new DocumentIndexerService();
