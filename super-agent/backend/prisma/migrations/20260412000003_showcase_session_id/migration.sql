-- Add session_id to showcase_cases for linking to original chat sessions
ALTER TABLE "showcase_cases" ADD COLUMN "session_id" UUID;
CREATE INDEX "showcase_cases_session_id_idx" ON "showcase_cases"("session_id");
