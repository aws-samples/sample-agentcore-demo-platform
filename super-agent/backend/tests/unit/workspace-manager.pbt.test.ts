/**
 * Property-based tests for WorkspaceManager
 *
 * Feature: claude-agent-sdk-chat
 * Property 7: Workspace path derivation is deterministic
 * Validates: Requirements 4.1
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import { WorkspaceManager } from '../../src/services/workspace-manager.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock S3Client (not used for path derivation, but required by constructor). */
function createMockS3Client() {
  return {
    send: vi.fn(async () => {
      throw new Error('S3 not expected in path derivation tests');
    }),
  };
}

/**
 * Generates a valid agent ID string.
 * Agent IDs are typically UUIDs or alphanumeric identifiers.
 * We constrain to non-empty strings with filesystem-safe characters.
 */
const agentIdArb = fc
  .stringMatching(/^[a-zA-Z0-9_-]{1,64}$/);

/**
 * Generates a valid base directory path.
 * Uses realistic path prefixes to simulate different deployment environments.
 */
const baseDirArb = fc.constantFrom(
  '/tmp/workspaces',
  '/var/lib/agent-workspaces',
  '/home/user/workspaces',
  '/opt/agents/work',
  tmpdir(),
);

// ---------------------------------------------------------------------------
// Property 7: Workspace path derivation is deterministic
// ---------------------------------------------------------------------------

describe('Property 7: Workspace path derivation is deterministic', () => {
  /**
   * **Validates: Requirements 4.1**
   *
   * For any agent ID string, the WorkspaceManager.ensureWorkspace method SHALL
   * return a path equal to {baseDir}/{agentId}, and the skills directory SHALL
   * be at {baseDir}/{agentId}/.claude/skills/.
   */

  it('getWorkspacePath SHALL return {baseDir}/{agentId} for any agent ID', () => {
    fc.assert(
      fc.property(baseDirArb, agentIdArb, (baseDir, agentId) => {
        const manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
        const result = manager.getWorkspacePath(agentId);
        expect(result).toBe(join(baseDir, agentId));
      }),
      { numRuns: 100 },
    );
  });

  it('getSkillsDir SHALL return {baseDir}/{agentId}/.claude/skills/ for any agent ID', () => {
    fc.assert(
      fc.property(baseDirArb, agentIdArb, (baseDir, agentId) => {
        const manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
        const result = manager.getSkillsDir(agentId);
        expect(result).toBe(join(baseDir, agentId, '.claude', 'skills'));
      }),
      { numRuns: 100 },
    );
  });

  it('workspace path derivation is deterministic: same inputs always produce same outputs', () => {
    fc.assert(
      fc.property(baseDirArb, agentIdArb, (baseDir, agentId) => {
        const manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
        const path1 = manager.getWorkspacePath(agentId);
        const path2 = manager.getWorkspacePath(agentId);
        expect(path1).toBe(path2);

        const skills1 = manager.getSkillsDir(agentId);
        const skills2 = manager.getSkillsDir(agentId);
        expect(skills1).toBe(skills2);
      }),
      { numRuns: 100 },
    );
  });

  it('skills directory is always a subdirectory of the workspace path', () => {
    fc.assert(
      fc.property(baseDirArb, agentIdArb, (baseDir, agentId) => {
        const manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
        const workspacePath = manager.getWorkspacePath(agentId);
        const skillsDir = manager.getSkillsDir(agentId);

        // Skills dir must start with workspace path
        expect(skillsDir.startsWith(workspacePath)).toBe(true);
        // Skills dir must be deeper than workspace path
        expect(skillsDir.length).toBeGreaterThan(workspacePath.length);
        // The relative portion must be .claude/skills
        const relativePart = skillsDir.slice(workspacePath.length);
        expect(relativePart).toBe(`${join('/', '.claude', 'skills')}`);
      }),
      { numRuns: 100 },
    );
  });

  it('different agent IDs produce different workspace paths', () => {
    fc.assert(
      fc.property(
        baseDirArb,
        agentIdArb,
        agentIdArb.filter((id) => id.length > 0),
        (baseDir, agentId1, agentId2) => {
          fc.pre(agentId1 !== agentId2);
          const manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
          const path1 = manager.getWorkspacePath(agentId1);
          const path2 = manager.getWorkspacePath(agentId2);
          expect(path1).not.toBe(path2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('ensureWorkspace SHALL return a path equal to {baseDir}/{agentId}', async () => {
    // Use a real temp directory for ensureWorkspace since it creates directories
    const tempBase = join(tmpdir(), `pbt-workspace-${randomUUID()}`);
    await mkdir(tempBase, { recursive: true });

    try {
      await fc.assert(
        fc.asyncProperty(agentIdArb, async (agentId) => {
          const manager = new WorkspaceManager(tempBase, createMockS3Client() as never);
          const result = await manager.ensureWorkspace(agentId, []);
          expect(result).toBe(join(tempBase, agentId));
        }),
        { numRuns: 20 }, // Fewer runs since this creates real directories
      );
    } finally {
      await rm(tempBase, { recursive: true, force: true });
    }
  });

  it('ensureWorkspace is idempotent: calling twice returns the same path', async () => {
    const tempBase = join(tmpdir(), `pbt-workspace-idem-${randomUUID()}`);
    await mkdir(tempBase, { recursive: true });

    try {
      await fc.assert(
        fc.asyncProperty(agentIdArb, async (agentId) => {
          const manager = new WorkspaceManager(tempBase, createMockS3Client() as never);
          const result1 = await manager.ensureWorkspace(agentId, []);
          const result2 = await manager.ensureWorkspace(agentId, []);
          expect(result1).toBe(result2);
          expect(result1).toBe(join(tempBase, agentId));
        }),
        { numRuns: 20 },
      );
    } finally {
      await rm(tempBase, { recursive: true, force: true });
    }
  });
});
