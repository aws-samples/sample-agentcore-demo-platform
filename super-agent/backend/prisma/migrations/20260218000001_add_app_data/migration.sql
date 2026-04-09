-- App Data: per-app JSONB data storage for published mini-SaaS apps
CREATE TABLE app_data (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id      UUID NOT NULL REFERENCES published_apps(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  collection  VARCHAR(100) NOT NULL,
  data        JSONB NOT NULL,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_data_app_collection ON app_data(app_id, collection);
CREATE INDEX idx_app_data_org ON app_data(org_id);
CREATE INDEX idx_app_data_created ON app_data(created_at DESC);

-- GIN index for fast JSONB queries (filtering, aggregation)
CREATE INDEX idx_app_data_gin ON app_data USING GIN (data);
