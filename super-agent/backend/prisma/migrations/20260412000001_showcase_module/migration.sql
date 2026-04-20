-- Showcase module: "企业Agent大赏" — Industry → Domain → Case hierarchy

CREATE TABLE "showcase_industries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "showcase_industries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "showcase_industries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "unique_industry_slug_per_org" ON "showcase_industries"("organization_id", "slug");
CREATE INDEX "showcase_industries_organization_id_idx" ON "showcase_industries"("organization_id");
CREATE INDEX "showcase_industries_sort_order_idx" ON "showcase_industries"("sort_order");

CREATE TABLE "showcase_domains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "industry_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "icon" VARCHAR(10),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "showcase_domains_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "showcase_domains_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "showcase_domains_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "showcase_industries"("id") ON DELETE CASCADE
);

CREATE INDEX "showcase_domains_organization_id_idx" ON "showcase_domains"("organization_id");
CREATE INDEX "showcase_domains_industry_id_idx" ON "showcase_domains"("industry_id");
CREATE INDEX "showcase_domains_sort_order_idx" ON "showcase_domains"("sort_order");

CREATE TABLE "showcase_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "domain_id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "agent_id" UUID,
    "workflow_id" UUID,
    "scope_id" UUID,
    "run_config" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "showcase_cases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "showcase_cases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
    CONSTRAINT "showcase_cases_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "showcase_domains"("id") ON DELETE CASCADE
);

CREATE INDEX "showcase_cases_organization_id_idx" ON "showcase_cases"("organization_id");
CREATE INDEX "showcase_cases_domain_id_idx" ON "showcase_cases"("domain_id");
CREATE INDEX "showcase_cases_sort_order_idx" ON "showcase_cases"("sort_order");
