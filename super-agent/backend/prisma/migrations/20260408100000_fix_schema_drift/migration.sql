-- Fix schema drift: align database with Prisma schema

-- 3. Make created_at NOT NULL on tables created by hand-written migration
ALTER TABLE "user_groups" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "user_groups" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "user_group_members" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "skill_group_access" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "mcp_group_access" ALTER COLUMN "created_at" SET NOT NULL;

-- 4. Restore id defaults that were dropped by session_management migration
ALTER TABLE "rehearsal_sessions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "scope_evolution_proposals" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "user_groups" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "user_group_members" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- 5. Rename hand-written indexes to Prisma default naming convention
ALTER INDEX IF EXISTS "idx_user_groups_org" RENAME TO "user_groups_organization_id_idx";
ALTER INDEX IF EXISTS "idx_user_group_members_group" RENAME TO "user_group_members_group_id_idx";
ALTER INDEX IF EXISTS "idx_user_group_members_user" RENAME TO "user_group_members_user_id_idx";
ALTER INDEX IF EXISTS "idx_skill_group_access_skill" RENAME TO "skill_group_access_skill_id_idx";
ALTER INDEX IF EXISTS "idx_skill_group_access_group" RENAME TO "skill_group_access_group_id_idx";
ALTER INDEX IF EXISTS "idx_mcp_group_access_mcp" RENAME TO "mcp_group_access_mcp_server_id_idx";
ALTER INDEX IF EXISTS "idx_mcp_group_access_group" RENAME TO "mcp_group_access_group_id_idx";
