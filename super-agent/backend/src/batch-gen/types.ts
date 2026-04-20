/**
 * Industry Template types for batch generation.
 * This is a standalone offline tool — it does NOT modify any existing code.
 */

// ---------------------------------------------------------------------------
// Input: Industry Template (seed for generation)
// ---------------------------------------------------------------------------

export interface IndustryTemplate {
  /** Unique identifier (kebab-case) */
  id: string;
  /** Industry name */
  industry: string;
  /** Industry overview (1-3 paragraphs) */
  description: string;
  /** Emoji icon */
  icon: string;
  /** Hex color */
  color: string;
  /** Tags */
  tags: string[];

  /** Business scope seeds */
  scopeSeeds: ScopeSeed[];

  /** Digital twin seeds (optional) */
  twinSeeds?: TwinSeed[];

  /** Extra industry context (regulations, domain knowledge, etc.) */
  industryContext?: string;
}

export interface ScopeSeed {
  name: string;
  description: string;
  agentCountHint?: number;
  existingSopContent?: string;
  businessRules?: string[];
}

export interface TwinSeed {
  displayName: string;
  role: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Progress callback
// ---------------------------------------------------------------------------

export type ProgressCallback = (step: string, detail: string) => void;
