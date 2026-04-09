-- Add star/favorite fields to chat_sessions for "明星案例" feature.

ALTER TABLE "chat_sessions" ADD COLUMN "is_starred" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chat_sessions" ADD COLUMN "starred_at" TIMESTAMPTZ;
ALTER TABLE "chat_sessions" ADD COLUMN "starred_by" UUID;

CREATE INDEX "chat_sessions_is_starred_idx" ON "chat_sessions"("is_starred") WHERE "is_starred" = true;
CREATE INDEX "chat_sessions_starred_at_idx" ON "chat_sessions"("starred_at" DESC) WHERE "is_starred" = true;
CREATE INDEX "chat_sessions_org_starred_idx" ON "chat_sessions"("organization_id", "is_starred") WHERE "is_starred" = true;
