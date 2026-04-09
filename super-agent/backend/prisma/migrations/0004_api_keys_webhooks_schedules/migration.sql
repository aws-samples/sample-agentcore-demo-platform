-- Migration: API Keys, Webhooks, and Schedules
-- Features: Workflow API Export, Webhooks, Scheduled Execution

-- ============================================================================
-- API Keys Table - for programmatic workflow access
-- ============================================================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    key_prefix VARCHAR(12) NOT NULL,
    scopes JSONB DEFAULT '["workflow:execute"]'::jsonb,
    rate_limit_per_minute INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_organization ON api_keys(organization_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- ============================================================================
-- Webhooks Table - for external workflow triggers
-- ============================================================================
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    webhook_id VARCHAR(64) NOT NULL,
    name VARCHAR(255),
    is_enabled BOOLEAN DEFAULT true,
    timeout_seconds INTEGER DEFAULT 30,
    secret_hash VARCHAR(64),
    allowed_ips JSONB DEFAULT '[]'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_webhooks_webhook_id ON webhooks(webhook_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_webhooks_organization ON webhooks(organization_id);
CREATE INDEX idx_webhooks_workflow ON webhooks(workflow_id);
CREATE INDEX idx_webhooks_enabled ON webhooks(is_enabled) WHERE is_enabled = true AND deleted_at IS NULL;

-- ============================================================================
-- Webhook Call Records Table - tracks webhook invocations
-- ============================================================================
CREATE TABLE webhook_call_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id VARCHAR(64) NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
    request_method VARCHAR(10),
    request_headers JSONB,
    request_body JSONB,
    response_status INTEGER,
    response_time_ms INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_calls_webhook ON webhook_call_records(webhook_id);
CREATE INDEX idx_webhook_calls_organization ON webhook_call_records(organization_id);
CREATE INDEX idx_webhook_calls_status ON webhook_call_records(status);
CREATE INDEX idx_webhook_calls_created ON webhook_call_records(created_at DESC);

-- ============================================================================
-- Workflow Schedules Table - for cron-based execution
-- ============================================================================
CREATE TABLE workflow_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_enabled BOOLEAN DEFAULT false,
    variables JSONB DEFAULT '[]'::jsonb,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_schedules_organization ON workflow_schedules(organization_id);
CREATE INDEX idx_schedules_workflow ON workflow_schedules(workflow_id);
CREATE INDEX idx_schedules_enabled ON workflow_schedules(is_enabled) WHERE is_enabled = true AND deleted_at IS NULL;
CREATE INDEX idx_schedules_next_run ON workflow_schedules(next_run_at) WHERE is_enabled = true AND deleted_at IS NULL;

-- ============================================================================
-- Schedule Execution Records Table - tracks scheduled runs
-- ============================================================================
CREATE TABLE schedule_execution_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES workflow_schedules(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    triggered_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'scheduled',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedule_records_schedule ON schedule_execution_records(schedule_id);
CREATE INDEX idx_schedule_records_organization ON schedule_execution_records(organization_id);
CREATE INDEX idx_schedule_records_status ON schedule_execution_records(status);
CREATE INDEX idx_schedule_records_scheduled ON schedule_execution_records(scheduled_at DESC);

-- ============================================================================
-- Add trigger_type to workflow_executions
-- ============================================================================
ALTER TABLE workflow_executions 
ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS trigger_id UUID,
ADD COLUMN IF NOT EXISTS title VARCHAR(255);

CREATE INDEX idx_executions_trigger_type ON workflow_executions(trigger_type);
