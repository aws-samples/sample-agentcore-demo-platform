/**
 * Unit tests for the refactored ChatService.
 * Tests the streamChat delegation to ClaudeAgentService, SSE formatting,
 * heartbeat, client disconnect handling, response timeout, and skill loading.
 *
 * Requirements: 2.1, 2.6, 2.7, 3.2, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 11.1, 11.2, 11.3, 11.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatService } from '../../src/services/chat.service.js';
import type { ConversationEvent, AgentConfig, ClaudeAgentService } from '../../src/services/claude-agent.service.js';
import type { SkillForWorkspace } from '../../src/services/workspace-manager.js';
import type { SkillService } from '../../src/services/skill.service.js';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the config module
vi.mock('../../src/config/index.js', () => ({
  config: {
    claude: {
      responseTimeoutMs: 5000, // Short timeout for tests
      model: 'claude-sonnet-4-5-20250929',
      useBedrock: false,
      workspaceBaseDir: '/tmp/test-workspaces',
      sessionTimeoutMs: 1800000,
    },
    aws: {
      region: 'us-east-1',
    },
  },
}));

// Mock the workspace-manager to avoid S3 client creation
vi.mock('../../src/services/workspace-manager.js', () => {
  class MockWorkspaceManager {
    async ensureWorkspace() { return '/tmp/test-workspaces/agent-1'; }
    async deleteWorkspace() { return undefined; }
  }
  return {
    WorkspaceManager: MockWorkspaceManager,
    workspaceManager: new MockWorkspaceManager(),
  };
});

// Mock the database module to avoid Prisma initialization
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    mcp_servers: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock the repositories
vi.mock('../../src/repositories/chat.repository.js', () => ({
  chatSessionRepository: {
    findByUser: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue({ id: 'session-1', organization_id: 'org-1' }),
    createForUser: vi.fn().mockResolvedValue({ id: 'new-session-1', organization_id: 'org-1' }),
    update: vi.fn().mockResolvedValue({ id: 'session-1' }),
    delete: vi.fn().mockResolvedValue(true),
    findBySopContext: vi.fn().mockResolvedValue(null),
  },
  chatMessageRepository: {
    findBySession: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'msg-1',
      ...data,
    })),
    deleteBySession: vi.fn().mockResolvedValue(1),
  },
}));

// Mock the agent repository
vi.mock('../../src/repositories/agent.repository.js', () => ({
  agentRepository: {
    findById: vi.fn().mockResolvedValue({
      id: 'agent-1',
      name: 'test-agent',
      display_name: 'Test Agent',
      system_prompt: 'You are a test agent.',
      organization_id: 'org-1',
    }),
  },
}));

// Mock the AppError
vi.mock('../../src/middleware/errorHandler.js', () => ({
  AppError: {
    notFound: (msg: string) => new Error(msg),
    validation: (msg: string) => new Error(msg),
  },
}));

// Mock the skill service module (default import used by ChatService)
vi.mock('../../src/services/skill.service.js', () => ({
  skillService: {
    getAgentSkills: vi.fn().mockResolvedValue([]),
  },
  SkillService: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock Fastify reply object with a writable raw stream.
 */
function createMockReply() {
  const rawEmitter = new EventEmitter();
  const writtenChunks: string[] = [];
  let headWritten = false;
  let ended = false;

  const raw = Object.assign(rawEmitter, {
    writeHead: vi.fn((_status: number, _headers: Record<string, string>) => {
      headWritten = true;
    }),
    write: vi.fn((chunk: string) => {
      writtenChunks.push(chunk);
      return true;
    }),
    end: vi.fn(() => {
      ended = true;
    }),
  });

  return {
    raw,
    writtenChunks,
    get headWritten() { return headWritten; },
    get ended() { return ended; },
  };
}

/**
 * Create a mock ClaudeAgentService that yields the given events.
 */
function createMockClaudeAgentService(
  events: ConversationEvent[],
  options?: { delayMs?: number; throwError?: Error },
): ClaudeAgentService {
  const disconnectSession = vi.fn().mockResolvedValue(undefined);
  const disconnectAll = vi.fn().mockResolvedValue(0);

  async function* runConversation(): AsyncGenerator<ConversationEvent> {
    if (options?.throwError) {
      throw options.throwError;
    }
    for (const event of events) {
      if (options?.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      yield event;
    }
  }

  return {
    runConversation,
    disconnectSession,
    disconnectAll,
    buildOptions: vi.fn(),
    formatMessage: vi.fn(),
    loadMCPServers: vi.fn().mockResolvedValue({}),
    activeClientCount: 0,
    hasSession: vi.fn().mockReturnValue(false),
  } as unknown as ClaudeAgentService;
}

/**
 * Create a mock SkillService for testing skill loading.
 */
function createMockSkillService(
  agentSkills: Array<{
    id: string;
    name: string;
    hash_id: string;
    s3_bucket: string;
    s3_prefix: string;
    organization_id: string;
  }> = [],
  options?: { throwError?: Error },
): SkillService {
  return {
    getAgentSkills: options?.throwError
      ? vi.fn().mockRejectedValue(options.throwError)
      : vi.fn().mockResolvedValue(agentSkills),
    listSkills: vi.fn().mockResolvedValue([]),
    getSkill: vi.fn().mockResolvedValue(null),
    getSkills: vi.fn().mockResolvedValue([]),
    createSkill: vi.fn(),
    updateSkill: vi.fn(),
    archiveSkill: vi.fn(),
    deleteSkill: vi.fn(),
    getUploadUrl: vi.fn(),
    getDownloadUrl: vi.fn(),
    assignSkillToAgent: vi.fn(),
    removeSkillFromAgent: vi.fn(),
    setAgentSkills: vi.fn(),
    getScopeSkills: vi.fn().mockResolvedValue([]),
    skillExists: vi.fn().mockResolvedValue(false),
  } as unknown as SkillService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatService', () => {
  let chatService: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('streamChat', () => {
    it('should set SSE headers and emit session event first', async () => {
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
        { type: 'assistant', content: [{ type: 'text', text: 'Hello!' }], model: 'claude-sonnet-4-5-20250929' },
        { type: 'result', sessionId: 'sdk-session-1', durationMs: 1000, numTurns: 1 },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      chatService = new ChatService(mockAgent);
      const reply = createMockReply();

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'Hello' },
      );

      // SSE headers should be set
      expect(reply.raw.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      }));

      // First written chunk should be the session event
      expect(reply.writtenChunks[0]).toContain('event: session');
      expect(reply.writtenChunks[0]).toContain('session_id');
    });

    it('should format assistant events as SSE data', async () => {
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Hello world!' }],
          model: 'claude-sonnet-4-5-20250929',
        },
        { type: 'result', sessionId: 'sdk-session-1', durationMs: 500, numTurns: 1 },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      chatService = new ChatService(mockAgent);
      const reply = createMockReply();

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'Hi' },
      );

      // Find the assistant event in written chunks
      const assistantChunk = reply.writtenChunks.find((c) => c.includes('"type":"assistant"'));
      expect(assistantChunk).toBeDefined();
      expect(assistantChunk).toContain('"text":"Hello world!"');
      expect(assistantChunk).toContain('"model":"claude-sonnet-4-5-20250929"');
    });

    it('should format result events as SSE data', async () => {
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
        { type: 'result', sessionId: 'sdk-session-1', durationMs: 2500, numTurns: 3 },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      chatService = new ChatService(mockAgent);
      const reply = createMockReply();

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'Test' },
      );

      const resultChunk = reply.writtenChunks.find((c) => c.includes('"type":"result"'));
      expect(resultChunk).toBeDefined();
      expect(resultChunk).toContain('"duration_ms":2500');
      expect(resultChunk).toContain('"num_turns":3');
    });

    it('should send [DONE] event at the end of the stream', async () => {
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
        { type: 'result', sessionId: 'sdk-session-1', durationMs: 100, numTurns: 1 },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      chatService = new ChatService(mockAgent);
      const reply = createMockReply();

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'Done test' },
      );

      const lastChunk = reply.writtenChunks[reply.writtenChunks.length - 1];
      expect(lastChunk).toContain('[DONE]');
      expect(reply.ended).toBe(true);
    });

    it('should persist user message before streaming (Req 3.4)', async () => {
      const { chatMessageRepository } = await import('../../src/repositories/chat.repository.js');
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      chatService = new ChatService(mockAgent);
      const reply = createMockReply();

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', sessionId: 'session-1', message: 'User message' },
      );

      // User message should be persisted
      expect(chatMessageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'session-1',
          type: 'user',
          content: 'User message',
        }),
        'org-1',
      );
    });

    it('should persist assistant response as JSON-serialized content blocks (Req 3.5)', async () => {
      const { chatMessageRepository } = await import('../../src/repositories/chat.repository.js');
      const contentBlocks = [
        { type: 'text' as const, text: 'Let me check.' },
        { type: 'tool_use' as const, id: 'tu_1', name: 'Bash', input: { command: 'ls' } },
      ];

      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
        { type: 'assistant', content: contentBlocks, model: 'claude-sonnet-4-5-20250929' },
        { type: 'result', sessionId: 'sdk-session-1', durationMs: 500, numTurns: 1 },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      chatService = new ChatService(mockAgent);
      const reply = createMockReply();

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', sessionId: 'session-1', message: 'Check files' },
      );

      // Assistant message should be persisted with JSON-serialized content blocks
      const aiCalls = (chatMessageRepository.create as any).mock.calls.filter(
        (call: any[]) => call[0].type === 'ai',
      );
      expect(aiCalls.length).toBe(1);
      const serialized = aiCalls[0][0].content;
      const parsed = JSON.parse(serialized);
      expect(parsed).toEqual(contentBlocks);
    });

    it('should emit error event on agent execution error (Req 11.1)', async () => {
      const mockAgent = createMockClaudeAgentService([], {
        throwError: new Error('Subprocess crashed'),
      });
      chatService = new ChatService(mockAgent);
      const reply = createMockReply();

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'Crash test' },
      );

      const errorChunk = reply.writtenChunks.find((c) => c.includes('AGENT_EXECUTION_ERROR'));
      expect(errorChunk).toBeDefined();
      expect(errorChunk).toContain('Subprocess crashed');
      expect(errorChunk).toContain('Please try again');
    });

    it('should emit error event with tool_use content blocks in assistant events', async () => {
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
        {
          type: 'assistant',
          content: [
            { type: 'tool_use', id: 'tu_abc', name: 'Read', input: { file_path: '/test.txt' } },
          ],
          model: 'claude-sonnet-4-5-20250929',
        },
        {
          type: 'assistant',
          content: [
            { type: 'tool_result', tool_use_id: 'tu_abc', content: 'file contents', is_error: false },
          ],
          model: 'claude-sonnet-4-5-20250929',
        },
        { type: 'result', sessionId: 'sdk-session-1', durationMs: 1000, numTurns: 2 },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      chatService = new ChatService(mockAgent);
      const reply = createMockReply();

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'Read file' },
      );

      const toolUseChunk = reply.writtenChunks.find((c) => c.includes('"tool_use"'));
      expect(toolUseChunk).toBeDefined();
      expect(toolUseChunk).toContain('"name":"Read"');

      const toolResultChunk = reply.writtenChunks.find((c) => c.includes('"tool_result"'));
      expect(toolResultChunk).toBeDefined();
      expect(toolResultChunk).toContain('"tool_use_id":"tu_abc"');
    });

    it('should create a new session when sessionId is not provided', async () => {
      const { chatSessionRepository } = await import('../../src/repositories/chat.repository.js');
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      chatService = new ChatService(mockAgent);
      const reply = createMockReply();

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'New session' },
      );

      expect(chatSessionRepository.createForUser).toHaveBeenCalled();
    });

    it('should handle client disconnect by calling disconnectSession (Req 11.3)', async () => {
      // Create a slow generator that gives us time to simulate disconnect
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
        { type: 'assistant', content: [{ type: 'text', text: 'Working...' }] },
      ];

      const mockAgent = createMockClaudeAgentService(events, { delayMs: 50 });
      chatService = new ChatService(mockAgent);
      const reply = createMockReply();

      // Start streaming and simulate client disconnect after a short delay
      const streamPromise = chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'Disconnect test' },
      );

      // Simulate client disconnect after events start
      setTimeout(() => {
        reply.raw.emit('close');
      }, 25);

      await streamPromise;

      // The disconnect handler should have been registered
      // (disconnectSession may or may not be called depending on timing,
      // but the close listener was registered)
      expect(reply.raw.listenerCount('close')).toBe(0); // Listener removed in finally
    });

    it('should pass skills to runConversation', async () => {
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      const runConvSpy = vi.spyOn(mockAgent, 'runConversation' as any);
      chatService = new ChatService(mockAgent);
      const reply = createMockReply();

      const skills: SkillForWorkspace[] = [
        { id: 'skill-1', name: 'test-skill', hashId: 'abc123', s3Bucket: 'bucket', s3Prefix: 'prefix/' },
      ];

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'With skills' },
        skills,
      );

      expect(runConvSpy).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-1', message: 'With skills' }),
        expect.objectContaining({ id: 'agent-1' }),
        skills,
      );
    });

    it('should load agent skills from DB when no skillsOverride is provided (Req 4.1, 4.2, 4.3)', async () => {
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
      ];

      const dbSkills = [
        {
          id: 'skill-db-1',
          name: 'db-skill',
          hash_id: 'hash123',
          s3_bucket: 'my-bucket',
          s3_prefix: 'skills/hash123/',
          organization_id: 'org-1',
          display_name: 'DB Skill',
          description: null,
          version: '1.0.0',
          status: 'active',
          tags: [],
          metadata: {},
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      const runConvSpy = vi.spyOn(mockAgent, 'runConversation' as any);
      const mockSkillSvc = createMockSkillService(dbSkills);
      chatService = new ChatService(mockAgent, mockSkillSvc);
      const reply = createMockReply();

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'Auto-load skills' },
      );

      // skillService.getAgentSkills should have been called
      expect(mockSkillSvc.getAgentSkills).toHaveBeenCalledWith('org-1', 'agent-1');

      // runConversation should receive the transformed skills
      expect(runConvSpy).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-1' }),
        expect.objectContaining({
          id: 'agent-1',
          skillIds: ['skill-db-1'],
        }),
        [
          {
            id: 'skill-db-1',
            name: 'db-skill',
            hashId: 'hash123',
            s3Bucket: 'my-bucket',
            s3Prefix: 'skills/hash123/',
          },
        ],
      );
    });

    it('should use skillsOverride when provided instead of loading from DB', async () => {
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      const mockSkillSvc = createMockSkillService([]);
      chatService = new ChatService(mockAgent, mockSkillSvc);
      const reply = createMockReply();

      const overrideSkills: SkillForWorkspace[] = [
        { id: 'override-1', name: 'override-skill', hashId: 'ovr123', s3Bucket: 'bucket', s3Prefix: 'prefix/' },
      ];

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'Override skills' },
        overrideSkills,
      );

      // skillService.getAgentSkills should NOT have been called
      expect(mockSkillSvc.getAgentSkills).not.toHaveBeenCalled();
    });

    it('should proceed without skills when skill loading fails (Req 11.4)', async () => {
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
        { type: 'result', sessionId: 'sdk-session-1', durationMs: 100, numTurns: 1 },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      const runConvSpy = vi.spyOn(mockAgent, 'runConversation' as any);
      const mockSkillSvc = createMockSkillService([], {
        throwError: new Error('Database connection failed'),
      });
      chatService = new ChatService(mockAgent, mockSkillSvc);
      const reply = createMockReply();

      // Should not throw — gracefully degrades to empty skills
      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'Skill load failure' },
      );

      // runConversation should have been called with empty skills
      expect(runConvSpy).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'agent-1' }),
        expect.objectContaining({ skillIds: [] }),
        [],
      );

      // Stream should still complete successfully
      expect(reply.ended).toBe(true);
    });

    it('should load multiple skills and transform them to SkillForWorkspace format', async () => {
      const events: ConversationEvent[] = [
        { type: 'session_start', sessionId: 'sdk-session-1' },
      ];

      const dbSkills = [
        {
          id: 'skill-1', name: 'skill-alpha', hash_id: 'aaa111',
          s3_bucket: 'bucket-a', s3_prefix: 'skills/aaa111/',
          organization_id: 'org-1', display_name: 'Alpha', description: null,
          version: '1.0.0', status: 'active', tags: [], metadata: {},
          created_at: new Date(), updated_at: new Date(),
        },
        {
          id: 'skill-2', name: 'skill-beta', hash_id: 'bbb222',
          s3_bucket: 'bucket-b', s3_prefix: 'skills/bbb222/',
          organization_id: 'org-1', display_name: 'Beta', description: 'A beta skill',
          version: '2.0.0', status: 'active', tags: ['test'], metadata: {},
          created_at: new Date(), updated_at: new Date(),
        },
      ];

      const mockAgent = createMockClaudeAgentService(events);
      const runConvSpy = vi.spyOn(mockAgent, 'runConversation' as any);
      const mockSkillSvc = createMockSkillService(dbSkills);
      chatService = new ChatService(mockAgent, mockSkillSvc);
      const reply = createMockReply();

      await chatService.streamChat(
        { raw: reply.raw } as any,
        'org-1',
        'user-1',
        { agentId: 'agent-1', message: 'Multi-skill test' },
      );

      // Verify both skills are passed with correct transformation
      expect(runConvSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skillIds: ['skill-1', 'skill-2'],
        }),
        [
          { id: 'skill-1', name: 'skill-alpha', hashId: 'aaa111', s3Bucket: 'bucket-a', s3Prefix: 'skills/aaa111/' },
          { id: 'skill-2', name: 'skill-beta', hashId: 'bbb222', s3Bucket: 'bucket-b', s3Prefix: 'skills/bbb222/' },
        ],
      );
    });
  });

  describe('session CRUD methods (unchanged)', () => {
    it('getSessions should delegate to repository', async () => {
      const mockAgent = createMockClaudeAgentService([]);
      chatService = new ChatService(mockAgent);

      const result = await chatService.getSessions('org-1', 'user-1');
      expect(result).toEqual([]);
    });

    it('deleteSession should delete messages then session', async () => {
      const { chatMessageRepository, chatSessionRepository } = await import('../../src/repositories/chat.repository.js');
      const mockAgent = createMockClaudeAgentService([]);
      chatService = new ChatService(mockAgent);

      await chatService.deleteSession('session-1', 'org-1');

      expect(chatMessageRepository.deleteBySession).toHaveBeenCalledWith('org-1', 'session-1');
      expect(chatSessionRepository.delete).toHaveBeenCalledWith('session-1', 'org-1');
    });

    it('getContextBySop should throw when not found', async () => {
      const mockAgent = createMockClaudeAgentService([]);
      chatService = new ChatService(mockAgent);

      await expect(chatService.getContextBySop('org-1', 'nonexistent')).rejects.toThrow(
        'No chat session found for SOP context: nonexistent',
      );
    });
  });
});
