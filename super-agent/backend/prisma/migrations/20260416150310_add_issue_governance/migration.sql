-- AlterTable
ALTER TABLE "project_issues" ADD COLUMN     "acceptance_criteria" JSONB,
ADD COLUMN     "ai_analysis_status" VARCHAR(20),
ADD COLUMN     "last_analyzed_at" TIMESTAMPTZ,
ADD COLUMN     "readiness_details" JSONB,
ADD COLUMN     "readiness_score" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "project_issue_relations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "source_issue_id" UUID NOT NULL,
    "target_issue_id" UUID NOT NULL,
    "relation_type" VARCHAR(30) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reasoning" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_by_ai" BOOLEAN NOT NULL DEFAULT true,
    "reviewed_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_issue_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_triage_reports" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "report_content" JSONB NOT NULL,
    "issue_count" INTEGER NOT NULL,
    "conflict_count" INTEGER NOT NULL DEFAULT 0,
    "suggestion_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_triage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_issue_relations_project_id_idx" ON "project_issue_relations"("project_id");

-- CreateIndex
CREATE INDEX "project_issue_relations_source_issue_id_idx" ON "project_issue_relations"("source_issue_id");

-- CreateIndex
CREATE INDEX "project_issue_relations_target_issue_id_idx" ON "project_issue_relations"("target_issue_id");

-- CreateIndex
CREATE INDEX "project_issue_relations_status_idx" ON "project_issue_relations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "project_issue_relations_source_issue_id_target_issue_id_rel_key" ON "project_issue_relations"("source_issue_id", "target_issue_id", "relation_type");

-- CreateIndex
CREATE INDEX "project_triage_reports_project_id_idx" ON "project_triage_reports"("project_id");

-- CreateIndex
CREATE INDEX "project_triage_reports_created_at_idx" ON "project_triage_reports"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "project_issue_relations" ADD CONSTRAINT "project_issue_relations_source_issue_id_fkey" FOREIGN KEY ("source_issue_id") REFERENCES "project_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_issue_relations" ADD CONSTRAINT "project_issue_relations_target_issue_id_fkey" FOREIGN KEY ("target_issue_id") REFERENCES "project_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
