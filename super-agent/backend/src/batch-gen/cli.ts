#!/usr/bin/env node
/**
 * CLI entry point for batch industry pack generation.
 *
 * Usage:
 *   npx tsx src/batch-gen/cli.ts <template.json> [--output <dir>]
 *
 * Example:
 *   npx tsx src/batch-gen/cli.ts src/batch-gen/templates/finance-risk.json --output /tmp/packs
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
Usage: npx tsx src/batch-gen/cli.ts <template.json> [--output <dir>]

Arguments:
  template.json   Path to an IndustryTemplate JSON file

Options:
  --output <dir>  Output directory (default: ./industry-packs)
  --help          Show this help message

Environment:
  CLAUDE_MODEL    Model to use (default from .env, recommend claude-opus-4-20250514)
  DATABASE_URL    Required (even though we don't write to DB, config validation needs it)

Example:
  npx tsx src/batch-gen/cli.ts src/batch-gen/templates/finance-risk.json
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

  // Load template
  console.log(`Loading template: ${templatePath}`);
  const templateJson = await readFile(templatePath, 'utf-8');
  const template: IndustryTemplate = JSON.parse(templateJson);

  console.log(`Industry: ${template.industry} (${template.id})`);
  console.log(`Scopes: ${template.scopeSeeds.length}`);
  console.log(`Digital Twins: ${template.twinSeeds?.length ?? 0}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Model: ${process.env.CLAUDE_MODEL ?? '(default from config)'}`);
  console.log('---');

  // Run generation
  const orchestrator = new BatchGenerationOrchestrator();
  const startTime = Date.now();

  const packDir = await orchestrator.generate(template, outputDir, (step, detail) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`[${elapsed}s] [${step}] ${detail}`);
  });

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('---');
  console.log(`Done in ${totalTime} minutes.`);
  console.log(`Pack: ${packDir}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
