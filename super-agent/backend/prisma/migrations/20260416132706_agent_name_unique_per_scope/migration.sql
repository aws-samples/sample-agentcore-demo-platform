/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,business_scope_id,name]` on the table `agents` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "agents_organization_id_business_scope_id_name_key" ON "agents"("organization_id", "business_scope_id", "name");
