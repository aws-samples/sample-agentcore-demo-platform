-- AlterTable
ALTER TABLE "schedule_execution_records" ADD COLUMN "trigger_type" VARCHAR(20) NOT NULL DEFAULT 'cron';
