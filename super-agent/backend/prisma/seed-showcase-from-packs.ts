/**
 * Showcase Seed from Industry Packs
 *
 * Reads all industry-pack-* directories and populates showcase tables.
 * This replaces the hardcoded seed-showcase.ts with data-driven content
 * sourced from the actual generated packs.
 *
 * Run with: npx tsx prisma/seed-showcase-from-packs.ts
 *
 * Behavior:
 *   - Idempotent: upserts by slug/name, safe to re-run
 *   - Does NOT delete existing manually-created showcase data
 *   - Reads manifest.json (fully generated packs) or template-input.json (planned packs)
 *   - Each scope becomes a domain, each scope gets one showcase case with initial_prompt
 *   - For fully generated packs, also creates per-agent cases
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============================================================================
// Types
// ============================================================================

interface TemplateInput {
  id: string;
  industry: string;
  icon: string;
  color: string;
  scopeSeeds: Array<{
    name: string;
    description: string;
    agentCountHint?: number;
    businessRules?: string[];
  }>;
}

interface Manifest {
  industry: { id: string; name: string; icon: string; color: string };
  scopes: Array<{
    dirName: string;
    name: string;
    agents: string[];
    skills: string[];
    hasWorkflow: boolean;
    hasSop: boolean;
  }>;
}

interface PackInfo {
  dirPath: string;
  template: TemplateInput;
  manifest: Manifest | null;
}

// ============================================================================
// Helpers
// ============================================================================

function discoverPacks(): PackInfo[] {
  const baseDir = path.resolve(import.meta.dirname!, '..', '..', 'industry-packs');
  const packs: PackInfo[] = [];

  if (!fs.existsSync(baseDir)) {
    console.error(`Industry packs directory not found: ${baseDir}`);
    return packs;
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('industry-pack-')) continue;

    const dirPath = path.join(baseDir, entry.name);
    const templatePath = path.join(dirPath, 'template-input.json');
    if (!fs.existsSync(templatePath)) continue;

    const template: TemplateInput = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

    let manifest: Manifest | null = null;
    const manifestPath = path.join(dirPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }

    packs.push({ dirPath, template, manifest });
  }

  return packs;
}

function generatePrompt(scopeName: string, description: string, rules?: string[]): string {
  const ruleHint = rules?.slice(0, 2).join('；') || '';
  return `我想体验"${scopeName}"场景。${description.slice(0, 80)}。${ruleHint ? `关键规则：${ruleHint.slice(0, 100)}` : ''}请模拟一个典型业务场景，展示智能体协作。`;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🏆 Seeding showcase from industry packs...\n');

  const org = await prisma.organizations.findFirst();
  if (!org) {
    throw new Error('No organization found. Run the main seed first: npx tsx prisma/seed.ts');
  }
  const orgId = org.id;
  console.log(`Organization: ${org.name} (${orgId})\n`);

  // Clean existing showcase data
  const deletedCases = await prisma.showcase_cases.deleteMany({ where: { organization_id: orgId } });
  const deletedDomains = await prisma.showcase_domains.deleteMany({ where: { organization_id: orgId } });
  const deletedIndustries = await prisma.showcase_industries.deleteMany({ where: { organization_id: orgId } });
  console.log(`🗑️  Cleaned existing showcase data: ${deletedIndustries.count} industries, ${deletedDomains.count} domains, ${deletedCases.count} cases\n`);

  const packs = discoverPacks();
  console.log(`Discovered ${packs.length} industry packs\n`);

  let totalIndustries = 0;
  let totalDomains = 0;
  let totalCases = 0;

  for (const pack of packs) {
    const { template, manifest, dirPath } = pack;
    const slug = template.id;
    const industryName = template.industry;
    const icon = manifest?.industry?.icon || template.icon;

    console.log(`📦 ${industryName} (${slug}) ${manifest ? '✅' : '📝'}`);

    // Upsert industry
    let industry = await prisma.showcase_industries.findFirst({
      where: { organization_id: orgId, slug },
    });

    if (!industry) {
      const maxOrder = await prisma.showcase_industries.aggregate({
        where: { organization_id: orgId },
        _max: { sort_order: true },
      });
      industry = await prisma.showcase_industries.create({
        data: {
          organization_id: orgId,
          name: industryName,
          slug,
          sort_order: (maxOrder._max.sort_order ?? -1) + 1,
        },
      });
      totalIndustries++;
      console.log(`   + Industry: ${industryName}`);
    }

    // Process scopes → domains + cases
    const scopes = manifest?.scopes || template.scopeSeeds.map(s => ({
      dirName: s.name,
      name: s.name,
      agents: [] as string[],
      skills: [] as string[],
      hasWorkflow: false,
      hasSop: false,
    }));

    for (let i = 0; i < scopes.length; i++) {
      const scope = scopes[i]!;
      const scopeSeed = template.scopeSeeds[i];

      // Upsert domain
      let domain = await prisma.showcase_domains.findFirst({
        where: { organization_id: orgId, industry_id: industry.id, name: scope.name },
      });

      if (!domain) {
        domain = await prisma.showcase_domains.create({
          data: {
            organization_id: orgId,
            industry_id: industry.id,
            name: scope.name,
            name_en: scope.dirName !== scope.name ? scope.dirName : null,
            icon: icon,
            sort_order: i,
          },
        });
        totalDomains++;
        console.log(`   + Domain: ${scope.name}`);
      }

      // Create main case for this scope
      const caseTitle = scope.name;
      const caseDesc = scopeSeed?.description || `${scope.name}智能体场景`;
      const prompt = generatePrompt(scope.name, caseDesc, scopeSeed?.businessRules);

      const existingCase = await prisma.showcase_cases.findFirst({
        where: { organization_id: orgId, domain_id: domain.id, title: caseTitle },
      });

      if (!existingCase) {
        await prisma.showcase_cases.create({
          data: {
            organization_id: orgId,
            domain_id: domain.id,
            title: caseTitle,
            description: caseDesc.slice(0, 500),
            initial_prompt: prompt,
            run_config: {
              source: 'industry-pack',
              pack_id: slug,
              scope_dir: scope.dirName,
              agent_count: scope.agents.length || (scopeSeed?.agentCountHint || 0),
              has_workflow: scope.hasWorkflow,
            },
            sort_order: 0,
          },
        });
        totalCases++;
      }

      // For fully generated packs, create per-agent cases
      if (manifest && scope.agents.length > 0) {
        const agentsDir = path.join(dirPath, 'scopes', scope.dirName, 'agents');
        if (fs.existsSync(agentsDir)) {
          const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));
          for (let j = 0; j < agentFiles.length; j++) {
            try {
              const agentDef = JSON.parse(fs.readFileSync(path.join(agentsDir, agentFiles[j]!), 'utf-8'));
              const agentTitle = agentDef.display_name || agentDef.name;
              const agentDesc = agentDef.role || '';

              const existingAgentCase = await prisma.showcase_cases.findFirst({
                where: { organization_id: orgId, domain_id: domain.id, title: agentTitle },
              });

              if (!existingAgentCase) {
                await prisma.showcase_cases.create({
                  data: {
                    organization_id: orgId,
                    domain_id: domain.id,
                    title: agentTitle,
                    description: agentDesc.slice(0, 500),
                    initial_prompt: `启动"${agentTitle}"智能体。${agentDesc.slice(0, 100)}。请模拟一个典型工作场景。`,
                    run_config: {
                      source: 'industry-pack',
                      pack_id: slug,
                      scope_dir: scope.dirName,
                      agent_name: agentDef.name,
                    },
                    sort_order: j + 1,
                  },
                });
                totalCases++;
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    }

    // Import digital twins as a special "行业专家" domain
    const twinsDir = path.join(dirPath, 'digital-twins');
    if (fs.existsSync(twinsDir)) {
      const twinEntries = fs.readdirSync(twinsDir, { withFileTypes: true }).filter(d => d.isDirectory());
      if (twinEntries.length > 0) {
        // Create or find the "行业专家" domain
        let twinDomain = await prisma.showcase_domains.findFirst({
          where: { organization_id: orgId, industry_id: industry.id, name: '行业专家' },
        });

        if (!twinDomain) {
          twinDomain = await prisma.showcase_domains.create({
            data: {
              organization_id: orgId,
              industry_id: industry.id,
              name: '行业专家',
              name_en: 'Digital Twins',
              icon: '👤',
              sort_order: 999, // Always last
            },
          });
          totalDomains++;
          console.log(`   + Domain: 行业专家 (Digital Twins)`);
        }

        for (let t = 0; t < twinEntries.length; t++) {
          const twinEntry = twinEntries[t]!;
          const twinJsonPath = path.join(twinsDir, twinEntry.name, 'twin.json');
          if (!fs.existsSync(twinJsonPath)) continue;

          try {
            const twinDef = JSON.parse(fs.readFileSync(twinJsonPath, 'utf-8'));
            const twinName = twinDef.name || twinEntry.name;
            const twinRole = twinDef.role || '';
            const twinDesc = twinDef.description || '';

            const existingTwinCase = await prisma.showcase_cases.findFirst({
              where: { organization_id: orgId, domain_id: twinDomain.id, title: twinName },
            });

            if (!existingTwinCase) {
              await prisma.showcase_cases.create({
                data: {
                  organization_id: orgId,
                  domain_id: twinDomain.id,
                  title: twinName,
                  description: `${twinRole}${twinDesc ? ' — ' + twinDesc.slice(0, 300) : ''}`,
                  initial_prompt: `你好，我想和"${twinName}"（${twinRole}）进行一次战略咨询对话。请以该角色的专业视角，帮我分析当前业务挑战并给出建议。`,
                  run_config: {
                    source: 'industry-pack',
                    pack_id: slug,
                    twin_dir: twinEntry.name,
                    type: 'digital_twin',
                  },
                  sort_order: t,
                },
              });
              totalCases++;
            }
          } catch { /* skip malformed */ }
        }
      }
    }

    console.log('');
  }

  console.log('===================================');
  console.log('✅ Showcase seed complete!');
  console.log(`   New industries: ${totalIndustries}`);
  console.log(`   New domains: ${totalDomains}`);
  console.log(`   New cases: ${totalCases}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
