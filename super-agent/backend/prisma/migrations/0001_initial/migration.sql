-- Migration: Initial schema matching Supabase database
-- This migration creates all tables to match the existing Supabase schema
-- for compatibility with the super-agent-platform frontend

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- ============================================================================
-- Organizations Table - matches Supabase migration 20250108000001
-- ============================================================================
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan_type" TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'enterprise')),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Memberships Table - matches Supabase migration 20250108000001
-- ============================================================================
CREATE TABLE "memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    "status" TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'inactive')),
    "invited_email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Profiles Table - matches Supabase migration 20250108000002
-- ============================================================================
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "username" TEXT,
    "full_name" TEXT,
    "avatar_url" TEXT,
    "active_organization_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);


-- ============================================================================
-- Business Scopes Table - matches Supabase migration 20250108000003
-- ============================================================================
CREATE TABLE "business_scopes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_scopes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "unique_scope_name_per_org" UNIQUE("organization_id", "name")
);

-- ============================================================================
-- Agents Table - matches Supabase migration 20250108000005
-- ============================================================================
CREATE TABLE "agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "business_scope_id" UUID,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" TEXT,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('active', 'idle', 'busy', 'offline')),
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "tools" JSONB NOT NULL DEFAULT '[]',
    "scope" JSONB NOT NULL DEFAULT '[]',
    "system_prompt" TEXT,
    "model_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Workflows Table - matches Supabase migration 20250108000006
-- ============================================================================
CREATE TABLE "workflows" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "business_scope_id" UUID,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "is_official" BOOLEAN NOT NULL DEFAULT false,
    "parent_version" TEXT,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "connections" JSONB NOT NULL DEFAULT '[]',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);


-- ============================================================================
-- Tasks Table - matches Supabase migration 20250108000007
-- ============================================================================
CREATE TABLE "tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "agent_id" UUID,
    "workflow_id" UUID,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('complete', 'running', 'failed')),
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Documents Table - matches Supabase migration 20250108000008
-- ============================================================================
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT CHECK (file_type IN ('PDF', 'TXT', 'MD', 'DOCX')),
    "file_path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('indexed', 'processing', 'error')),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- MCP Servers Table - matches Supabase migration 20250108000009
-- ============================================================================
CREATE TABLE "mcp_servers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "host_address" TEXT NOT NULL,
    "oauth_secret_id" UUID,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id")
);


-- ============================================================================
-- Chat Sessions Table - matches Supabase migration 20250108000010
-- ============================================================================
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sop_context" TEXT,
    "context" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Chat Messages Table - matches Supabase migration 20250108000010
-- ============================================================================
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "type" TEXT NOT NULL CHECK (type IN ('user', 'ai')),
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Indexes - Organizations
-- ============================================================================
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "idx_organizations_slug" ON "organizations"("slug");
CREATE INDEX "idx_organizations_plan_type" ON "organizations"("plan_type");
CREATE INDEX "idx_organizations_created_at" ON "organizations"("created_at" DESC);

-- ============================================================================
-- Indexes - Memberships
-- ============================================================================
CREATE INDEX "idx_memberships_organization_id" ON "memberships"("organization_id");
CREATE INDEX "idx_memberships_user_id" ON "memberships"("user_id");
CREATE INDEX "idx_memberships_status" ON "memberships"("status");
CREATE INDEX "idx_memberships_role" ON "memberships"("role");
CREATE INDEX "idx_memberships_org_user" ON "memberships"("organization_id", "user_id");
CREATE UNIQUE INDEX "memberships_organization_id_user_id_key" ON "memberships"("organization_id", "user_id");

-- ============================================================================
-- Indexes - Profiles
-- ============================================================================
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles"("username");
CREATE INDEX "idx_profiles_username" ON "profiles"("username");
CREATE INDEX "idx_profiles_active_organization_id" ON "profiles"("active_organization_id");


-- ============================================================================
-- Indexes - Business Scopes
-- ============================================================================
CREATE INDEX "idx_business_scopes_organization_id" ON "business_scopes"("organization_id");
CREATE INDEX "idx_business_scopes_name" ON "business_scopes"("name");
CREATE INDEX "idx_business_scopes_is_default" ON "business_scopes"("is_default");
CREATE INDEX "idx_business_scopes_org_name" ON "business_scopes"("organization_id", "name");

-- ============================================================================
-- Indexes - Agents
-- ============================================================================
CREATE INDEX "idx_agents_organization_id" ON "agents"("organization_id");
CREATE INDEX "idx_agents_business_scope_id" ON "agents"("business_scope_id");
CREATE INDEX "idx_agents_status" ON "agents"("status");
CREATE INDEX "idx_agents_name" ON "agents"("name");
CREATE INDEX "idx_agents_created_at" ON "agents"("created_at" DESC);
CREATE INDEX "idx_agents_org_scope" ON "agents"("organization_id", "business_scope_id");

-- ============================================================================
-- Indexes - Workflows
-- ============================================================================
CREATE INDEX "idx_workflows_organization_id" ON "workflows"("organization_id");
CREATE INDEX "idx_workflows_business_scope_id" ON "workflows"("business_scope_id");
CREATE INDEX "idx_workflows_name" ON "workflows"("name");
CREATE INDEX "idx_workflows_is_official" ON "workflows"("is_official");
CREATE INDEX "idx_workflows_created_at" ON "workflows"("created_at" DESC);
CREATE INDEX "idx_workflows_org_scope" ON "workflows"("organization_id", "business_scope_id");
CREATE INDEX "idx_workflows_org_official" ON "workflows"("organization_id", "is_official") WHERE is_official = true;

-- ============================================================================
-- Indexes - Tasks
-- ============================================================================
CREATE INDEX "idx_tasks_organization_id" ON "tasks"("organization_id");
CREATE INDEX "idx_tasks_agent_id" ON "tasks"("agent_id");
CREATE INDEX "idx_tasks_workflow_id" ON "tasks"("workflow_id");
CREATE INDEX "idx_tasks_status" ON "tasks"("status");
CREATE INDEX "idx_tasks_created_at" ON "tasks"("created_at" DESC);
CREATE INDEX "idx_tasks_created_by" ON "tasks"("created_by");
CREATE INDEX "idx_tasks_org_status" ON "tasks"("organization_id", "status");
CREATE INDEX "idx_tasks_org_agent" ON "tasks"("organization_id", "agent_id");

-- ============================================================================
-- Indexes - Documents
-- ============================================================================
CREATE INDEX "idx_documents_organization_id" ON "documents"("organization_id");
CREATE INDEX "idx_documents_category" ON "documents"("category");
CREATE INDEX "idx_documents_status" ON "documents"("status");
CREATE INDEX "idx_documents_file_type" ON "documents"("file_type");
CREATE INDEX "idx_documents_created_at" ON "documents"("created_at" DESC);
CREATE INDEX "idx_documents_org_category" ON "documents"("organization_id", "category");
CREATE INDEX "idx_documents_org_status" ON "documents"("organization_id", "status");


-- ============================================================================
-- Indexes - MCP Servers
-- ============================================================================
CREATE INDEX "idx_mcp_servers_organization_id" ON "mcp_servers"("organization_id");
CREATE INDEX "idx_mcp_servers_name" ON "mcp_servers"("name");
CREATE INDEX "idx_mcp_servers_status" ON "mcp_servers"("status");
CREATE INDEX "idx_mcp_servers_created_at" ON "mcp_servers"("created_at" DESC);
CREATE INDEX "idx_mcp_servers_org_status" ON "mcp_servers"("organization_id", "status");

-- ============================================================================
-- Indexes - Chat Sessions
-- ============================================================================
CREATE INDEX "idx_chat_sessions_organization_id" ON "chat_sessions"("organization_id");
CREATE INDEX "idx_chat_sessions_user_id" ON "chat_sessions"("user_id");
CREATE INDEX "idx_chat_sessions_created_at" ON "chat_sessions"("created_at" DESC);
CREATE INDEX "idx_chat_sessions_org_user" ON "chat_sessions"("organization_id", "user_id");

-- ============================================================================
-- Indexes - Chat Messages
-- ============================================================================
CREATE INDEX "idx_chat_messages_organization_id" ON "chat_messages"("organization_id");
CREATE INDEX "idx_chat_messages_session_id" ON "chat_messages"("session_id");
CREATE INDEX "idx_chat_messages_type" ON "chat_messages"("type");
CREATE INDEX "idx_chat_messages_created_at" ON "chat_messages"("created_at" DESC);
CREATE INDEX "idx_chat_messages_session_created" ON "chat_messages"("session_id", "created_at");

-- ============================================================================
-- Foreign Keys
-- ============================================================================
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_scopes" ADD CONSTRAINT "business_scopes_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agents" ADD CONSTRAINT "agents_business_scope_id_fkey" 
    FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflows" ADD CONSTRAINT "workflows_business_scope_id_fkey" 
    FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_id_fkey" 
    FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workflow_id_fkey" 
    FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_organization_id_fkey" 
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" 
    FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
