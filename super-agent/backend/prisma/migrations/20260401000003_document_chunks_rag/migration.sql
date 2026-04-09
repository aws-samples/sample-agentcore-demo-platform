-- Document chunks for RAG semantic search.
-- Each uploaded file is split into chunks, vectorized, and stored here.

CREATE TABLE "document_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "document_group_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "chunk_index" INT NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INT DEFAULT 0,
    "embedding" vector(1024),
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_chunks_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "document_chunks_document_group_id_fkey"
        FOREIGN KEY ("document_group_id") REFERENCES "document_groups"("id") ON DELETE CASCADE,
    CONSTRAINT "document_chunks_file_id_fkey"
        FOREIGN KEY ("file_id") REFERENCES "document_group_files"("id") ON DELETE CASCADE
);

CREATE INDEX "document_chunks_embedding_idx"
    ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "document_chunks_document_group_id_idx" ON "document_chunks"("document_group_id");
CREATE INDEX "document_chunks_file_id_idx" ON "document_chunks"("file_id");
CREATE INDEX "document_chunks_organization_id_idx" ON "document_chunks"("organization_id");
