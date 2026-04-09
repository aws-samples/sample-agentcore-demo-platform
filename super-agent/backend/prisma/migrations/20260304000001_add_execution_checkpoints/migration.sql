-- Add checkpoint support to workflow_executions
ALTER TABLE "workflow_executions" ADD COLUMN "paused_at_node" TEXT;
ALTER TABLE "workflow_executions" ADD COLUMN "current_segment" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "workflow_executions" ADD COLUMN "segment_plan" JSONB NOT NULL DEFAULT '[]';

-- Execution checkpoints table for async pause/resume
CREATE TABLE "execution_checkpoints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "execution_id" UUID NOT NULL,
    "node_id" TEXT NOT NULL,
    "node_title" TEXT,
    "checkpoint_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "config" JSONB NOT NULL DEFAULT '{}',
    "input_context" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "resolved_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "resolved_by" UUID,
    "resolved_by_source" TEXT,
    "organization_id" UUID NOT NULL,

    CONSTRAINT "execution_checkpoints_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "idx_checkpoints_execution" ON "execution_checkpoints"("execution_id");
CREATE INDEX "idx_checkpoints_status" ON "execution_checkpoints"("status");
CREATE INDEX "idx_checkpoints_org" ON "execution_checkpoints"("organization_id");
CREATE INDEX "idx_checkpoints_expires" ON "execution_checkpoints"("expires_at") WHERE "status" = 'waiting';

-- Foreign keys
ALTER TABLE "execution_checkpoints" ADD CONSTRAINT "execution_checkpoints_execution_id_fkey"
    FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "execution_checkpoints" ADD CONSTRAINT "execution_checkpoints_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
