-- Add password_hash column to profiles for local auth mode
ALTER TABLE "profiles" ADD COLUMN "password_hash" TEXT;
