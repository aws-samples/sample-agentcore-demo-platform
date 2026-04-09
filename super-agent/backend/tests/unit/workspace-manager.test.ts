import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { WorkspaceManager, type SkillForWorkspace } from '../../src/services/workspace-manager.js';

/**
 * Helper to create a unique temporary base directory for each test.
 */
function createTempBaseDir(): string {
  return join(tmpdir(), `workspace-manager-test-${randomUUID()}`);
}

/**
 * Helper to create a mock S3Client that returns a given body for GetObject.
 */
function createMockS3Client(responses?: Map<string, Buffer | Error>) {
  return {
    send: vi.fn(async (command: unknown) => {
      const cmd = command as { input: { Bucket: string; Key: string } };
      const key = `${cmd.input.Bucket}/${cmd.input.Key}`;

      if (responses) {
        const response = responses.get(key);
        if (response instanceof Error) {
          throw response;
        }
        if (response) {
          return {
            Body: {
              [Symbol.asyncIterator]: async function* () {
                yield response;
              },
              pipe: vi.fn(),
            },
          };
        }
      }

      throw new Error(`NoSuchKey: The specified key does not exist: ${key}`);
    }),
  };
}

/**
 * Helper to create a test skill.
 */
function createTestSkill(overrides?: Partial<SkillForWorkspace>): SkillForWorkspace {
  return {
    id: overrides?.id ?? randomUUID(),
    name: overrides?.name ?? 'test-skill',
    hashId: overrides?.hashId ?? 'abc123hash',
    s3Bucket: overrides?.s3Bucket ?? 'test-bucket',
    s3Prefix: overrides?.s3Prefix ?? 'skills/abc123hash/',
  };
}

describe('WorkspaceManager', () => {
  let baseDir: string;
  let manager: WorkspaceManager;

  beforeEach(async () => {
    baseDir = createTempBaseDir();
    await mkdir(baseDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  describe('getWorkspacePath', () => {
    it('should return {baseDir}/{agentId}', () => {
      manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
      const agentId = 'agent-123';
      const result = manager.getWorkspacePath(agentId);
      expect(result).toBe(join(baseDir, agentId));
    });

    it('should be deterministic for the same agentId', () => {
      manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
      const agentId = 'agent-456';
      const result1 = manager.getWorkspacePath(agentId);
      const result2 = manager.getWorkspacePath(agentId);
      expect(result1).toBe(result2);
    });

    it('should return different paths for different agentIds', () => {
      manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
      const path1 = manager.getWorkspacePath('agent-a');
      const path2 = manager.getWorkspacePath('agent-b');
      expect(path1).not.toBe(path2);
    });
  });

  describe('getSkillsDir', () => {
    it('should return {baseDir}/{agentId}/.claude/skills', () => {
      manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
      const agentId = 'agent-789';
      const result = manager.getSkillsDir(agentId);
      expect(result).toBe(join(baseDir, agentId, '.claude', 'skills'));
    });
  });

  describe('ensureWorkspace', () => {
    it('should create the workspace directory structure', async () => {
      manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
      const agentId = 'agent-create-test';

      const workspacePath = await manager.ensureWorkspace(agentId, []);

      expect(workspacePath).toBe(join(baseDir, agentId));

      // Verify directory structure was created
      const skillsDir = join(baseDir, agentId, '.claude', 'skills');
      await expect(access(skillsDir)).resolves.toBeUndefined();
    });

    it('should write a manifest file after workspace creation', async () => {
      manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
      const agentId = 'agent-manifest-test';
      const skills = [createTestSkill({ id: 'skill-1', hashId: 'hash-1' })];

      await manager.ensureWorkspace(agentId, skills);

      const manifestPath = join(baseDir, agentId, '.workspace-manifest.json');
      const manifestContent = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.agentId).toBe(agentId);
      expect(manifest.skills).toHaveLength(1);
      expect(manifest.skills[0].id).toBe('skill-1');
      expect(manifest.skills[0].hashId).toBe('hash-1');
      expect(manifest.createdAt).toBeDefined();
      expect(manifest.updatedAt).toBeDefined();
    });

    it('should reuse workspace when skills have not changed', async () => {
      const mockS3 = createMockS3Client();
      manager = new WorkspaceManager(baseDir, mockS3 as never);
      const agentId = 'agent-reuse-test';
      const skills = [createTestSkill({ id: 'skill-1', hashId: 'hash-1' })];

      // First call creates workspace
      await manager.ensureWorkspace(agentId, skills);
      const firstCallCount = mockS3.send.mock.calls.length;

      // Second call with same skills should reuse
      await manager.ensureWorkspace(agentId, skills);
      const secondCallCount = mockS3.send.mock.calls.length;

      // No additional S3 calls should have been made
      expect(secondCallCount).toBe(firstCallCount);
    });

    it('should re-download when skills have changed', async () => {
      const mockS3 = createMockS3Client();
      manager = new WorkspaceManager(baseDir, mockS3 as never);
      const agentId = 'agent-change-test';

      const skills1 = [createTestSkill({ id: 'skill-1', hashId: 'hash-1' })];
      const skills2 = [createTestSkill({ id: 'skill-2', hashId: 'hash-2' })];

      // First call
      await manager.ensureWorkspace(agentId, skills1);
      const firstCallCount = mockS3.send.mock.calls.length;

      // Second call with different skills should re-download
      await manager.ensureWorkspace(agentId, skills2);
      const secondCallCount = mockS3.send.mock.calls.length;

      // Additional S3 calls should have been made for the new skill
      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });

    it('should re-download when a skill hashId changes', async () => {
      const mockS3 = createMockS3Client();
      manager = new WorkspaceManager(baseDir, mockS3 as never);
      const agentId = 'agent-hash-change-test';

      const skills1 = [createTestSkill({ id: 'skill-1', hashId: 'hash-v1' })];
      const skills2 = [createTestSkill({ id: 'skill-1', hashId: 'hash-v2' })];

      await manager.ensureWorkspace(agentId, skills1);
      const firstCallCount = mockS3.send.mock.calls.length;

      await manager.ensureWorkspace(agentId, skills2);
      const secondCallCount = mockS3.send.mock.calls.length;

      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });

    it('should handle empty skills array', async () => {
      manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
      const agentId = 'agent-no-skills';

      const workspacePath = await manager.ensureWorkspace(agentId, []);

      expect(workspacePath).toBe(join(baseDir, agentId));
      const skillsDir = join(baseDir, agentId, '.claude', 'skills');
      await expect(access(skillsDir)).resolves.toBeUndefined();
    });

    it('should continue with remaining skills when one download fails', async () => {
      // Set up S3 mock where first skill fails but second succeeds
      const responses = new Map<string, Buffer | Error>();
      responses.set(
        'test-bucket/skills/hash-fail/skill.zip',
        new Error('S3 access denied'),
      );
      // Second skill will also fail (no zip extraction in test), but the point is
      // that ensureWorkspace doesn't throw
      const mockS3 = createMockS3Client(responses);
      manager = new WorkspaceManager(baseDir, mockS3 as never);

      const agentId = 'agent-partial-fail';
      const skills = [
        createTestSkill({ id: 'skill-fail', name: 'failing-skill', s3Prefix: 'skills/hash-fail/' }),
        createTestSkill({ id: 'skill-ok', name: 'ok-skill', s3Prefix: 'skills/hash-ok/' }),
      ];

      // Should not throw even though downloads fail
      const workspacePath = await manager.ensureWorkspace(agentId, skills);
      expect(workspacePath).toBe(join(baseDir, agentId));
    });
  });

  describe('downloadSkill', () => {
    it('should return false when S3 returns no body', async () => {
      const mockS3 = {
        send: vi.fn(async () => ({ Body: null })),
      };
      manager = new WorkspaceManager(baseDir, mockS3 as never);

      const skill = createTestSkill();
      const targetDir = join(baseDir, 'test-skills');
      await mkdir(targetDir, { recursive: true });

      const result = await manager.downloadSkill(skill, targetDir);
      expect(result).toBe(false);
    });

    it('should return false when S3 throws an error', async () => {
      const mockS3 = {
        send: vi.fn(async () => {
          throw new Error('Access Denied');
        }),
      };
      manager = new WorkspaceManager(baseDir, mockS3 as never);

      const skill = createTestSkill();
      const targetDir = join(baseDir, 'test-skills');
      await mkdir(targetDir, { recursive: true });

      const result = await manager.downloadSkill(skill, targetDir);
      expect(result).toBe(false);
    });

    it('should construct the correct S3 key from skill prefix', async () => {
      const mockS3 = {
        send: vi.fn(async () => {
          throw new Error('Expected call');
        }),
      };
      manager = new WorkspaceManager(baseDir, mockS3 as never);

      const skill = createTestSkill({ s3Bucket: 'my-bucket', s3Prefix: 'skills/myhash/' });
      const targetDir = join(baseDir, 'test-skills');
      await mkdir(targetDir, { recursive: true });

      await manager.downloadSkill(skill, targetDir);

      // Verify the S3 command was called with correct bucket and key
      expect(mockS3.send).toHaveBeenCalledTimes(1);
      const command = mockS3.send.mock.calls[0]![0] as { input: { Bucket: string; Key: string } };
      expect(command.input.Bucket).toBe('my-bucket');
      expect(command.input.Key).toBe('skills/myhash/skill.zip');
    });
  });

  describe('deleteWorkspace', () => {
    it('should remove the workspace directory', async () => {
      manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
      const agentId = 'agent-delete-test';

      // Create workspace first
      await manager.ensureWorkspace(agentId, []);
      const workspacePath = manager.getWorkspacePath(agentId);
      await expect(access(workspacePath)).resolves.toBeUndefined();

      // Delete it
      await manager.deleteWorkspace(agentId);

      // Verify it's gone
      await expect(access(workspacePath)).rejects.toThrow();
    });

    it('should not throw when workspace does not exist', async () => {
      manager = new WorkspaceManager(baseDir, createMockS3Client() as never);

      // Should not throw
      await expect(
        manager.deleteWorkspace('non-existent-agent'),
      ).resolves.toBeUndefined();
    });

    it('should handle deletion of already-deleted workspace', async () => {
      manager = new WorkspaceManager(baseDir, createMockS3Client() as never);
      const agentId = 'agent-double-delete';

      await manager.ensureWorkspace(agentId, []);
      await manager.deleteWorkspace(agentId);

      // Second delete should not throw
      await expect(manager.deleteWorkspace(agentId)).resolves.toBeUndefined();
    });
  });

  describe('workspace reuse manifest logic', () => {
    it('should not reuse workspace when manifest is missing', async () => {
      const mockS3 = createMockS3Client();
      manager = new WorkspaceManager(baseDir, mockS3 as never);
      const agentId = 'agent-no-manifest';

      // Create workspace directory without manifest
      const workspacePath = join(baseDir, agentId);
      const skillsDir = join(workspacePath, '.claude', 'skills');
      await mkdir(skillsDir, { recursive: true });

      // ensureWorkspace should still proceed (not reuse)
      const result = await manager.ensureWorkspace(agentId, []);
      expect(result).toBe(workspacePath);

      // Manifest should now exist
      const manifestPath = join(workspacePath, '.workspace-manifest.json');
      await expect(access(manifestPath)).resolves.toBeUndefined();
    });

    it('should not reuse workspace when manifest is corrupted', async () => {
      const mockS3 = createMockS3Client();
      manager = new WorkspaceManager(baseDir, mockS3 as never);
      const agentId = 'agent-corrupt-manifest';

      // Create workspace with corrupted manifest
      const workspacePath = join(baseDir, agentId);
      await mkdir(workspacePath, { recursive: true });
      await writeFile(
        join(workspacePath, '.workspace-manifest.json'),
        'not valid json{{{',
        'utf-8',
      );

      // Should proceed without error
      const result = await manager.ensureWorkspace(agentId, []);
      expect(result).toBe(workspacePath);
    });

    it('should track skill order independently in manifest comparison', async () => {
      const mockS3 = createMockS3Client();
      manager = new WorkspaceManager(baseDir, mockS3 as never);
      const agentId = 'agent-order-test';

      const skillA = createTestSkill({ id: 'skill-a', hashId: 'hash-a' });
      const skillB = createTestSkill({ id: 'skill-b', hashId: 'hash-b' });

      // Create with [A, B]
      await manager.ensureWorkspace(agentId, [skillA, skillB]);
      const firstCallCount = mockS3.send.mock.calls.length;

      // Reuse with [B, A] — same set, different order
      await manager.ensureWorkspace(agentId, [skillB, skillA]);
      const secondCallCount = mockS3.send.mock.calls.length;

      // Should reuse (no additional S3 calls)
      expect(secondCallCount).toBe(firstCallCount);
    });
  });
});
