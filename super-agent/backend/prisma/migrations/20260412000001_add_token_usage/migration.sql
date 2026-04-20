-- Token Usage Monthly — per-user per-month token consumption tracking
CREATE TABLE "token_usage_monthly" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "input_tokens" BIGINT NOT NULL DEFAULT 0,
    "output_tokens" BIGINT NOT NULL DEFAULT 0,
    "cache_read_input_tokens" BIGINT NOT NULL DEFAULT 0,
    "cache_creation_input_tokens" BIGINT NOT NULL DEFAULT 0,
    "total_cost_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "invocation_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_usage_monthly_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for upsert
CREATE UNIQUE INDEX "token_usage_monthly_organization_id_user_id_month_key"
    ON "token_usage_monthly"("organization_id", "user_id", "month");

CREATE INDEX "token_usage_monthly_organization_id_idx" ON "token_usage_monthly"("organization_id");
CREATE INDEX "token_usage_monthly_user_id_idx" ON "token_usage_monthly"("user_id");
CREATE INDEX "token_usage_monthly_month_idx" ON "token_usage_monthly"("month");
CREATE INDEX "token_usage_monthly_organization_id_month_idx" ON "token_usage_monthly"("organization_id", "month");

-- Token Usage Log — individual invocation records for audit trail
CREATE TABLE "token_usage_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID,
    "agent_id" TEXT,
    "source" VARCHAR(30) NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_creation_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "model" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_usage_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "token_usage_log_organization_id_idx" ON "token_usage_log"("organization_id");
CREATE INDEX "token_usage_log_user_id_idx" ON "token_usage_log"("user_id");
CREATE INDEX "token_usage_log_session_id_idx" ON "token_usage_log"("session_id");
CREATE INDEX "token_usage_log_created_at_idx" ON "token_usage_log"("created_at" DESC);
CREATE INDEX "token_usage_log_org_user_created_idx" ON "token_usage_log"("organization_id", "user_id", "created_at");
