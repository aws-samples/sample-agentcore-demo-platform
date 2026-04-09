-- Published Apps
CREATE TABLE "published_apps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "session_id" UUID,
    "business_scope_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT NOT NULL DEFAULT '🚀',
    "category" TEXT NOT NULL DEFAULT 'tool',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" TEXT NOT NULL DEFAULT 'published',
    "entry_point" TEXT NOT NULL DEFAULT 'index.html',
    "bundle_path" TEXT NOT NULL,
    "published_by" UUID,
    "access_level" TEXT NOT NULL DEFAULT 'org',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "published_apps_pkey" PRIMARY KEY ("id")
);

-- App Usage Events
CREATE TABLE "app_usage_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "app_id" UUID NOT NULL,
    "user_id" UUID,
    "org_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "duration_ms" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_usage_events_pkey" PRIMARY KEY ("id")
);

-- App Ratings
CREATE TABLE "app_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "app_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_ratings_pkey" PRIMARY KEY ("id")
);

-- App Versions
CREATE TABLE "app_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "app_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "bundle_path" TEXT NOT NULL,
    "changelog" TEXT,
    "published_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- Unique constraint
ALTER TABLE "app_ratings" ADD CONSTRAINT "app_ratings_app_id_user_id_key" UNIQUE ("app_id", "user_id");

-- Foreign keys
ALTER TABLE "published_apps" ADD CONSTRAINT "published_apps_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "published_apps" ADD CONSTRAINT "published_apps_business_scope_id_fkey" FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_usage_events" ADD CONSTRAINT "app_usage_events_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "published_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_usage_events" ADD CONSTRAINT "app_usage_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_ratings" ADD CONSTRAINT "app_ratings_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "published_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_ratings" ADD CONSTRAINT "app_ratings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_versions" ADD CONSTRAINT "app_versions_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "published_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "published_apps_org_id_idx" ON "published_apps"("org_id");
CREATE INDEX "published_apps_status_idx" ON "published_apps"("status");
CREATE INDEX "published_apps_category_idx" ON "published_apps"("category");
CREATE INDEX "published_apps_published_at_idx" ON "published_apps"("published_at" DESC);

CREATE INDEX "app_usage_events_app_id_idx" ON "app_usage_events"("app_id");
CREATE INDEX "app_usage_events_user_id_idx" ON "app_usage_events"("user_id");
CREATE INDEX "app_usage_events_created_at_idx" ON "app_usage_events"("created_at" DESC);

CREATE INDEX "app_ratings_app_id_idx" ON "app_ratings"("app_id");

CREATE INDEX "app_versions_app_id_idx" ON "app_versions"("app_id");
