-- Enable pgvector extension for semantic memory search.
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to scope_memories for vector similarity search.
-- Uses 1024 dimensions (Amazon Nova Multimodal Embeddings default).
ALTER TABLE "scope_memories" ADD COLUMN "embedding" vector(1024);

-- HNSW index for fast approximate nearest neighbor search.
CREATE INDEX "scope_memories_embedding_idx"
  ON "scope_memories"
  USING hnsw ("embedding" vector_cosine_ops);
