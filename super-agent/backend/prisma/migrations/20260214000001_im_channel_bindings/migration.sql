-- IM Channel Bindings: maps IM channels (Slack, Discord, etc.) to business scopes
CREATE TABLE IF NOT EXISTS "im_channel_bindings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "business_scope_id" UUID NOT NULL,
    "channel_type" VARCHAR(50) NOT NULL,
    "channel_id" VARCHAR(255) NOT NULL,
    "channel_name" VARCHAR(255),
    "bot_token_enc" TEXT,
    "webhook_url" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "im_channel_bindings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "im_channel_bindings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "im_channel_bindings_business_scope_id_fkey" FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_channel_binding" ON "im_channel_bindings"("organization_id", "channel_type", "channel_id");
CREATE INDEX IF NOT EXISTS "im_channel_bindings_organization_id_idx" ON "im_channel_bindings"("organization_id");
CREATE INDEX IF NOT EXISTS "im_channel_bindings_business_scope_id_idx" ON "im_channel_bindings"("business_scope_id");
CREATE INDEX IF NOT EXISTS "im_channel_bindings_channel_type_channel_id_idx" ON "im_channel_bindings"("channel_type", "channel_id");
CREATE INDEX IF NOT EXISTS "im_channel_bindings_is_enabled_idx" ON "im_channel_bindings"("is_enabled");

-- IM Thread Sessions: maps IM threads to chat sessions (thread = session)
CREATE TABLE IF NOT EXISTS "im_thread_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "binding_id" UUID NOT NULL,
    "thread_id" VARCHAR(255) NOT NULL,
    "session_id" UUID NOT NULL,
    "im_user_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "im_thread_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "im_thread_sessions_binding_id_fkey" FOREIGN KEY ("binding_id") REFERENCES "im_channel_bindings"("id") ON DELETE CASCADE,
    CONSTRAINT "im_thread_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_thread_per_binding" ON "im_thread_sessions"("binding_id", "thread_id");
CREATE INDEX IF NOT EXISTS "im_thread_sessions_binding_id_idx" ON "im_thread_sessions"("binding_id");
CREATE INDEX IF NOT EXISTS "im_thread_sessions_session_id_idx" ON "im_thread_sessions"("session_id");
