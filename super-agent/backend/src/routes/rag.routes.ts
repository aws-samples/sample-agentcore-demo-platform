/**
 * RAG Routes
 *
 * Semantic search over document chunks + indexing management.
 * All routes require authentication.
 */

import { FastifyInstance } from 'fastify';
import { authenticate, requireModifyAccess } from '../middleware/auth.js';
import { ragRetrieverService } from '../services/rag/rag-retriever.service.js';
import { documentIndexerService, isRagEnabled } from '../services/rag/document-indexer.service.js';

export async function ragRoutes(fastify: FastifyInstance): Promise<void> {
  /** GET /api/rag/search — semantic search over scope's document chunks */
  fastify.get<{ Querystring: { scope_id: string; q: string; top_k?: string; min_similarity?: string } }>(
    '/search',
    { preHandler: [authenticate] },
    async (request, reply) => {
      if (!isRagEnabled()) {
        return reply.status(400).send({ error: 'RAG is not enabled', code: 'RAG_DISABLED' });
      }

      const { scope_id, q, top_k, min_similarity } = request.query;
      if (!scope_id || !q) {
        return reply.status(400).send({ error: 'scope_id and q are required', code: 'VALIDATION_ERROR' });
      }

      const results = await ragRetrieverService.retrieve(
        q,
        scope_id,
        top_k ? parseInt(top_k, 10) : 5,
        min_similarity ? parseFloat(min_similarity) : 0.5,
      );

      return reply.send({ data: results });
    },
  );

  /** POST /api/rag/index/:fileId — manually index a single file */
  fastify.post<{ Params: { fileId: string }; Body: { document_group_id: string; storage_path: string; stored_filename: string; mime_type: string; original_filename: string } }>(
    '/index/:fileId',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      if (!isRagEnabled()) {
        return reply.status(400).send({ error: 'RAG is not enabled', code: 'RAG_DISABLED' });
      }

      const { document_group_id, storage_path, stored_filename, mime_type, original_filename } = request.body;
      const count = await documentIndexerService.indexFile(
        request.params.fileId,
        request.user!.orgId,
        document_group_id,
        storage_path,
        stored_filename,
        mime_type,
        original_filename,
      );

      return reply.send({ data: { indexed_chunks: count } });
    },
  );

  /** POST /api/rag/index-group/:groupId — index all files in a document group */
  fastify.post<{ Params: { groupId: string } }>(
    '/index-group/:groupId',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      if (!isRagEnabled()) {
        return reply.status(400).send({ error: 'RAG is not enabled', code: 'RAG_DISABLED' });
      }

      const count = await documentIndexerService.indexGroup(
        request.params.groupId,
        request.user!.orgId,
      );

      return reply.send({ data: { indexed_chunks: count } });
    },
  );

  /** GET /api/rag/status/:groupId — indexing status for a document group */
  fastify.get<{ Params: { groupId: string } }>(
    '/status/:groupId',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const status = await documentIndexerService.getGroupStatus(
        request.params.groupId,
        request.user!.orgId,
      );
      return reply.send({ data: { ...status, rag_enabled: isRagEnabled() } });
    },
  );

  /** DELETE /api/rag/index/:fileId — delete index for a file */
  fastify.delete<{ Params: { fileId: string } }>(
    '/index/:fileId',
    { preHandler: [authenticate, requireModifyAccess] },
    async (request, reply) => {
      await documentIndexerService.deleteFileIndex(request.params.fileId);
      return reply.status(204).send();
    },
  );
}
