/**
 * Batch Generation Module — public API
 *
 * Standalone offline tool for generating industry solution packs.
 * Does NOT modify any existing functionality.
 */

export { BatchGenerationOrchestrator } from './orchestrator.js';
export type { IndustryTemplate, ScopeSeed, TwinSeed, ProgressCallback } from './types.js';
