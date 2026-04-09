-- Document Groups
CREATE TABLE "document_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "storage_path" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_groups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "unique_doc_group_name_per_org" ON "document_groups"("organization_id", "name");
CREATE INDEX "document_groups_organization_id_idx" ON "document_groups"("organization_id");

-- Document Group Files
CREATE TABLE "document_group_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_group_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "original_filename" TEXT NOT NULL,
    "stored_filename" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL DEFAULT 0,
    "mime_type" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_group_files_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_group_files_document_group_id_fkey" FOREIGN KEY ("document_group_id") REFERENCES "document_groups"("id") ON DELETE CASCADE,
    CONSTRAINT "document_group_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE INDEX "document_group_files_document_group_id_idx" ON "document_group_files"("document_group_id");
CREATE INDEX "document_group_files_organization_id_idx" ON "document_group_files"("organization_id");

-- Scope ↔ Document Group assignments
CREATE TABLE "scope_document_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "business_scope_id" UUID NOT NULL,
    "document_group_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scope_document_groups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "scope_document_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "scope_document_groups_business_scope_id_fkey" FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE,
    CONSTRAINT "scope_document_groups_document_group_id_fkey" FOREIGN KEY ("document_group_id") REFERENCES "document_groups"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "scope_document_groups_business_scope_id_document_group_id_key" ON "scope_document_groups"("business_scope_id", "document_group_id");
CREATE INDEX "scope_document_groups_organization_id_idx" ON "scope_document_groups"("organization_id");
CREATE INDEX "scope_document_groups_business_scope_id_idx" ON "scope_document_groups"("business_scope_id");
CREATE INDEX "scope_document_groups_document_group_id_idx" ON "scope_document_groups"("document_group_id");
