/**
 * Industry Pack → Showcase Import Script
 *
 * Reads all industry-pack-* directories, extracts metadata from template-input.json
 * and manifest.json (if exists), then upserts into the showcase_industries / showcase_domains
 * / showcase_cases tables.
 *
 * This bridges the gap between:
 *   - Industry Pack (content production engine)
 *   - Showcase UI ("企业Agent大赏" display layer)
 *
 * Usage:
 *   npx tsx industry-packs/import-to-showcase.ts
 *
 * Behavior:
 *   - Idempotent: uses slug-based upsert for industries, name-based for domains/cases
 *   - Preserves existing manually-created showcase data
 *   - Only imports packs that have template-input.json
 *   - If manifest.json exists (pack fully generated), uses scope details for richer cases
 *   - If only template-input.json exists (pack planned), creates placeholder cases from scopeSeeds
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

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
  description: string;
  icon: string;
  color: string;
  tags: string[];
  scopeSeeds: ScopeSeed[];
  twinSeeds?: TwinSeed[];
  industryContext?: string;
}

interface ScopeSeed {
  name: string;
  description: string;
  agentCountHint?: number;
  businessRules?: string[];
}

interface TwinSeed {
  displayName: string;
  role: string;
  description: string;
}

interface Manifest {
  version: string;
  industry: { id: string; name: string; icon: string; color: string };
  stats: { scopeCount: number; agentCount: number; skillCount: number };
  scopes: ManifestScope[];
}

interface ManifestScope {
  dirName: string;
  name: string;
  agents: string[];
  skills: string[];
  hasWorkflow: boolean;
  hasSop: boolean;
}

interface PackInfo {
  dirPath: string;
  templateInput: TemplateInput;
  manifest: Manifest | null;
}

// ============================================================================
// Discovery
// ============================================================================

function discoverPacks(baseDir: string): PackInfo[] {
  const packs: PackInfo[] = [];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('industry-pack-')) continue;

    const dirPath = path.join(baseDir, entry.name);
    const templatePath = path.join(dirPath, 'template-input.json');

    if (!fs.existsSync(templatePath)) continue;

    const templateInput: TemplateInput = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));

    let manifest: Manifest | null = null;
    const manifestPath = path.join(dirPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }

    packs.push({ dirPath, templateInput, manifest });
  }

  return packs;
}

// ============================================================================
// Generate initial_prompt for a scope/case
// ============================================================================

function generateInitialPrompt(scopeName: string, description: string, businessRules?: string[]): string {
  // Create a realistic demo prompt based on the scope's purpose
  const ruleContext = businessRules?.slice(0, 2).join('；') || '';
  return `我想了解并体验"${scopeName}"场景的智能体能力。请基于以下业务背景启动演示：${description.slice(0, 100)}。${ruleContext ? `关键业务规则包括：${ruleContext}` : ''}请模拟一个典型的业务场景，展示智能体如何协作完成任务。`;
}

// ============================================================================
// Import Logic
// ============================================================================

async function importPack(pack: PackInfo, orgId: string): Promise<void> {
  const { templateInput, manifest } = pack;
  const slug = templateInput.id;
  const industryName = templateInput.industry;

  console.log(`\n📦 Importing: ${industryName} (${slug})`);

  // 1. Upsert Industry
  let industry = await prisma.showcase_industries.findFirst({
    where: { organization_id: orgId, slug },
  });

  if (industry) {
    await prisma.showcase_industries.update({
      where: { id: industry.id },
      data: { name: industryName, updated_at: new Date() },
    });
    console.log(`   ✏️  Updated industry: ${industryName}`);
  } else {
    // Get max sort_order
    const maxOrder = await prisma.showcase_industries.aggregate({
      where: { organization_id: orgId },
      _max: { sort_order: true },
    });
    const nextOrder = (maxOrder._max.sort_order ?? -1) + 1;

    industry = await prisma.showcase_industries.create({
      data: {
        organization_id: orgId,
        name: industryName,
        slug,
        sort_order: nextOrder,
      },
    });
    console.log(`   ✅ Created industry: ${industryName} (order: ${nextOrder})`);
  }

  // 2. Process scopes → domains + cases
  const scopes = manifest?.scopes || templateInput.scopeSeeds.map(s => ({
    dirName: s.name,
    name: s.name,
    agents: [],
    skills: [],
    hasWorkflow: false,
    hasSop: false,
  }));

  for (let i = 0; i < scopes.length; i++) {
    const scope = scopes[i];
    const scopeSeed = templateInput.scopeSeeds[i];
    const scopeIcon = templateInput.icon; // Use industry icon as fallback

    // Upsert Domain
    let domain = await prisma.showcase_domains.findFirst({
      where: {
        organization_id: orgId,
        industry_id: industry.id,
        name: scope.name,
      },
    });

    if (domain) {
      await prisma.showcase_domains.update({
        where: { id: domain.id },
        data: { sort_order: i, updated_at: new Date() },
      });
      console.log(`   ✏️  Updated domain: ${scope.name}`);
    } else {
      domain = await prisma.showcase_domains.create({
        data: {
          organization_id: orgId,
          industry_id: industry.id,
          name: scope.name,
          name_en: scope.dirName,
          icon: scopeIcon,
          sort_order: i,
        },
      });
      console.log(`   ✅ Created domain: ${scope.name}`);
    }

    // Create a showcase case for this scope (the "run this agent" entry point)
    const caseTitle = scope.name;
    const caseDescription = scopeSeed?.description || `${scope.name}场景智能体`;
    const initialPrompt = generateInitialPrompt(
      scope.name,
      caseDescription,
      scopeSeed?.businessRules
    );

    // Check if case already exists
    const existingCase = await prisma.showcase_cases.findFirst({
      where: {
        organization_id: orgId,
        domain_id: domain.id,
        title: caseTitle,
      },
    });

    if (!existingCase) {
      await prisma.showcase_cases.create({
        data: {
          organization_id: orgId,
          domain_id: domain.id,
          title: caseTitle,
          description: caseDescription,
          initial_prompt: initialPrompt,
          run_config: {
            source: 'industry-pack',
            pack_id: slug,
            scope_dir: scope.dirName,
            agent_count: manifest ? scope.agents.length : (scopeSeed?.agentCountHint || 0),
            has_workflow: scope.hasWorkflow,
            has_sop: scope.hasSop,
          },
          sort_order: 0,
        },
      });
      console.log(`      📋 Created case: ${caseTitle}`);
    } else {
      // Update run_config and description
      await prisma.showcase_cases.update({
        where: { id: existingCase.id },
        data: {
          description: caseDescription,
          initial_prompt: initialPrompt,
          run_config: {
            source: 'industry-pack',
            pack_id: slug,
            scope_dir: scope.dirName,
            agent_count: manifest ? scope.agents.length : (scopeSeed?.agentCountHint || 0),
            has_workflow: scope.hasWorkflow,
            has_sop: scope.hasSop,
          },
          updated_at: new Date(),
        },
      });
      console.log(`      ✏️  Updated case: ${caseTitle}`);
    }

    // If manifest exists (fully generated pack), also create per-agent cases
    if (manifest && scope.agents.length > 0) {
      // Read agent definitions for richer case descriptions
      const agentsDir = path.join(pack.dirPath, 'scopes', scope.dirName, 'agents');
      if (fs.existsSync(agentsDir)) {
        const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'));
        for (let j = 0; j < agentFiles.length; j++) {
          try {
            const agentDef = JSON.parse(
              fs.readFileSync(path.join(agentsDir, agentFiles[j]), 'utf-8')
            );
            const agentTitle = agentDef.display_name || agentDef.name;
            const agentDesc = agentDef.role || '';

            const existingAgentCase = await prisma.showcase_cases.findFirst({
              where: {
                organization_id: orgId,
                domain_id: domain.id,
                title: agentTitle,
              },
            });

            if (!existingAgentCase) {
              await prisma.showcase_cases.create({
                data: {
                  organization_id: orgId,
                  domain_id: domain.id,
                  title: agentTitle,
                  description: agentDesc,
                  initial_prompt: `请启动"${agentTitle}"智能体，模拟一个典型工作场景。${agentDesc}`,
                  run_config: {
                    source: 'industry-pack',
                    pack_id: slug,
                    scope_dir: scope.dirName,
                    agent_name: agentDef.name,
                    agent_type: 'individual',
                  },
                  sort_order: j + 1,
                },
              });
              console.log(`      📋 Created agent case: ${agentTitle}`);
            }
          } catch (err) {
            // Skip malformed agent files
          }
        }
      }
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🏆 Industry Pack → Showcase Import');
  console.log('===================================\n');

  // Find organization
  const org = await prisma.organizations.findFirst();
  if (!org) {
    throw new Error('No organization found. Run the main seed first: npx tsx prisma/seed.ts');
  }
  console.log(`Organization: ${org.name} (${org.id})`);

  // Discover packs
  const baseDir = path.resolve(__dirname);
  const packs = discoverPacks(baseDir);
  console.log(`\nDiscovered ${packs.length} industry packs:`);
  for (const pack of packs) {
    const status = pack.manifest ? '✅ fully generated' : '📝 template only';
    console.log(`  - ${pack.templateInput.industry} (${pack.templateInput.id}) [${status}]`);
  }

  // Import each pack
  for (const pack of packs) {
    await importPack(pack, org.id);
  }

  // Summary
  const totalIndustries = await prisma.showcase_industries.count({
    where: { organization_id: org.id },
  });
  const totalDomains = await prisma.showcase_domains.count({
    where: { organization_id: org.id },
  });
  const totalCases = await prisma.showcase_cases.count({
    where: { organization_id: org.id },
  });

  console.log('\n===================================');
  console.log('✅ Import complete!');
  console.log(`   Industries: ${totalIndustries}`);
  console.log(`   Domains: ${totalDomains}`);
  console.log(`   Cases: ${totalCases}`);
}

main()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
