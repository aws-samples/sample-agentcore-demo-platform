-- Migration: 0005_enterprise_skills_marketplace
-- Description: Add enterprise skills marketplace tables and extend skills table

-- ============================================================================
-- Extend Skills Table - add business_scope_id and skill_type columns
-- ============================================================================
ALTER TABLE skills ADD COLUMN IF NOT EXISTS business_scope_id UUID REFERENCES business_scopes(id) ON DELETE SET NULL;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS skill_type VARCHAR(50) NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_skills_business_scope_id ON skills(business_scope_id);
CREATE INDEX IF NOT EXISTS idx_skills_skill_type ON skills(skill_type);
CREATE INDEX IF NOT EXISTS idx_skills_org_scope ON skills(organization_id, business_scope_id);

-- ============================================================================
-- Skill Marketplace Table - published skills in the enterprise catalog
-- ============================================================================
CREATE TABLE IF NOT EXISTS skill_marketplace (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    published_by    UUID NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'published',  -- draft | published | archived
    visibility      VARCHAR(50) NOT NULL DEFAULT 'organization',  -- organization | team
    install_count   INT NOT NULL DEFAULT 0,
    vote_score      INT NOT NULL DEFAULT 0,
    category        VARCHAR(100),
    source          VARCHAR(50) NOT NULL DEFAULT 'internal',  -- internal | skills.sh
    source_ref      TEXT,  -- original installRef if imported from skills.sh
    published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_marketplace_skill_per_org UNIQUE (organization_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_marketplace_org_status ON skill_marketplace(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_skill_marketplace_org_category ON skill_marketplace(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_skill_marketplace_install_count ON skill_marketplace(install_count DESC);
CREATE INDEX IF NOT EXISTS idx_skill_marketplace_vote_score ON skill_marketplace(vote_score DESC);
CREATE INDEX IF NOT EXISTS idx_skill_marketplace_published_at ON skill_marketplace(published_at DESC);

-- ============================================================================
-- Skill Votes Table - user votes on marketplace skills
-- ============================================================================
CREATE TABLE IF NOT EXISTS skill_votes (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_marketplace_id  UUID NOT NULL REFERENCES skill_marketplace(id) ON DELETE CASCADE,
    user_id               UUID NOT NULL,
    vote                  SMALLINT NOT NULL CHECK (vote IN (1, -1)),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_vote_per_user UNIQUE (skill_marketplace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_votes_marketplace_id ON skill_votes(skill_marketplace_id);
CREATE INDEX IF NOT EXISTS idx_skill_votes_user_id ON skill_votes(user_id);
