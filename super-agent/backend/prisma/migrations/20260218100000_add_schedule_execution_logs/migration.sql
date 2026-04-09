-- Add logs column to schedule_execution_records for storing execution event history
ALTER TABLE "schedule_execution_records" ADD COLUMN "logs" JSONB DEFAULT '[]';
