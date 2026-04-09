-- Add logs column to webhook_call_records for execution log storage
ALTER TABLE "webhook_call_records" ADD COLUMN "logs" JSONB NOT NULL DEFAULT '[]';
