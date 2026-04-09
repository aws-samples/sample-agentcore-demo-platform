-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "is_shared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "origin" VARCHAR(50) NOT NULL DEFAULT 'scope_generation';

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "agent_id" UUID,
ADD COLUMN     "mention_agent_id" UUID,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "room_mode" VARCHAR(20) NOT NULL DEFAULT 'single',
ADD COLUMN     "routing_strategy" VARCHAR(20) NOT NULL DEFAULT 'auto';

-- CreateTable
CREATE TABLE "chat_room_members" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'member',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "added_by" UUID,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_room_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_scope_assignments" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "business_scope_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "agent_scope_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_room_members_session_id_idx" ON "chat_room_members"("session_id");

-- CreateIndex
CREATE INDEX "chat_room_members_agent_id_idx" ON "chat_room_members"("agent_id");

-- CreateIndex
CREATE INDEX "chat_room_members_session_id_is_active_idx" ON "chat_room_members"("session_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "chat_room_members_session_id_agent_id_key" ON "chat_room_members"("session_id", "agent_id");

-- CreateIndex
CREATE INDEX "agent_scope_assignments_agent_id_idx" ON "agent_scope_assignments"("agent_id");

-- CreateIndex
CREATE INDEX "agent_scope_assignments_business_scope_id_idx" ON "agent_scope_assignments"("business_scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_scope_assignments_agent_id_business_scope_id_key" ON "agent_scope_assignments"("agent_id", "business_scope_id");

-- CreateIndex
CREATE INDEX "agents_origin_idx" ON "agents"("origin");

-- CreateIndex
CREATE INDEX "chat_messages_agent_id_idx" ON "chat_messages"("agent_id");

-- CreateIndex
CREATE INDEX "chat_sessions_room_mode_idx" ON "chat_sessions"("room_mode");

-- AddForeignKey
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_room_members" ADD CONSTRAINT "chat_room_members_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_scope_assignments" ADD CONSTRAINT "agent_scope_assignments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_scope_assignments" ADD CONSTRAINT "agent_scope_assignments_business_scope_id_fkey" FOREIGN KEY ("business_scope_id") REFERENCES "business_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
