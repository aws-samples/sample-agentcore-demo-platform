-- DropForeignKey
ALTER TABLE "mcp_group_access" DROP CONSTRAINT "mcp_group_access_group_id_fkey";

-- DropForeignKey
ALTER TABLE "mcp_group_access" DROP CONSTRAINT "mcp_group_access_mcp_server_id_fkey";

-- DropForeignKey
ALTER TABLE "rehearsal_sessions" DROP CONSTRAINT "rehearsal_sessions_business_scope_id_fkey";

-- DropForeignKey
ALTER TABLE "rehearsal_sessions" DROP CONSTRAINT "rehearsal_sessions_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_evolution_proposals" DROP CONSTRAINT "scope_evolution_proposals_business_scope_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_evolution_proposals" DROP CONSTRAINT "scope_evolution_proposals_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "scope_evolution_proposals" DROP CONSTRAINT "scope_evolution_proposals_rehearsal_session_id_fkey";

-- DropForeignKey
ALTER TABLE "skill_group_access" DROP CONSTRAINT "skill_group_access_group_id_fkey";

-- DropForeignKey
ALTER TABLE "skill_group_access" DROP CONSTRAINT "skill_group_access_skill_id_fkey";

-- DropForeignKey
ALTER TABLE "user_group_members" DROP CONSTRAINT "user_group_members_group_id_fkey";

-- DropForeignKey
ALTER TABLE "user_groups" DROP CONSTRAINT "user_groups_organization_id_fkey";

-- AlterTable
ALTER TABLE "rehearsal_sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "scope_evolution_proposals" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_group_members" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_groups" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "rehearsal_sessions" ADD CONSTRAINT "rehearsal_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rehearsal_sessions" ADD CONSTRAINT "rehearsal_sessions_business_scope_id_fkey" FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_evolution_proposals" ADD CONSTRAINT "scope_evolution_proposals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_evolution_proposals" ADD CONSTRAINT "scope_evolution_proposals_business_scope_id_fkey" FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_evolution_proposals" ADD CONSTRAINT "scope_evolution_proposals_rehearsal_session_id_fkey" FOREIGN KEY ("rehearsal_session_id") REFERENCES "rehearsal_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_group_access" ADD CONSTRAINT "skill_group_access_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_group_access" ADD CONSTRAINT "skill_group_access_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_group_access" ADD CONSTRAINT "mcp_group_access_mcp_server_id_fkey" FOREIGN KEY ("mcp_server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_group_access" ADD CONSTRAINT "mcp_group_access_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
