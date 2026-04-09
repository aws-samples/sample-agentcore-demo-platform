-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "repo_url" TEXT,
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "business_scope_id" UUID,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_issues" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "issue_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'backlog',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "labels" JSONB NOT NULL DEFAULT '[]',
    "sort_order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assignee_user_id" UUID,
    "assignee_agent_id" UUID,
    "branch_name" TEXT,
    "workspace_session_id" UUID,
    "pr_url" TEXT,
    "estimated_effort" TEXT,
    "parent_issue_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_issue_comments" (
    "id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "author_user_id" UUID,
    "author_agent_id" UUID,
    "content" TEXT NOT NULL,
    "comment_type" VARCHAR(20) NOT NULL DEFAULT 'discussion',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_issue_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");

-- CreateIndex
CREATE INDEX "projects_created_by_idx" ON "projects"("created_by");

-- CreateIndex
CREATE INDEX "projects_created_at_idx" ON "projects"("created_at" DESC);

-- CreateIndex
CREATE INDEX "project_members_project_id_idx" ON "project_members"("project_id");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "project_issues_project_id_idx" ON "project_issues"("project_id");

-- CreateIndex
CREATE INDEX "project_issues_organization_id_idx" ON "project_issues"("organization_id");

-- CreateIndex
CREATE INDEX "project_issues_status_idx" ON "project_issues"("status");

-- CreateIndex
CREATE INDEX "project_issues_priority_idx" ON "project_issues"("priority");

-- CreateIndex
CREATE INDEX "project_issues_assignee_user_id_idx" ON "project_issues"("assignee_user_id");

-- CreateIndex
CREATE INDEX "project_issues_assignee_agent_id_idx" ON "project_issues"("assignee_agent_id");

-- CreateIndex
CREATE INDEX "project_issues_project_id_status_idx" ON "project_issues"("project_id", "status");

-- CreateIndex
CREATE INDEX "project_issues_created_at_idx" ON "project_issues"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "project_issues_project_id_issue_number_key" ON "project_issues"("project_id", "issue_number");

-- CreateIndex
CREATE INDEX "project_issue_comments_issue_id_idx" ON "project_issue_comments"("issue_id");

-- CreateIndex
CREATE INDEX "project_issue_comments_organization_id_idx" ON "project_issue_comments"("organization_id");

-- CreateIndex
CREATE INDEX "project_issue_comments_created_at_idx" ON "project_issue_comments"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_parent_issue_id_fkey" FOREIGN KEY ("parent_issue_id") REFERENCES "project_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_issue_comments" ADD CONSTRAINT "project_issue_comments_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "project_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_issue_comments" ADD CONSTRAINT "project_issue_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
