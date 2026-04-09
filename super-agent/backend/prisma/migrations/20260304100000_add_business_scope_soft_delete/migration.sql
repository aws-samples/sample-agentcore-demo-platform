-- Add soft delete column to business_scopes
ALTER TABLE "business_scopes" ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- Index for efficient filtering of non-deleted scopes
CREATE INDEX "business_scopes_deleted_at_idx" ON "business_scopes"("deleted_at");
