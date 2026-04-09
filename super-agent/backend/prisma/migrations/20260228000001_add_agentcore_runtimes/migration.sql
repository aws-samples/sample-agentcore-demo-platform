-- AgentCore Runtime tracking table
-- Tracks deployed AgentCore Runtimes per business scope.
-- Each scope gets at most one Runtime deployment; individual chat sessions
-- are isolated via runtimeSessionId at invocation time.

CREATE TABLE IF NOT EXISTS agentcore_runtimes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope_id        UUID NOT NULL REFERENCES business_scopes(id) ON DELETE CASCADE,
  runtime_id      VARCHAR(255) NOT NULL,
  runtime_arn     VARCHAR(512) NOT NULL,
  ecr_uri         VARCHAR(512),
  status          VARCHAR(50) NOT NULL DEFAULT 'creating',
  config_version  INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_agentcore_runtimes_org_scope UNIQUE (organization_id, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_agentcore_runtimes_org
  ON agentcore_runtimes (organization_id);

CREATE INDEX IF NOT EXISTS idx_agentcore_runtimes_status
  ON agentcore_runtimes (organization_id, status);
