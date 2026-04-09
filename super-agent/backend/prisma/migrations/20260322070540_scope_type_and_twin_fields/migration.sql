-- AlterTable
ALTER TABLE "business_scopes" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "scope_type" VARCHAR(20) NOT NULL DEFAULT 'business',
ADD COLUMN     "system_prompt" TEXT;
