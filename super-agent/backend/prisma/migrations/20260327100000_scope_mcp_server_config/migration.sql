-- Add scope-level configuration override for MCP servers.
-- Stores per-scope config (connection strings, env vars, credentials)
-- that overrides or supplements the global MCP server definition.

ALTER TABLE "scope_mcp_servers" ADD COLUMN "scope_config" JSONB;
