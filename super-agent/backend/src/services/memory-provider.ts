/**
 * Memory Provider — abstraction for pluggable memory backends.
 *
 * Two providers:
 *   - PostgresMemoryProvider: wraps existing scopeMemoryRepository (default, always active)
 *   - VectorMemoryProvider: pgvector semantic search via Bedrock Nova Embed (optional)
 *
 * PostgreSQL remains the source of truth. Vector search is an enhancement layer
 * enabled when VECTOR_MEMORY_ENABLED=true (requires pgvector extension).
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface MemoryEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_pinned: boolean;
  created_at: Date;
}

export interface MemoryContext {
  organizationId: string;
  scopeId: string;
  agentId?: string;
  userId?: string;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface MemoryProvider {
  readonly name: string;

  /** Store a memory. */
  add(entry: Omit<MemoryEntry, 'id' | 'created_at'>, context: MemoryContext): Promise<string>;

  /** Semantic search — return memories most relevant to the query. */
  search(query: string, context: MemoryContext, limit?: number): Promise<MemoryEntry[]>;

  /** Load memories for CLAUDE.md injection (bulk, non-semantic). */
  loadForContext(scopeId: string): Promise<MemoryEntry[]>;
}

// ---------------------------------------------------------------------------
// PostgreSQL provider (wraps existing repository — zero behavior change)
// ---------------------------------------------------------------------------

export class PostgresMemoryProvider implements MemoryProvider {
  readonly name = 'postgres';

  async add(entry: Omit<MemoryEntry, 'id' | 'created_at'>, context: MemoryContext): Promise<string> {
    const { scopeMemoryRepository } = await import('../repositories/scope-memory.repository.js');
    const created = await scopeMemoryRepository.create({
      organization_id: context.organizationId,
      business_scope_id: context.scopeId,
      session_id: null,
      title: entry.title,
      content: entry.content,
      category: entry.category,
      tags: entry.tags,
      is_pinned: entry.is_pinned,
      created_by: context.userId ?? null,
    });
    return created.id;
  }

  async search(query: string, context: MemoryContext, limit = 10): Promise<MemoryEntry[]> {
    const { scopeMemoryRepository } = await import('../repositories/scope-memory.repository.js');
    const results = await scopeMemoryRepository.findByScope(
      context.organizationId,
      context.scopeId,
      { q: query, limit },
    );
    return results.map(toMemoryEntry);
  }

  async loadForContext(scopeId: string): Promise<MemoryEntry[]> {
    const { scopeMemoryRepository } = await import('../repositories/scope-memory.repository.js');
    const results = await scopeMemoryRepository.findForContext(scopeId);
    return results.map(toMemoryEntry);
  }
}

// ---------------------------------------------------------------------------
// Vector Memory provider (pgvector + Bedrock Nova Embed)
// ---------------------------------------------------------------------------

export class VectorMemoryProvider implements MemoryProvider {
  readonly name = 'vector';

  async add(entry: Omit<MemoryEntry, 'id' | 'created_at'>, context: MemoryContext): Promise<string> {
    const { vectorMemoryService } = await import('./vector-memory.service.js');
    return vectorMemoryService.add({
      organizationId: context.organizationId,
      scopeId: context.scopeId,
      title: entry.title,
      content: entry.content,
      category: entry.category,
      tags: entry.tags,
      createdBy: context.userId,
    });
  }

  async search(query: string, context: MemoryContext, limit = 10): Promise<MemoryEntry[]> {
    const { vectorMemoryService } = await import('./vector-memory.service.js');
    const results = await vectorMemoryService.search(query, context.scopeId, limit);
    return results.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      category: r.category,
      tags: r.tags,
      is_pinned: r.is_pinned,
      created_at: r.created_at,
    }));
  }

  async loadForContext(scopeId: string): Promise<MemoryEntry[]> {
    // For bulk loading, use a broad semantic query
    const { vectorMemoryService } = await import('./vector-memory.service.js');
    const results = await vectorMemoryService.search(
      'important knowledge lessons patterns and gaps',
      scopeId,
      20,
      0.3, // lower threshold for broad retrieval
    );
    return results.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      category: r.category,
      tags: r.tags,
      is_pinned: r.is_pinned,
      created_at: r.created_at,
    }));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toMemoryEntry(row: { id: string; title: string; content: string; category: string; tags: string[]; is_pinned: boolean; created_at: Date }): MemoryEntry {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    tags: row.tags,
    is_pinned: row.is_pinned,
    created_at: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _postgresProvider: PostgresMemoryProvider | null = null;
let _vectorProvider: VectorMemoryProvider | null = null;

/** The primary provider (always PostgreSQL). */
export function getMemoryProvider(): MemoryProvider {
  if (!_postgresProvider) _postgresProvider = new PostgresMemoryProvider();
  return _postgresProvider;
}

/** The optional vector memory provider (null if not enabled). */
export function getVectorProvider(): VectorMemoryProvider | null {
  if (!isVectorMemoryEnabled()) return null;
  if (!_vectorProvider) _vectorProvider = new VectorMemoryProvider();
  return _vectorProvider;
}

/** Check if vector memory is enabled. */
export function isVectorMemoryEnabled(): boolean {
  return process.env.VECTOR_MEMORY_ENABLED === 'true' || process.env.VECTOR_MEMORY_ENABLED === '1';
}
