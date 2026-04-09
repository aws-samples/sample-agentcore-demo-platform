-- Migration: Add workflow execution tables for real workflow execution
-- This migration adds tables to track workflow execution sessions and node executions

-- ============================================================================
-- Workflow Executions Table - tracks execution sessions
-- ============================================================================
CREATE TABLE "workflow_executions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workflow_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'init' CHECK (status IN ('init', 'executing', 'finish', 'failed', 'aborted')),
    "canvas_data" JSONB NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "context" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "error_stack" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Node Executions Table - tracks individual node executions within a workflow
-- ============================================================================
CREATE TABLE "node_executions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "execution_id" UUID NOT NULL,
    "node_id" TEXT NOT NULL,
    "node_type" TEXT NOT NULL,
    "node_data" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'init' CHECK (status IN ('init', 'waiting', 'executing', 'finish', 'failed', 'skipped')),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "input_data" JSONB,
    "output_data" JSONB,
    "error_message" TEXT,
    "error_stack" TEXT,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_executions_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Indexes - Workflow Executions
-- ============================================================================
CREATE INDEX "idx_workflow_executions_workflow_id" ON "workflow_executions"("workflow_id");
CREATE INDEX "idx_workflow_executions_organization_id" ON "workflow_executions"("organization_id");
CREATE INDEX "idx_workflow_executions_user_id" ON "workflow_executions"("user_id");
CREATE INDEX "idx_workflow_executions_status" ON "workflow_executions"("status");
CREATE INDEX "idx_workflow_executions_created_at" ON "workflow_executions"("created_at" DESC);
CREATE INDEX "idx_workflow_executions_started_at" ON "workflow_executions"("started_at" DESC);
CREATE INDEX "idx_workflow_executions_org_workflow" ON "workflow_executions"("organization_id", "workflow_id");
CREATE INDEX "idx_workflow_executions_org_status" ON "workflow_executions"("organization_id", "status");
CREATE INDEX "idx_workflow_executions_workflow_status" ON "workflow_executions"("workflow_id", "status");

-- ============================================================================
-- Indexes - Node Executions
-- ============================================================================
CREATE INDEX "idx_node_executions_execution_id" ON "node_executions"("execution_id");
CREATE INDEX "idx_node_executions_node_id" ON "node_executions"("node_id");
CREATE INDEX "idx_node_executions_status" ON "node_executions"("status");
CREATE INDEX "idx_node_executions_node_type" ON "node_executions"("node_type");
CREATE INDEX "idx_node_executions_created_at" ON "node_executions"("created_at" DESC);
CREATE INDEX "idx_node_executions_exec_status" ON "node_executions"("execution_id", "status");
CREATE INDEX "idx_node_executions_exec_node" ON "node_executions"("execution_id", "node_id");

-- Unique constraint to ensure one node execution per node per execution
CREATE UNIQUE INDEX "node_executions_execution_node_unique" ON "node_executions"("execution_id", "node_id");

-- ============================================================================
-- Foreign Keys
-- ============================================================================
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fkey" 
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "node_executions" ADD CONSTRAINT "node_executions_execution_id_fkey" 
    FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
