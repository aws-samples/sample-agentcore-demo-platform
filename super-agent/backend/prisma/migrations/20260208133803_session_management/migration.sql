/*
  Warnings:

  - A unique constraint covering the columns `[webhook_id]` on the table `webhooks` will be added. If there are existing duplicate values, this will fail.
  - Made the column `scopes` on table `api_keys` required. This step will fail if there are existing NULL values in that column.
  - Made the column `rate_limit_per_minute` on table `api_keys` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_active` on table `api_keys` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `api_keys` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `api_keys` required. This step will fail if there are existing NULL values in that column.
  - Made the column `status` on table `schedule_execution_records` required. This step will fail if there are existing NULL values in that column.
  - Made the column `retry_count` on table `schedule_execution_records` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `schedule_execution_records` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tags` on table `skills` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `skills` required. This step will fail if there are existing NULL values in that column.
  - Made the column `status` on table `webhook_call_records` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `webhook_call_records` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_enabled` on table `webhooks` required. This step will fail if there are existing NULL values in that column.
  - Made the column `timeout_seconds` on table `webhooks` required. This step will fail if there are existing NULL values in that column.
  - Made the column `allowed_ips` on table `webhooks` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `webhooks` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `webhooks` required. This step will fail if there are existing NULL values in that column.
  - Made the column `trigger_type` on table `workflow_executions` required. This step will fail if there are existing NULL values in that column.
  - Made the column `timezone` on table `workflow_schedules` required. This step will fail if there are existing NULL values in that column.
  - Made the column `is_enabled` on table `workflow_schedules` required. This step will fail if there are existing NULL values in that column.
  - Made the column `variables` on table `workflow_schedules` required. This step will fail if there are existing NULL values in that column.
  - Made the column `run_count` on table `workflow_schedules` required. This step will fail if there are existing NULL values in that column.
  - Made the column `failure_count` on table `workflow_schedules` required. This step will fail if there are existing NULL values in that column.
  - Made the column `max_retries` on table `workflow_schedules` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `workflow_schedules` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updated_at` on table `workflow_schedules` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "agent_skills" DROP CONSTRAINT "agent_skills_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "agent_skills" DROP CONSTRAINT "agent_skills_skill_id_fkey";

-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "schedule_execution_records" DROP CONSTRAINT "schedule_execution_records_execution_id_fkey";

-- DropForeignKey
ALTER TABLE "schedule_execution_records" DROP CONSTRAINT "schedule_execution_records_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "schedule_execution_records" DROP CONSTRAINT "schedule_execution_records_schedule_id_fkey";

-- DropForeignKey
ALTER TABLE "skills" DROP CONSTRAINT "skills_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "webhook_call_records" DROP CONSTRAINT "webhook_call_records_execution_id_fkey";

-- DropForeignKey
ALTER TABLE "webhook_call_records" DROP CONSTRAINT "webhook_call_records_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "webhooks" DROP CONSTRAINT "webhooks_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "webhooks" DROP CONSTRAINT "webhooks_workflow_id_fkey";

-- DropForeignKey
ALTER TABLE "workflow_schedules" DROP CONSTRAINT "workflow_schedules_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "workflow_schedules" DROP CONSTRAINT "workflow_schedules_workflow_id_fkey";

-- AlterTable
ALTER TABLE "agent_skills" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "agents" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "api_keys" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "scopes" SET NOT NULL,
ALTER COLUMN "rate_limit_per_minute" SET NOT NULL,
ALTER COLUMN "is_active" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "business_scopes" ADD COLUMN     "config_version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chat_messages" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "agent_id" UUID,
ADD COLUMN     "business_scope_id" UUID,
ADD COLUMN     "claude_session_id" TEXT,
ADD COLUMN     "title" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "mcp_servers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "memberships" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "node_executions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "schedule_execution_records" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "retry_count" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "skills" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "display_name" SET DATA TYPE TEXT,
ALTER COLUMN "tags" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL;

-- AlterTable
ALTER TABLE "tasks" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "webhook_call_records" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "webhooks" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "is_enabled" SET NOT NULL,
ALTER COLUMN "timeout_seconds" SET NOT NULL,
ALTER COLUMN "allowed_ips" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "workflow_executions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "trigger_type" SET NOT NULL;

-- AlterTable
ALTER TABLE "workflow_schedules" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "timezone" SET NOT NULL,
ALTER COLUMN "is_enabled" SET NOT NULL,
ALTER COLUMN "variables" SET NOT NULL,
ALTER COLUMN "run_count" SET NOT NULL,
ALTER COLUMN "failure_count" SET NOT NULL,
ALTER COLUMN "max_retries" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "workflows" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "api_keys_is_active_idx" ON "api_keys"("is_active");

-- CreateIndex
CREATE INDEX "chat_sessions_business_scope_id_idx" ON "chat_sessions"("business_scope_id");

-- CreateIndex
CREATE INDEX "chat_sessions_organization_id_business_scope_id_idx" ON "chat_sessions"("organization_id", "business_scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhooks_webhook_id_key" ON "webhooks"("webhook_id");

-- CreateIndex
CREATE INDEX "webhooks_is_enabled_idx" ON "webhooks"("is_enabled");

-- CreateIndex
CREATE INDEX "workflow_schedules_is_enabled_idx" ON "workflow_schedules"("is_enabled");

-- CreateIndex
CREATE INDEX "workflow_schedules_next_run_at_idx" ON "workflow_schedules"("next_run_at");

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_business_scope_id_fkey" FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_call_records" ADD CONSTRAINT "webhook_call_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_call_records" ADD CONSTRAINT "webhook_call_records_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("webhook_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_call_records" ADD CONSTRAINT "webhook_call_records_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_schedules" ADD CONSTRAINT "workflow_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_schedules" ADD CONSTRAINT "workflow_schedules_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_execution_records" ADD CONSTRAINT "schedule_execution_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_execution_records" ADD CONSTRAINT "schedule_execution_records_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "workflow_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_execution_records" ADD CONSTRAINT "schedule_execution_records_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_agent_skills_agent_id" RENAME TO "agent_skills_agent_id_idx";

-- RenameIndex
ALTER INDEX "idx_agent_skills_skill_id" RENAME TO "agent_skills_skill_id_idx";

-- RenameIndex
ALTER INDEX "unique_agent_skill" RENAME TO "agent_skills_agent_id_skill_id_key";

-- RenameIndex
ALTER INDEX "idx_agents_business_scope_id" RENAME TO "agents_business_scope_id_idx";

-- RenameIndex
ALTER INDEX "idx_agents_created_at" RENAME TO "agents_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_agents_name" RENAME TO "agents_name_idx";

-- RenameIndex
ALTER INDEX "idx_agents_org_scope" RENAME TO "agents_organization_id_business_scope_id_idx";

-- RenameIndex
ALTER INDEX "idx_agents_organization_id" RENAME TO "agents_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_agents_status" RENAME TO "agents_status_idx";

-- RenameIndex
ALTER INDEX "idx_api_keys_key_hash" RENAME TO "api_keys_key_hash_key";

-- RenameIndex
ALTER INDEX "idx_api_keys_organization" RENAME TO "api_keys_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_api_keys_prefix" RENAME TO "api_keys_key_prefix_idx";

-- RenameIndex
ALTER INDEX "idx_api_keys_user" RENAME TO "api_keys_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_business_scopes_is_default" RENAME TO "business_scopes_is_default_idx";

-- RenameIndex
ALTER INDEX "idx_business_scopes_name" RENAME TO "business_scopes_name_idx";

-- RenameIndex
ALTER INDEX "idx_business_scopes_org_name" RENAME TO "business_scopes_organization_id_name_idx";

-- RenameIndex
ALTER INDEX "idx_business_scopes_organization_id" RENAME TO "business_scopes_organization_id_idx";

-- RenameIndex
ALTER INDEX "unique_scope_name_per_org" RENAME TO "business_scopes_organization_id_name_key";

-- RenameIndex
ALTER INDEX "idx_chat_messages_created_at" RENAME TO "chat_messages_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_chat_messages_organization_id" RENAME TO "chat_messages_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_chat_messages_session_created" RENAME TO "chat_messages_session_id_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_chat_messages_session_id" RENAME TO "chat_messages_session_id_idx";

-- RenameIndex
ALTER INDEX "idx_chat_messages_type" RENAME TO "chat_messages_type_idx";

-- RenameIndex
ALTER INDEX "idx_chat_sessions_created_at" RENAME TO "chat_sessions_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_chat_sessions_org_user" RENAME TO "chat_sessions_organization_id_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_chat_sessions_organization_id" RENAME TO "chat_sessions_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_chat_sessions_user_id" RENAME TO "chat_sessions_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_documents_category" RENAME TO "documents_category_idx";

-- RenameIndex
ALTER INDEX "idx_documents_created_at" RENAME TO "documents_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_documents_file_type" RENAME TO "documents_file_type_idx";

-- RenameIndex
ALTER INDEX "idx_documents_org_category" RENAME TO "documents_organization_id_category_idx";

-- RenameIndex
ALTER INDEX "idx_documents_org_status" RENAME TO "documents_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_documents_organization_id" RENAME TO "documents_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_documents_status" RENAME TO "documents_status_idx";

-- RenameIndex
ALTER INDEX "idx_mcp_servers_created_at" RENAME TO "mcp_servers_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_mcp_servers_name" RENAME TO "mcp_servers_name_idx";

-- RenameIndex
ALTER INDEX "idx_mcp_servers_org_status" RENAME TO "mcp_servers_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_mcp_servers_organization_id" RENAME TO "mcp_servers_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_mcp_servers_status" RENAME TO "mcp_servers_status_idx";

-- RenameIndex
ALTER INDEX "idx_memberships_org_user" RENAME TO "memberships_organization_id_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_memberships_organization_id" RENAME TO "memberships_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_memberships_role" RENAME TO "memberships_role_idx";

-- RenameIndex
ALTER INDEX "idx_memberships_status" RENAME TO "memberships_status_idx";

-- RenameIndex
ALTER INDEX "idx_memberships_user_id" RENAME TO "memberships_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_node_executions_created_at" RENAME TO "node_executions_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_node_executions_exec_node" RENAME TO "node_executions_execution_id_node_id_idx";

-- RenameIndex
ALTER INDEX "idx_node_executions_exec_status" RENAME TO "node_executions_execution_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_node_executions_execution_id" RENAME TO "node_executions_execution_id_idx";

-- RenameIndex
ALTER INDEX "idx_node_executions_node_id" RENAME TO "node_executions_node_id_idx";

-- RenameIndex
ALTER INDEX "idx_node_executions_node_type" RENAME TO "node_executions_node_type_idx";

-- RenameIndex
ALTER INDEX "idx_node_executions_status" RENAME TO "node_executions_status_idx";

-- RenameIndex
ALTER INDEX "node_executions_execution_node_unique" RENAME TO "node_executions_execution_id_node_id_key";

-- RenameIndex
ALTER INDEX "idx_organizations_created_at" RENAME TO "organizations_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_organizations_plan_type" RENAME TO "organizations_plan_type_idx";

-- RenameIndex
ALTER INDEX "idx_organizations_slug" RENAME TO "organizations_slug_idx";

-- RenameIndex
ALTER INDEX "idx_profiles_active_organization_id" RENAME TO "profiles_active_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_profiles_username" RENAME TO "profiles_username_idx";

-- RenameIndex
ALTER INDEX "idx_schedule_records_organization" RENAME TO "schedule_execution_records_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_schedule_records_schedule" RENAME TO "schedule_execution_records_schedule_id_idx";

-- RenameIndex
ALTER INDEX "idx_schedule_records_scheduled" RENAME TO "schedule_execution_records_scheduled_at_idx";

-- RenameIndex
ALTER INDEX "idx_schedule_records_status" RENAME TO "schedule_execution_records_status_idx";

-- RenameIndex
ALTER INDEX "idx_skills_created_at" RENAME TO "skills_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_skills_hash_id" RENAME TO "skills_hash_id_idx";

-- RenameIndex
ALTER INDEX "idx_skills_name" RENAME TO "skills_name_idx";

-- RenameIndex
ALTER INDEX "idx_skills_organization_id" RENAME TO "skills_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_skills_status" RENAME TO "skills_status_idx";

-- RenameIndex
ALTER INDEX "unique_skill_hash_per_org" RENAME TO "skills_organization_id_hash_id_key";

-- RenameIndex
ALTER INDEX "unique_skill_name_per_org" RENAME TO "skills_organization_id_name_key";

-- RenameIndex
ALTER INDEX "idx_tasks_agent_id" RENAME TO "tasks_agent_id_idx";

-- RenameIndex
ALTER INDEX "idx_tasks_created_at" RENAME TO "tasks_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_tasks_created_by" RENAME TO "tasks_created_by_idx";

-- RenameIndex
ALTER INDEX "idx_tasks_org_agent" RENAME TO "tasks_organization_id_agent_id_idx";

-- RenameIndex
ALTER INDEX "idx_tasks_org_status" RENAME TO "tasks_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_tasks_organization_id" RENAME TO "tasks_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_tasks_status" RENAME TO "tasks_status_idx";

-- RenameIndex
ALTER INDEX "idx_tasks_workflow_id" RENAME TO "tasks_workflow_id_idx";

-- RenameIndex
ALTER INDEX "idx_webhook_calls_created" RENAME TO "webhook_call_records_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_webhook_calls_organization" RENAME TO "webhook_call_records_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_webhook_calls_status" RENAME TO "webhook_call_records_status_idx";

-- RenameIndex
ALTER INDEX "idx_webhook_calls_webhook" RENAME TO "webhook_call_records_webhook_id_idx";

-- RenameIndex
ALTER INDEX "idx_webhooks_organization" RENAME TO "webhooks_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_webhooks_workflow" RENAME TO "webhooks_workflow_id_idx";

-- RenameIndex
ALTER INDEX "idx_executions_trigger_type" RENAME TO "workflow_executions_trigger_type_idx";

-- RenameIndex
ALTER INDEX "idx_workflow_executions_created_at" RENAME TO "workflow_executions_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_workflow_executions_org_status" RENAME TO "workflow_executions_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_workflow_executions_org_workflow" RENAME TO "workflow_executions_organization_id_workflow_id_idx";

-- RenameIndex
ALTER INDEX "idx_workflow_executions_organization_id" RENAME TO "workflow_executions_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_workflow_executions_started_at" RENAME TO "workflow_executions_started_at_idx";

-- RenameIndex
ALTER INDEX "idx_workflow_executions_status" RENAME TO "workflow_executions_status_idx";

-- RenameIndex
ALTER INDEX "idx_workflow_executions_user_id" RENAME TO "workflow_executions_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_workflow_executions_workflow_id" RENAME TO "workflow_executions_workflow_id_idx";

-- RenameIndex
ALTER INDEX "idx_workflow_executions_workflow_status" RENAME TO "workflow_executions_workflow_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_schedules_organization" RENAME TO "workflow_schedules_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_schedules_workflow" RENAME TO "workflow_schedules_workflow_id_idx";

-- RenameIndex
ALTER INDEX "idx_workflows_business_scope_id" RENAME TO "workflows_business_scope_id_idx";

-- RenameIndex
ALTER INDEX "idx_workflows_created_at" RENAME TO "workflows_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_workflows_is_official" RENAME TO "workflows_is_official_idx";

-- RenameIndex
ALTER INDEX "idx_workflows_name" RENAME TO "workflows_name_idx";

-- RenameIndex
ALTER INDEX "idx_workflows_org_scope" RENAME TO "workflows_organization_id_business_scope_id_idx";

-- RenameIndex
ALTER INDEX "idx_workflows_organization_id" RENAME TO "workflows_organization_id_idx";
