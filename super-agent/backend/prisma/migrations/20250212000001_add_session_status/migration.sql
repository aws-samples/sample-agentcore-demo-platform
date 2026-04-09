-- AlterTable: Add status column to chat_sessions
ALTER TABLE "chat_sessions" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'idle';
