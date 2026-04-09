-- Add category label for starred sessions.
ALTER TABLE "chat_sessions" ADD COLUMN "star_category" VARCHAR(50);
CREATE INDEX "chat_sessions_star_category_idx" ON "chat_sessions"("star_category") WHERE "is_starred" = true;
