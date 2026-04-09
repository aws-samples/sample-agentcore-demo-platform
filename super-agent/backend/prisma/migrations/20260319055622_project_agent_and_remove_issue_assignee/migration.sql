/*
  Warnings:

  - You are about to drop the column `assignee_agent_id` on the `project_issues` table. All the data in the column will be lost.
  - You are about to drop the column `assignee_user_id` on the `project_issues` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "project_issues_assignee_agent_id_idx";

-- DropIndex
DROP INDEX "project_issues_assignee_user_id_idx";

-- AlterTable
ALTER TABLE "project_issues" DROP COLUMN "assignee_agent_id",
DROP COLUMN "assignee_user_id";

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "agent_id" UUID;

-- CreateIndex
CREATE INDEX "projects_agent_id_idx" ON "projects"("agent_id");
