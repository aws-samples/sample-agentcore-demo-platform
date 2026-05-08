#!/usr/bin/env node
/**
 * CLI entry point for batch industry pack generation.
 *
 * Usage:
 *   npx tsx src/batch-gen/cli.ts <template.json> [--output <dir>]
 *   npx tsx src/batch-gen/cli.ts <template.json> --scope-only <scope1> [<scope2> ...]
 *
 * Examples:
 *   # Full generation
 *   npx tsx src/batch-gen/cli.ts src/batch-gen/templates/finance-risk.json
 *
 *   # Incremental: only generate specific new scopes into an existing pack
 *   npx tsx src/batch-gen/cli.ts src/batch-gen/templates/customer-service.json \
 *     --scope-only "跨境与行业垂直客服"
 *
 *   npx tsx src/batch-gen/cli.ts src/batch-gen/templates/finance-risk.json \
 *     --scope-only "保险与财富管理" "支付与交易风控"
 *
 * Environment:
 *   Requires the same .env as the backend (DATABASE_URL, AWS credentials, etc.)
 *   The CLAUDE_MODEL env var controls which model is used (recommend Opus for quality).
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { BatchGenerationOrchestrator } from './orchestrator.js';
import type { IndustryTemplate } from './types.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npx tsx src/batch-gen/cli.ts <template.json> [options]

Arguments:
  template.json   Path to an IndustryTemplate JSON file

Options:
  --output <dir>          Output directory (default: ./industry-packs)
  --scope-only <names...> Only generate specified scopes (incremental mode).
                          Names must match scopeSeeds[].name in the template.
                          Requires an existing pack with master-plan.json.
  --help                  Show this help message

Environment:
  CLAUDE_MODEL    Model to use (default from .env, recommend claude-opus-4-20250514)
  DATABASE_URL    Required (even though we don't write to DB, config validation needs it)

Examples:
  # Full generation (all scopes + twins + validation)
  npx tsx src/batch-gen/cli.ts src/batch-gen/templates/finance-risk.json

  # Incremental: add new scopes to an existing pack
  npx tsx src/batch-gen/cli.ts src/batch-gen/templates/healthcare.json \\
    --scope-only "基因组与精准医疗" "医疗财务与收入优化"
`);
    process.exit(0);
  }

  // Parse arguments
  const templatePath = resolve(args[0]!);
  let outputDir = resolve(import.meta.dirname ?? '.', '..', '..', '..', 'industry-packs');

  const outputIdx = args.indexOf('--output');
  if (outputIdx !== -1 && args[outputIdx + 1]) {
    outputDir = resolve(args[outputIdx + 1]!);
  }

  // Parse --scope-only
  let scopeOnlyNames: string[] | undefined;
  const scopeOnlyIdx = args.indexOf('--scope-only');
  if (scopeOnlyIdx !== -1) {
    scopeOnlyNames = [];
    // Collect all arguments after --scope-only until we hit another flag or end
    for (let i = scopeOnlyIdx + 1; i < args.length; i++) {
      if (args[i]!.startsWith('--')) break;
      scopeOnlyNames.push(args[i]!);
    }
    if (scopeOnlyNames.length === 0) {
      console.error('Error: --scope-only requires at least one scope name');
      process.exit(1);
    }
  }

  // Load template
  console.log(`Loading template: ${templatePath}`);
  const templateJson = await readFile(templatePath, 'utf-8');
  const template: IndustryTemplate = JSON.parse(templateJson);

  console.log(`Industry: ${template.industry} (${template.id})`);
  console.log(`Scopes: ${template.scopeSeeds.length}`);
  console.log(`Digital Twins: ${template.twinSeeds?.length ?? 0}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Model: ${process.env.CLAUDE_MODEL ?? '(default from config)'}`);

  if (scopeOnlyNames) {
    console.log(`Mode: INCREMENTAL (--scope-only)`);
    console.log(`Target scopes: ${scopeOnlyNames.join(', ')}`);

    // Validate that all requested scope names exist in the template
    for (const name of scopeOnlyNames) {
      const found = template.scopeSeeds.find(s => s.name === name);
      if (!found) {
        console.error(`Error: scope "${name}" not found in template scopeSeeds.`);
        console.error(`Available scopes: ${template.scopeSeeds.map(s => s.name).join(', ')}`);
        process.exit(1);
      }
    }
  } else {
    console.log(`Mode: FULL generation`);
  }
  console.log('---');

  // Run generation
  const orchestrator = new BatchGenerationOrchestrator();
  const startTime = Date.now();

  let packDir: string;

  if (scopeOnlyNames) {
    packDir = await orchestrator.generateScopesOnly(template, outputDir, scopeOnlyNames, (step, detail) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`[${elapsed}s] [${step}] ${detail}`);
    });
  } else {
    packDir = await orchestrator.generate(template, outputDir, (step, detail) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`[${elapsed}s] [${step}] ${detail}`);
    });
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('---');
  console.log(`Done in ${totalTime} minutes.`);
  console.log(`Pack: ${packDir}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
