-- Scope Briefings Table
-- Stores AI-generated insights about scope activity

CREATE TABLE scope_briefings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_scope_id UUID NOT NULL REFERENCES business_scopes(id) ON DELETE CASCADE,
  
  -- Core content
  title             VARCHAR(255) NOT NULL,
  summary           TEXT NOT NULL,
  category          VARCHAR(100) NOT NULL,
  status            VARCHAR(50) NOT NULL,
  
  -- Source tracking (for deduplication)
  source_type       VARCHAR(50) NOT NULL,
  source_id         VARCHAR(255) NOT NULL,
  agent_id          UUID REFERENCES agents(id) ON DELETE SET NULL,
  
  -- Metadata
  tags              JSONB DEFAULT '[]',
  metadata          JSONB DEFAULT '{}',
  importance        INTEGER DEFAULT 5,
  
  -- Timestamps
  event_time        TIMESTAMPTZ NOT NULL,
  generated_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ,
  
  -- Display
  is_read           BOOLEAN DEFAULT FALSE,
  is_archived       BOOLEAN DEFAULT FALSE,
  
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  
  -- Deduplication constraint
  CONSTRAINT unique_briefing_source UNIQUE (business_scope_id, source_type, source_id)
);

-- Indexes
CREATE INDEX idx_scope_briefings_scope ON scope_briefings(business_scope_id, event_time DESC);
CREATE INDEX idx_scope_briefings_status ON scope_briefings(business_scope_id, status);
CREATE INDEX idx_scope_briefings_importance ON scope_briefings(business_scope_id, importance DESC);
CREATE INDEX idx_scope_briefings_unread ON scope_briefings(business_scope_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_scope_briefings_source ON scope_briefings(source_type, source_id);
