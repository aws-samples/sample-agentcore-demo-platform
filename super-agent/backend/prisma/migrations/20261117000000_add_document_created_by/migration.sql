-- Record who uploaded each document so documents:delete can be limited to the
-- uploader (admins and owners can still delete any document). Existing rows
-- keep a NULL owner, which only admins and owners may delete.
ALTER TABLE "documents" ADD COLUMN "created_by" UUID;
CREATE INDEX "documents_created_by_idx" ON "documents"("created_by");
