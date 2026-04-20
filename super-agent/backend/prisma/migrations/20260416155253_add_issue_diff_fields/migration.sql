-- AlterTable
ALTER TABLE "project_issues" ADD COLUMN     "diff_created_at" TIMESTAMPTZ,
ADD COLUMN     "diff_patch" TEXT,
ADD COLUMN     "diff_stat" JSONB;
