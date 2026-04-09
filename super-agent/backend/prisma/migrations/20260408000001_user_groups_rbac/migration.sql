-- User Groups for RBAC
-- Skills and MCP servers are published to user groups.
-- Agents inherit their creator's group-based permissions at runtime.

CREATE TABLE user_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE INDEX idx_user_groups_org ON user_groups(organization_id);

CREATE TABLE user_group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  added_by   UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_user_group_members_group ON user_group_members(group_id);
CREATE INDEX idx_user_group_members_user ON user_group_members(user_id);

-- Skill published to user groups (many-to-many)
CREATE TABLE skill_group_access (
  skill_id   UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  group_id   UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  granted_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(skill_id, group_id)
);

CREATE INDEX idx_skill_group_access_group ON skill_group_access(group_id);
CREATE INDEX idx_skill_group_access_skill ON skill_group_access(skill_id);

-- MCP Server authorized to user groups (many-to-many)
CREATE TABLE mcp_group_access (
  mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  group_id      UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
  granted_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(mcp_server_id, group_id)
);

CREATE INDEX idx_mcp_group_access_group ON mcp_group_access(group_id);
CREATE INDEX idx_mcp_group_access_mcp ON mcp_group_access(mcp_server_id);

-- Add created_by to skills if not present (for ownership tracking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skills' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE skills ADD COLUMN created_by UUID;
  END IF;
END $$;
