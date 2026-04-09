-- DropForeignKey
ALTER TABLE "skill_marketplace" DROP CONSTRAINT "skill_marketplace_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "skill_marketplace" DROP CONSTRAINT "skill_marketplace_skill_id_fkey";

-- DropForeignKey
ALTER TABLE "skill_votes" DROP CONSTRAINT "skill_votes_skill_marketplace_id_fkey";

-- DropForeignKey
ALTER TABLE "skills" DROP CONSTRAINT "skills_business_scope_id_fkey";

-- AlterTable
ALTER TABLE "agent_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "agent_metrics_daily" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "app_ratings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "app_usage_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "app_versions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "mcp_servers" ADD COLUMN     "config" JSONB;

-- AlterTable
ALTER TABLE "published_apps" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "scope_mcp_servers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "scope_plugins" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "skill_marketplace" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "skill_votes" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "skill_marketplace" ADD CONSTRAINT "skill_marketplace_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_marketplace" ADD CONSTRAINT "skill_marketplace_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_votes" ADD CONSTRAINT "skill_votes_skill_marketplace_id_fkey" FOREIGN KEY ("skill_marketplace_id") REFERENCES "skill_marketplace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "agent_events_agent_type_created" RENAME TO "agent_events_agent_id_event_type_created_at_idx";

-- RenameIndex
ALTER INDEX "agent_events_created" RENAME TO "agent_events_created_at_idx";

-- RenameIndex
ALTER INDEX "agent_events_org_type_created" RENAME TO "agent_events_organization_id_event_type_created_at_idx";

-- RenameIndex
ALTER INDEX "agent_events_session" RENAME TO "agent_events_session_id_idx";

-- RenameIndex
ALTER INDEX "agent_events_target_agent_created" RENAME TO "agent_events_target_agent_id_created_at_idx";

-- RenameIndex
ALTER INDEX "agent_metrics_daily_agent_date" RENAME TO "agent_metrics_daily_agent_id_metric_date_idx";

-- RenameIndex
ALTER INDEX "agent_metrics_daily_org_date" RENAME TO "agent_metrics_daily_organization_id_metric_date_idx";

-- RenameIndex
ALTER INDEX "unique_daily_metric" RENAME TO "agent_metrics_daily_organization_id_agent_id_metric_date_ev_key";

-- RenameIndex
ALTER INDEX "unique_scope_mcp_server" RENAME TO "scope_mcp_servers_business_scope_id_mcp_server_id_key";

-- RenameIndex
ALTER INDEX "unique_scope_plugin" RENAME TO "scope_plugins_business_scope_id_name_key";

-- RenameIndex
ALTER INDEX "idx_skill_marketplace_install_count" RENAME TO "skill_marketplace_install_count_idx";

-- RenameIndex
ALTER INDEX "idx_skill_marketplace_org_category" RENAME TO "skill_marketplace_organization_id_category_idx";

-- RenameIndex
ALTER INDEX "idx_skill_marketplace_org_status" RENAME TO "skill_marketplace_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_skill_marketplace_published_at" RENAME TO "skill_marketplace_published_at_idx";

-- RenameIndex
ALTER INDEX "idx_skill_marketplace_vote_score" RENAME TO "skill_marketplace_vote_score_idx";

-- RenameIndex
ALTER INDEX "unique_marketplace_skill_per_org" RENAME TO "skill_marketplace_organization_id_skill_id_key";

-- RenameIndex
ALTER INDEX "idx_skill_votes_marketplace_id" RENAME TO "skill_votes_skill_marketplace_id_idx";

-- RenameIndex
ALTER INDEX "idx_skill_votes_user_id" RENAME TO "skill_votes_user_id_idx";

-- RenameIndex
ALTER INDEX "unique_vote_per_user" RENAME TO "skill_votes_skill_marketplace_id_user_id_key";

-- RenameIndex
ALTER INDEX "idx_skills_business_scope_id" RENAME TO "skills_business_scope_id_idx";

-- RenameIndex
ALTER INDEX "idx_skills_org_scope" RENAME TO "skills_organization_id_business_scope_id_idx";

-- RenameIndex
ALTER INDEX "idx_skills_skill_type" RENAME TO "skills_skill_type_idx";
