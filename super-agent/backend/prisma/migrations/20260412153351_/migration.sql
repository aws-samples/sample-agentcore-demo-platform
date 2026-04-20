-- CreateTable
CREATE TABLE "credential_vault" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "auth_type" VARCHAR(50) NOT NULL,
    "encrypted_data" TEXT NOT NULL,
    "kms_key_arn" VARCHAR(512),
    "encrypted_dek" TEXT,
    "oauth_provider" VARCHAR(100),
    "oauth_scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token_expires_at" TIMESTAMPTZ,
    "refresh_token_enc" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "last_verified_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_connectors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "connector_type" VARCHAR(50) NOT NULL,
    "credential_id" UUID NOT NULL,
    "gateway_target_id" VARCHAR(255),
    "gateway_target_arn" VARCHAR(512),
    "identity_provider_arn" VARCHAR(512),
    "config" JSONB NOT NULL DEFAULT '{}',
    "template_id" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT 'configured',
    "last_health_check" TIMESTAMPTZ,
    "health_message" TEXT,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMPTZ,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_data_connectors" (
    "id" UUID NOT NULL,
    "business_scope_id" UUID NOT NULL,
    "connector_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "scope_config" JSONB,

    CONSTRAINT "scope_data_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_audit_log" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connector_id" UUID,
    "credential_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "actor_id" UUID,
    "actor_type" VARCHAR(20) NOT NULL DEFAULT 'user',
    "details" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credential_vault_organization_id_idx" ON "credential_vault"("organization_id");

-- CreateIndex
CREATE INDEX "credential_vault_auth_type_idx" ON "credential_vault"("auth_type");

-- CreateIndex
CREATE INDEX "credential_vault_status_idx" ON "credential_vault"("status");

-- CreateIndex
CREATE INDEX "credential_vault_token_expires_at_idx" ON "credential_vault"("token_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "credential_vault_organization_id_name_key" ON "credential_vault"("organization_id", "name");

-- CreateIndex
CREATE INDEX "data_connectors_organization_id_idx" ON "data_connectors"("organization_id");

-- CreateIndex
CREATE INDEX "data_connectors_connector_type_idx" ON "data_connectors"("connector_type");

-- CreateIndex
CREATE INDEX "data_connectors_credential_id_idx" ON "data_connectors"("credential_id");

-- CreateIndex
CREATE INDEX "data_connectors_status_idx" ON "data_connectors"("status");

-- CreateIndex
CREATE UNIQUE INDEX "data_connectors_organization_id_name_key" ON "data_connectors"("organization_id", "name");

-- CreateIndex
CREATE INDEX "scope_data_connectors_business_scope_id_idx" ON "scope_data_connectors"("business_scope_id");

-- CreateIndex
CREATE INDEX "scope_data_connectors_connector_id_idx" ON "scope_data_connectors"("connector_id");

-- CreateIndex
CREATE UNIQUE INDEX "scope_data_connectors_business_scope_id_connector_id_key" ON "scope_data_connectors"("business_scope_id", "connector_id");

-- CreateIndex
CREATE INDEX "connector_audit_log_organization_id_created_at_idx" ON "connector_audit_log"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "connector_audit_log_connector_id_idx" ON "connector_audit_log"("connector_id");

-- CreateIndex
CREATE INDEX "connector_audit_log_credential_id_idx" ON "connector_audit_log"("credential_id");

-- AddForeignKey
ALTER TABLE "credential_vault" ADD CONSTRAINT "credential_vault_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_connectors" ADD CONSTRAINT "data_connectors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_connectors" ADD CONSTRAINT "data_connectors_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credential_vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_data_connectors" ADD CONSTRAINT "scope_data_connectors_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "data_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_audit_log" ADD CONSTRAINT "connector_audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
