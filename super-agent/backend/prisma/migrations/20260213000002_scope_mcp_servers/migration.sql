-- CreateTable: scope_mcp_servers junction table
-- Maps business scopes to MCP servers so community plugins can be
-- auto-provisioned into Claude Code workspace settings per scope.

CREATE TABLE "scope_mcp_servers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_scope_id" UUID NOT NULL,
    "mcp_server_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "scope_mcp_servers_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one MCP server per scope
CREATE UNIQUE INDEX "unique_scope_mcp_server" ON "scope_mcp_servers"("business_scope_id", "mcp_server_id");

-- Indexes for lookups
CREATE INDEX "scope_mcp_servers_business_scope_id_idx" ON "scope_mcp_servers"("business_scope_id");
CREATE INDEX "scope_mcp_servers_mcp_server_id_idx" ON "scope_mcp_servers"("mcp_server_id");

-- Foreign keys
ALTER TABLE "scope_mcp_servers" ADD CONSTRAINT "scope_mcp_servers_business_scope_id_fkey"
    FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scope_mcp_servers" ADD CONSTRAINT "scope_mcp_servers_mcp_server_id_fkey"
    FOREIGN KEY ("mcp_server_id") REFERENCES "mcp_servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
