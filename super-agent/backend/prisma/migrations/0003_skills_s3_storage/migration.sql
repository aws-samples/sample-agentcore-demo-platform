-- Migration: 0003_skills_s3_storage
-- Description: Add skills table for S3 metadata and agent_skills junction table
-- This enables skills to be stored in S3 and mapped to agents

-- ============================================================================
-- Skills Table - stores skill metadata with S3 location
-- ============================================================================
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Skill identity
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- S3 storage location
    hash_id VARCHAR(64) NOT NULL,  -- Unique hash for S3 prefix
    s3_bucket VARCHAR(255) NOT NULL,
    s3_prefix VARCHAR(512) NOT NULL,  -- e.g., "skills/{hash_id}/"
    
    -- Versioning
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, deprecated, archived
    
    -- Metadata
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_skill_hash_per_org UNIQUE (organization_id, hash_id),
    CONSTRAINT unique_skill_name_per_org UNIQUE (organization_id, name)
);

-- Indexes for skills
CREATE INDEX IF NOT EXISTS idx_skills_organization_id ON skills(organization_id);
CREATE INDEX IF NOT EXISTS idx_skills_hash_id ON skills(hash_id);
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
CREATE INDEX IF NOT EXISTS idx_skills_created_at ON skills(created_at DESC);

-- ============================================================================
-- Agent Skills Junction Table - maps agents to skills (many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    
    -- Assignment metadata
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID,  -- User who assigned the skill
    
    -- Constraints
    CONSTRAINT unique_agent_skill UNIQUE (agent_id, skill_id)
);

-- Indexes for agent_skills
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent_id ON agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_skill_id ON agent_skills(skill_id);

-- ============================================================================
-- Trigger: Update updated_at on skills
-- ============================================================================
CREATE OR REPLACE FUNCTION update_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_skills_updated_at ON skills;
CREATE TRIGGER trigger_skills_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION update_skills_updated_at();
