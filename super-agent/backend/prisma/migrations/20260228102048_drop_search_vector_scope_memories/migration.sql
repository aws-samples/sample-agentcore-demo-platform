/*
  Warnings:

  - You are about to drop the column `search_vector` on the `scope_memories` table. All the data in the column will be lost.
  - You are about to drop the `agentcore_runtimes` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `logs` on table `schedule_execution_records` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tags` on table `scope_briefings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `scope_briefings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `importance` on table `scope_briefings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `generated_at` on table `scope_briefings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_read` on table `scope_briefings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_archived` on table `scope_briefings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `scope_briefings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `scope_briefings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_pinned` on table `scope_memories` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "agentcore_runtimes" DROP CONSTRAINT "agentcore_runtimes_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "agentcore_runtimes" DROP CONSTRAINT "agentcore_runtimes_scope_id_fkey";

-- DropForeignKey
ALTER TABLE "app_data" DROP CONSTRAINT "app_data_app_id_fkey";

-- DropForeignKey
ALTER TABLE "app_data" DROP CONSTRAINT "app_data_org_id_fkey";

-- DropForeignKey
ALTER TABLE "im_channel_bindings" DROP CONSTRAINT "im_channel_bindings_business_scope_id_fkey";

-- DropForeignKey
ALTER TABLE "im_channel_bindings" DROP CONSTRAINT "im_channel_bindings_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "im_thread_sessions" DROP CONSTRAINT "im_thread_sessions_binding_id_fkey";

-- DropForeignKey
ALTER TABLE "im_thread_sessions" DROP CONSTRAINT "im_thread_sessions_session_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_briefings" DROP CONSTRAINT "scope_briefings_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_briefings" DROP CONSTRAINT "scope_briefings_business_scope_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_briefings" DROP CONSTRAINT "scope_briefings_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_memberships" DROP CONSTRAINT "scope_memberships_business_scope_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_memberships" DROP CONSTRAINT "scope_memberships_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_memories" DROP CONSTRAINT "scope_memories_session_id_fkey";

-- DropIndex
DROP INDEX "idx_app_data_gin";

-- DropIndex
DROP INDEX "idx_scope_memories_search";

-- AlterTable
ALTER TABLE "app_data" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "business_scopes" ALTER COLUMN "visibility" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "im_channel_bindings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "im_thread_sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "schedule_execution_records" ALTER COLUMN "logs" SET NOT NULL;

-- AlterTable
ALTER TABLE "scope_briefings" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "tags" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL,
ALTER COLUMN "importance" SET NOT NULL,
ALTER COLUMN "generated_at" SET NOT NULL,
ALTER COLUMN "is_read" SET NOT NULL,
ALTER COLUMN "is_archived" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "scope_memberships" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "role" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "scope_memories" DROP COLUMN "search_vector",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "is_pinned" SET NOT NULL;

-- DropTable
DROP TABLE "agentcore_runtimes";

-- CreateIndex
CREATE INDEX "scope_briefings_business_scope_id_is_read_idx" ON "scope_briefings"("business_scope_id", "is_read");

-- CreateIndex
CREATE INDEX "scope_memories_business_scope_id_is_pinned_idx" ON "scope_memories"("business_scope_id", "is_pinned");

-- AddForeignKey
ALTER TABLE "scope_memberships" ADD CONSTRAINT "scope_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_memberships" ADD CONSTRAINT "scope_memberships_business_scope_id_fkey" FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_channel_bindings" ADD CONSTRAINT "im_channel_bindings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_channel_bindings" ADD CONSTRAINT "im_channel_bindings_business_scope_id_fkey" FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_thread_sessions" ADD CONSTRAINT "im_thread_sessions_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "im_channel_bindings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "im_thread_sessions" ADD CONSTRAINT "im_thread_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_briefings" ADD CONSTRAINT "scope_briefings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_briefings" ADD CONSTRAINT "scope_briefings_business_scope_id_fkey" FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_briefings" ADD CONSTRAINT "scope_briefings_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_data" ADD CONSTRAINT "app_data_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "published_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_data" ADD CONSTRAINT "app_data_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_app_data_app_collection" RENAME TO "app_data_app_id_collection_idx";

-- RenameIndex
ALTER INDEX "idx_app_data_created" RENAME TO "app_data_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_app_data_org" RENAME TO "app_data_org_id_idx";

-- RenameIndex
ALTER INDEX "unique_channel_binding" RENAME TO "im_channel_bindings_organization_id_channel_type_channel_id_key";

-- RenameIndex
ALTER INDEX "unique_thread_per_binding" RENAME TO "im_thread_sessions_binding_id_thread_id_key";

-- RenameIndex
ALTER INDEX "idx_scope_briefings_importance" RENAME TO "scope_briefings_business_scope_id_importance_idx";

-- RenameIndex
ALTER INDEX "idx_scope_briefings_scope" RENAME TO "scope_briefings_business_scope_id_event_time_idx";

-- RenameIndex
ALTER INDEX "idx_scope_briefings_source" RENAME TO "scope_briefings_source_type_source_id_idx";

-- RenameIndex
ALTER INDEX "idx_scope_briefings_status" RENAME TO "scope_briefings_business_scope_id_status_idx";

-- RenameIndex
ALTER INDEX "unique_briefing_source" RENAME TO "scope_briefings_business_scope_id_source_type_source_id_key";

-- RenameIndex
ALTER INDEX "idx_scope_memberships_org" RENAME TO "scope_memberships_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_scope_memberships_scope" RENAME TO "scope_memberships_business_scope_id_idx";

-- RenameIndex
ALTER INDEX "idx_scope_memberships_scope_user" RENAME TO "scope_memberships_business_scope_id_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_scope_memberships_user" RENAME TO "scope_memberships_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_scope_memories_category" RENAME TO "scope_memories_category_idx";

-- RenameIndex
ALTER INDEX "idx_scope_memories_created" RENAME TO "scope_memories_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_scope_memories_org" RENAME TO "scope_memories_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_scope_memories_scope" RENAME TO "scope_memories_business_scope_id_idx";
