-- Drop pgvector columns/tables that were removed from Prisma schema
-- These were created by hand-written migrations but later removed from schema.prisma.
-- The underlying data (embeddings, chunks) will be re-created when RAG is re-implemented.

-- Drop document_chunks table (created by 20260401000003_document_chunks_rag)
DROP TABLE IF EXISTS "document_chunks";

-- Drop embedding column from scope_memories (created by 20260401000002_scope_memories_pgvector)
DROP INDEX IF EXISTS "scope_memories_embedding_idx";
ALTER TABLE "scope_memories" DROP COLUMN IF EXISTS "embedding";
