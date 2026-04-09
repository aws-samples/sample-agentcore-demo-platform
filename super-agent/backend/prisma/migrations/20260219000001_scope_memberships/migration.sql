-- Scope-level access control: scope_memberships table
-- Links users to specific business scopes with role-based access

CREATE TABLE scope_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    business_scope_id UUID NOT NULL REFERENCES business_scopes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_scope_id, user_id)
);

CREATE INDEX idx_scope_memberships_org ON scope_memberships(organization_id);
CREATE INDEX idx_scope_memberships_scope ON scope_memberships(business_scope_id);
CREATE INDEX idx_scope_memberships_user ON scope_memberships(user_id);
CREATE INDEX idx_scope_memberships_scope_user ON scope_memberships(business_scope_id, user_id);

-- Add visibility mode to business_scopes: 'open' (default, everyone can see) or 'restricted'
ALTER TABLE business_scopes ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (visibility IN ('open', 'restricted'));
