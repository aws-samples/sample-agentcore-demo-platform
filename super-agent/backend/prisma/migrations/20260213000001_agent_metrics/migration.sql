-- Agent Events — fact table for agent activity tracking
CREATE TABLE "agent_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "session_id" UUID,
    "agent_id" UUID,
    "target_agent_id" UUID,
    "event_type" VARCHAR(50) NOT NULL,
    "event_name" VARCHAR(255),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id")
);

-- Agent Metrics Daily — pre-aggregated rollup for dashboards
CREATE TABLE "agent_metrics_daily" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "metric_date" DATE NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "event_name" VARCHAR(255),
    "count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for upsert on daily metrics
ALTER TABLE "agent_metrics_daily"
    ADD CONSTRAINT "unique_daily_metric"
    UNIQUE ("organization_id", "agent_id", "metric_date", "event_type", "event_name");

-- Indexes for agent_events
CREATE INDEX "agent_events_org_type_created" ON "agent_events"("organization_id", "event_type", "created_at" DESC);
CREATE INDEX "agent_events_agent_type_created" ON "agent_events"("agent_id", "event_type", "created_at" DESC);
CREATE INDEX "agent_events_target_agent_created" ON "agent_events"("target_agent_id", "created_at" DESC);
CREATE INDEX "agent_events_session" ON "agent_events"("session_id");
CREATE INDEX "agent_events_created" ON "agent_events"("created_at" DESC);

-- Indexes for agent_metrics_daily
CREATE INDEX "agent_metrics_daily_agent_date" ON "agent_metrics_daily"("agent_id", "metric_date");
CREATE INDEX "agent_metrics_daily_org_date" ON "agent_metrics_daily"("organization_id", "metric_date");

-- Foreign keys
ALTER TABLE "agent_events"
    ADD CONSTRAINT "agent_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_metrics_daily"
    ADD CONSTRAINT "agent_metrics_daily_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
