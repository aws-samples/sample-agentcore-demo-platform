-- DropForeignKey
ALTER TABLE "document_group_files" DROP CONSTRAINT "document_group_files_document_group_id_fkey";

-- DropForeignKey
ALTER TABLE "document_group_files" DROP CONSTRAINT "document_group_files_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "document_groups" DROP CONSTRAINT "document_groups_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_document_groups" DROP CONSTRAINT "scope_document_groups_business_scope_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_document_groups" DROP CONSTRAINT "scope_document_groups_document_group_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_document_groups" DROP CONSTRAINT "scope_document_groups_organization_id_fkey";

-- AlterTable
ALTER TABLE "document_group_files" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "document_groups" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "execution_checkpoints" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "scope_document_groups" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "document_groups" ADD CONSTRAINT "document_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_group_files" ADD CONSTRAINT "document_group_files_document_group_id_fkey" FOREIGN KEY ("document_group_id") REFERENCES "document_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_group_files" ADD CONSTRAINT "document_group_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_document_groups" ADD CONSTRAINT "scope_document_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_document_groups" ADD CONSTRAINT "scope_document_groups_business_scope_id_fkey" FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_document_groups" ADD CONSTRAINT "scope_document_groups_document_group_id_fkey" FOREIGN KEY ("document_group_id") REFERENCES "document_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "unique_doc_group_name_per_org" RENAME TO "document_groups_organization_id_name_key";

-- RenameIndex
ALTER INDEX "idx_checkpoints_execution" RENAME TO "execution_checkpoints_execution_id_idx";

-- RenameIndex
ALTER INDEX "idx_checkpoints_org" RENAME TO "execution_checkpoints_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_checkpoints_status" RENAME TO "execution_checkpoints_status_idx";
