-- Add invite token fields to memberships for email invite flow
ALTER TABLE "memberships" ADD COLUMN "invite_token" TEXT;
ALTER TABLE "memberships" ADD COLUMN "invite_expires_at" TIMESTAMPTZ;
CREATE UNIQUE INDEX "memberships_invite_token_key" ON "memberships"("invite_token");
