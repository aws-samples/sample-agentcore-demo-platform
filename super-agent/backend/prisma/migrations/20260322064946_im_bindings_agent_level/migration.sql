-- AlterTable
ALTER TABLE "im_channel_bindings" ADD COLUMN     "agent_id" UUID,
ALTER COLUMN "business_scope_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "im_channel_bindings_agent_id_idx" ON "im_channel_bindings"("agent_id");
