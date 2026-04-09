-- CreateTable: scope_plugins
-- Maps business scopes to Claude Code plugins (git repos) that are cloned
-- into session workspaces and loaded via the SDK `plugins` option.

CREATE TABLE "scope_plugins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_scope_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "git_url" TEXT NOT NULL,
    "ref" TEXT NOT NULL DEFAULT 'main',
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "scope_plugins_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "unique_scope_plugin" ON "scope_plugins"("business_scope_id", "name");
CREATE INDEX "scope_plugins_business_scope_id_idx" ON "scope_plugins"("business_scope_id");

-- Foreign Keys
ALTER TABLE "scope_plugins" ADD CONSTRAINT "scope_plugins_business_scope_id_fkey"
    FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
