-- CreateTable
CREATE TABLE "connector_oauth_providers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_enc" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extra_config" JSONB NOT NULL DEFAULT '{}',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_oauth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "connector_oauth_providers_organization_id_idx" ON "connector_oauth_providers"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "connector_oauth_providers_organization_id_provider_key" ON "connector_oauth_providers"("organization_id", "provider");

-- AddForeignKey
ALTER TABLE "connector_oauth_providers" ADD CONSTRAINT "connector_oauth_providers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
