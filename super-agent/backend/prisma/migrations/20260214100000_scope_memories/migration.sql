-- Scope Memories: persistent knowledge accumulated per business scope

CREATE TABLE "scope_memories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "business_scope_id" UUID NOT NULL,
    "session_id" UUID,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'lesson',
    "tags" TEXT[] DEFAULT '{}',
    "is_pinned" BOOLEAN DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "scope_memories_pkey" PRIMARY KEY ("id")
);

-- Full-text search vector (title weighted higher than content)
ALTER TABLE "scope_memories" ADD COLUMN "search_vector" TSVECTOR
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("content", '')), 'B')
  ) STORED;

-- Indexes
CREATE INDEX "idx_scope_memories_org" ON "scope_memories"("organization_id");
CREATE INDEX "idx_scope_memories_scope" ON "scope_memories"("business_scope_id");
CREATE INDEX "idx_scope_memories_category" ON "scope_memories"("category");
CREATE INDEX "idx_scope_memories_pinned" ON "scope_memories"("business_scope_id", "is_pinned") WHERE "is_pinned" = true;
CREATE INDEX "idx_scope_memories_search" ON "scope_memories" USING GIN("search_vector");
CREATE INDEX "idx_scope_memories_created" ON "scope_memories"("created_at" DESC);

-- Foreign keys
ALTER TABLE "scope_memories" ADD CONSTRAINT "scope_memories_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scope_memories" ADD CONSTRAINT "scope_memories_business_scope_id_fkey"
  FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scope_memories" ADD CONSTRAINT "scope_memories_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
