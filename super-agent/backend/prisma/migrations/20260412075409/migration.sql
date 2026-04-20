-- DropForeignKey
ALTER TABLE "showcase_cases" DROP CONSTRAINT "showcase_cases_domain_id_fkey";

-- DropForeignKey
ALTER TABLE "showcase_cases" DROP CONSTRAINT "showcase_cases_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "showcase_domains" DROP CONSTRAINT "showcase_domains_industry_id_fkey";

-- DropForeignKey
ALTER TABLE "showcase_domains" DROP CONSTRAINT "showcase_domains_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "showcase_industries" DROP CONSTRAINT "showcase_industries_organization_id_fkey";

-- AlterTable
ALTER TABLE "showcase_cases" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "showcase_domains" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "showcase_industries" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "token_usage_log" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "token_usage_monthly" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "showcase_industries" ADD CONSTRAINT "showcase_industries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showcase_domains" ADD CONSTRAINT "showcase_domains_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showcase_domains" ADD CONSTRAINT "showcase_domains_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "showcase_industries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showcase_cases" ADD CONSTRAINT "showcase_cases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showcase_cases" ADD CONSTRAINT "showcase_cases_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "showcase_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "unique_industry_slug_per_org" RENAME TO "showcase_industries_organization_id_slug_key";

-- RenameIndex
ALTER INDEX "token_usage_log_org_user_created_idx" RENAME TO "token_usage_log_organization_id_user_id_created_at_idx";
