-- Update the status check constraint to include new statuses
ALTER TABLE "workflow_executions" DROP CONSTRAINT IF EXISTS "workflow_executions_status_check";
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_status_check"
  CHECK (status = ANY (ARRAY['init', 'running', 'executing', 'paused', 'completed', 'finish', 'failed', 'aborted']));
