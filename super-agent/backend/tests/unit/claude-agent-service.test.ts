import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ClaudeAgentService,
  transformMCPServers,
  parseMCPServerConfig,
  type AgentConfig,
  type MCPServerRecord,
  type MCPServerSDKConfig,
  type SDKMessage,
  type ClaudeCodeOptions,
  type ClaudeAgentServiceOptions,
  type ConversationEvent,
  type SDKAssistantMessage,
  type SDKResultMessage,
  type SDKSystemMessage,
  type QueryFactory,
} from '../../src/services/claude-agent.service.js';
import { WorkspaceManager } from '../../src/services/workspace-manager.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    id: 'agent-001',
    name: 'test-agent',
    displayName: 'Test Agent',
    systemPrompt: 'You are a helpful assistant.',
    organizationId: 'org-001',
    skillIds: [],
    mcpServerIds: [],
    ...overrides,
  };
}

function makeMCPServerRecord(overrides?: Partial<MCPServerRecord>): MCPServerRecord {
  return {
    id: 'mcp-001',
    organization_id: 'org-001',
    name: 'test-server',
    description: 'A test MCP server',
    host_address: 'https://mcp.example.com',
    status: 'active',
    headers: {},
    ...overrides,
  };
}

/**
 * Creates a mock QueryFactory that yields the given messages.
 * Captures the prompt and options for assertions.
 */
function createMockQueryFactory(
  messages: SDKMessage[],
  capturedCalls?: Array<{ prompt: string; options?: ClaudeCodeOptions }>,
): QueryFactory {
  return (args: { prompt: string; options?: ClaudeCodeOptions }) => {
    capturedCalls?.push(args);
    const gen = (async function* () {
      for (const msg of messages) {
        yield msg;
      }
    })() as any;
    gen.interrupt = vi.fn();
    return gen;
  };
}

function createMockWorkspaceManager(): WorkspaceManager {
  return {
    ensureWorkspace: vi.fn().mockResolvedValue('/tmp/workspaces/agent-001'),
    getWorkspacePath: vi.fn().mockReturnValue('/tmp/workspaces/agent-001'),
    getSkillsDir: vi.fn().mockReturnValue('/tmp/workspaces/agent-001/.claude/skills'),
    deleteWorkspace: vi.fn().mockResolvedValue(undefined),
    downloadSkill: vi.fn().mockResolvedValue(true),
  } as unknown as WorkspaceManager;
}

// Helper to make SDK-shaped assistant messages
function makeAssistantMsg(content: SDKAssistantMessage['message']['content'], model?: string): SDKAssistantMessage {
  return {
    type: 'assistant',
    uuid: 'uuid-1',
    session_id: 'sess-abc',
    message: { content, model },
    parent_tool_use_id: null,
  };
}

function makeSystemMsg(sessionId: string): SDKSystemMessage {
  return {
    type: 'system',
    subtype: 'init',
    session_id: sessionId,
    uuid: 'uuid-sys',
    model: 'claude-sonnet-4-5-20250929',
    tools: ['Bash', 'Read'],
    cwd: '/tmp',
  };
}

function makeResultMsg(sessionId: string, durationMs = 100, numTurns = 1): SDKResultMessage {
  return {
    type: 'result',
    subtype: 'success',
    uuid: 'uuid-res',
    session_id: sessionId,
    duration_ms: durationMs,
    num_turns: numTurns,
    is_error: false,
    result: 'done',
  };
}


// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('claude-agent.service', () => {
  // =========================================================================
  // buildOptions
  // =========================================================================
  describe('buildOptions', () => {
    let service: ClaudeAgentService;

    beforeEach(() => {
      service = new ClaudeAgentService(
        createMockWorkspaceManager(),
        createMockQueryFactory([]),
      );
    });

    it('should set systemPrompt from agent config', () => {
      const opts = service.buildOptions(makeAgentConfig({ systemPrompt: 'Be concise.' }), '/workspace', [], {});
      expect(opts.systemPrompt).toBe('Be concise.');
    });

    it('should leave systemPrompt undefined when agent has no prompt', () => {
      const opts = service.buildOptions(makeAgentConfig({ systemPrompt: null }), '/workspace', [], {});
      expect(opts.systemPrompt).toBeUndefined();
    });

    it('should set cwd to the workspace path', () => {
      const opts = service.buildOptions(makeAgentConfig(), '/my/workspace', [], {});
      expect(opts.cwd).toBe('/my/workspace');
    });

    it('should include default allowed tools', () => {
      const opts = service.buildOptions(makeAgentConfig(), '/workspace', [], {});
      expect(opts.allowedTools).toContain('Bash');
      expect(opts.allowedTools).toContain('Read');
      expect(opts.allowedTools).toContain('Write');
      expect(opts.allowedTools).toContain('Edit');
    });

    it('should set resume when resumeSessionId is provided', () => {
      const opts = service.buildOptions(makeAgentConfig(), '/workspace', [], {}, 'session-123');
      expect(opts.resume).toBe('session-123');
    });

    it('should not set resume for new sessions', () => {
      const opts = service.buildOptions(makeAgentConfig(), '/workspace', [], {});
      expect(opts.resume).toBeUndefined();
    });

    it('should set permissionMode to bypassPermissions', () => {
      const opts = service.buildOptions(makeAgentConfig(), '/workspace', [], {});
      expect(opts.permissionMode).toBe('bypassPermissions');
    });

    it('should include PreToolUse hooks with dangerous command blocker', () => {
      const opts = service.buildOptions(makeAgentConfig(), '/workspace', [], {});
      expect(opts.hooks?.PreToolUse).toBeDefined();
      expect(opts.hooks!.PreToolUse!.length).toBeGreaterThanOrEqual(1);
    });

    it('should include skill access checker when skills are present', () => {
      const opts = service.buildOptions(makeAgentConfig(), '/workspace', ['skill-a', 'skill-b'], {});
      expect(opts.hooks!.PreToolUse!.length).toBe(2);
    });

    it('should not include skill access checker when no skills', () => {
      const opts = service.buildOptions(makeAgentConfig(), '/workspace', [], {});
      expect(opts.hooks!.PreToolUse!.length).toBe(1);
    });

    it('should include MCP servers when provided', () => {
      const mcpServers: Record<string, MCPServerSDKConfig> = {
        'my-server': { type: 'sse', url: 'https://mcp.example.com' },
      };
      const opts = service.buildOptions(makeAgentConfig(), '/workspace', [], mcpServers);
      expect(opts.mcpServers).toEqual(mcpServers);
    });

    it('should not include mcpServers when empty', () => {
      const opts = service.buildOptions(makeAgentConfig(), '/workspace', [], {});
      expect(opts.mcpServers).toBeUndefined();
    });

    it('should set model from config', () => {
      const opts = service.buildOptions(makeAgentConfig(), '/workspace', [], {});
      expect(opts.model).toBeDefined();
      expect(typeof opts.model).toBe('string');
    });
  });

  // =========================================================================
  // formatMessage
  // =========================================================================
  describe('formatMessage', () => {
    let service: ClaudeAgentService;

    beforeEach(() => {
      service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory([]));
    });

    it('should format SDKAssistantMessage with text blocks', () => {
      const msg = makeAssistantMsg([{ type: 'text', text: 'Hello world' }], 'claude-sonnet-4-5-20250929');
      const event = service.formatMessage(msg, 'session-1');
      expect(event).not.toBeNull();
      expect(event!.type).toBe('assistant');
      expect(event!.sessionId).toBe('session-1');
      expect(event!.model).toBe('claude-sonnet-4-5-20250929');
      expect(event!.content).toHaveLength(1);
      expect(event!.content![0]).toEqual({ type: 'text', text: 'Hello world' });
    });

    it('should format SDKAssistantMessage with tool_use blocks', () => {
      const msg = makeAssistantMsg([{ type: 'tool_use', id: 'tu_123', name: 'Bash', input: { command: 'ls -la' } }]);
      const event = service.formatMessage(msg, 'session-1');
      expect(event!.content).toHaveLength(1);
      const block = event!.content![0];
      expect(block.type).toBe('tool_use');
      if (block.type === 'tool_use') {
        expect(block.id).toBe('tu_123');
        expect(block.name).toBe('Bash');
        expect(block.input).toEqual({ command: 'ls -la' });
      }
    });

    it('should format SDKAssistantMessage with mixed content blocks', () => {
      const msg = makeAssistantMsg([
        { type: 'text', text: 'Let me check.' },
        { type: 'tool_use', id: 'tu_1', name: 'Read', input: { file_path: '/a.txt' } },
        { type: 'text', text: 'Done.' },
      ]);
      const event = service.formatMessage(msg, 'session-1');
      expect(event!.content).toHaveLength(3);
      expect(event!.content![0].type).toBe('text');
      expect(event!.content![1].type).toBe('tool_use');
      expect(event!.content![2].type).toBe('text');
    });

    it('should format SDKResultMessage with metadata', () => {
      const msg = makeResultMsg('session-1', 5200, 3);
      const event = service.formatMessage(msg, 'session-1');
      expect(event).not.toBeNull();
      expect(event!.type).toBe('result');
      expect(event!.sessionId).toBe('session-1');
      expect(event!.durationMs).toBe(5200);
      expect(event!.numTurns).toBe(3);
    });

    it('should return null for system messages', () => {
      const msg = makeSystemMsg('session-1');
      const event = service.formatMessage(msg);
      expect(event).toBeNull();
    });

    it('should handle empty content array', () => {
      const msg = makeAssistantMsg([]);
      const event = service.formatMessage(msg, 'session-1');
      expect(event!.type).toBe('assistant');
      expect(event!.content).toEqual([]);
    });
  });

  // =========================================================================
  // runConversation
  // =========================================================================
  describe('runConversation', () => {
    it('should yield session_start as the first event', async () => {
      const messages: SDKMessage[] = [
        makeSystemMsg('sess-abc'),
        makeAssistantMsg([{ type: 'text', text: 'Hi' }]),
        makeResultMsg('sess-abc'),
      ];

      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory(messages));
      vi.spyOn(service, 'loadMCPServers').mockResolvedValue({});

      const events: ConversationEvent[] = [];
      for await (const event of service.runConversation(
        { agentId: 'agent-001', message: 'Hello', organizationId: 'org-001', userId: 'user-001' },
        makeAgentConfig(),
        [],
      )) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe('session_start');
      expect(events[0].sessionId).toBe('sess-abc');
    });

    it('should yield assistant and result events', async () => {
      const messages: SDKMessage[] = [
        makeSystemMsg('sess-abc'),
        makeAssistantMsg([{ type: 'text', text: 'Hello!' }], 'claude-sonnet-4-5-20250929'),
        makeResultMsg('sess-abc', 200, 1),
      ];

      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory(messages));
      vi.spyOn(service, 'loadMCPServers').mockResolvedValue({});

      const events: ConversationEvent[] = [];
      for await (const event of service.runConversation(
        { agentId: 'agent-001', message: 'Hello', organizationId: 'org-001', userId: 'user-001' },
        makeAgentConfig(),
        [],
      )) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0].type).toBe('session_start');
      expect(events[1].type).toBe('assistant');
      expect(events[1].content![0]).toEqual({ type: 'text', text: 'Hello!' });
      expect(events[2].type).toBe('result');
      expect(events[2].durationMs).toBe(200);
    });

    it('should pass the user message as prompt to query()', async () => {
      const capturedCalls: Array<{ prompt: string; options?: ClaudeCodeOptions }> = [];
      const messages: SDKMessage[] = [makeSystemMsg('sess-abc'), makeResultMsg('sess-abc')];

      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory(messages, capturedCalls));
      vi.spyOn(service, 'loadMCPServers').mockResolvedValue({});

      for await (const _event of service.runConversation(
        { agentId: 'agent-001', message: 'What is 2+2?', organizationId: 'org-001', userId: 'user-001' },
        makeAgentConfig(),
        [],
      )) { /* consume */ }

      expect(capturedCalls).toHaveLength(1);
      expect(capturedCalls[0].prompt).toBe('What is 2+2?');
    });

    it('should remove session from map after conversation completes', async () => {
      const messages: SDKMessage[] = [makeSystemMsg('sess-cleanup'), makeResultMsg('sess-cleanup')];
      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory(messages));
      vi.spyOn(service, 'loadMCPServers').mockResolvedValue({});

      for await (const _event of service.runConversation(
        { agentId: 'agent-001', message: 'test', organizationId: 'org-001', userId: 'user-001' },
        makeAgentConfig(),
        [],
      )) { /* consume */ }

      expect(service.hasSession('sess-cleanup')).toBe(false);
      expect(service.activeClientCount).toBe(0);
    });

    it('should yield error event when query factory throws', async () => {
      const service = new ClaudeAgentService(
        createMockWorkspaceManager(),
        () => { throw new Error('SDK not available'); },
      );
      vi.spyOn(service, 'loadMCPServers').mockResolvedValue({});

      const events: ConversationEvent[] = [];
      for await (const event of service.runConversation(
        { agentId: 'agent-001', message: 'test', organizationId: 'org-001', userId: 'user-001' },
        makeAgentConfig(),
        [],
      )) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
      expect(events[0].code).toBe('AGENT_EXECUTION_ERROR');
      expect(events[0].message).toContain('SDK not available');
    });

    it('should NOT pass DB session ID as SDK resume (DB IDs are not Claude session IDs)', async () => {
      const capturedCalls: Array<{ prompt: string; options?: ClaudeCodeOptions }> = [];
      const messages: SDKMessage[] = [makeSystemMsg('sess-resume'), makeResultMsg('sess-resume')];

      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory(messages, capturedCalls));
      vi.spyOn(service, 'loadMCPServers').mockResolvedValue({});

      for await (const _event of service.runConversation(
        { agentId: 'agent-001', sessionId: 'sess-resume', message: 'continue', organizationId: 'org-001', userId: 'user-001' },
        makeAgentConfig(),
        [],
      )) { /* consume */ }

      expect(capturedCalls[0].options!.resume).toBeUndefined();
    });
  });

  // =========================================================================
  // disconnectSession / disconnectAll
  // =========================================================================
  describe('disconnectSession', () => {
    it('should remove session from map', async () => {
      const messages: SDKMessage[] = [makeSystemMsg('sess-dc')];
      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory(messages));
      vi.spyOn(service, 'loadMCPServers').mockResolvedValue({});

      const gen = service.runConversation(
        { agentId: 'agent-001', message: 'test', organizationId: 'org-001', userId: 'user-001' },
        makeAgentConfig(),
        [],
      );

      const first = await gen.next();
      expect(first.value?.type).toBe('session_start');
      expect(service.hasSession('sess-dc')).toBe(true);

      await service.disconnectSession('sess-dc');
      expect(service.hasSession('sess-dc')).toBe(false);
    });

    it('should be a no-op for unknown session IDs', async () => {
      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory([]));
      await service.disconnectSession('nonexistent');
      expect(service.activeClientCount).toBe(0);
    });
  });

  describe('disconnectAll', () => {
    it('should return 0 when no active sessions', async () => {
      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory([]));
      const count = await service.disconnectAll();
      expect(count).toBe(0);
    });
  });

  // =========================================================================
  // transformMCPServers
  // =========================================================================
  describe('transformMCPServers', () => {
    it('should transform active HTTP/SSE servers', () => {
      const servers = [makeMCPServerRecord({ name: 'web-server', host_address: 'https://mcp.example.com/sse', status: 'active' })];
      const result = transformMCPServers(servers);
      expect(result['web-server']).toEqual({ type: 'sse', url: 'https://mcp.example.com/sse' });
    });

    it('should transform active stdio servers', () => {
      const servers = [makeMCPServerRecord({ name: 'local-tool', host_address: 'npx my-mcp-server --port 3001', status: 'active' })];
      const result = transformMCPServers(servers);
      expect(result['local-tool']).toEqual({ type: 'stdio', command: 'npx', args: ['my-mcp-server', '--port', '3001'] });
    });

    it('should exclude inactive servers', () => {
      const servers = [
        makeMCPServerRecord({ name: 'active-one', status: 'active' }),
        makeMCPServerRecord({ name: 'inactive-one', status: 'inactive' }),
        makeMCPServerRecord({ name: 'active-two', status: 'active', host_address: 'https://two.example.com' }),
      ];
      const result = transformMCPServers(servers);
      expect(Object.keys(result)).toHaveLength(2);
      expect(result['inactive-one']).toBeUndefined();
    });

    it('should return empty object for empty input', () => {
      expect(transformMCPServers([])).toEqual({});
    });
  });

  // =========================================================================
  // parseMCPServerConfig
  // =========================================================================
  describe('parseMCPServerConfig', () => {
    it('should parse HTTPS URL as SSE type', () => {
      expect(parseMCPServerConfig(makeMCPServerRecord({ host_address: 'https://mcp.example.com' }))).toEqual({ type: 'sse', url: 'https://mcp.example.com' });
    });

    it('should parse command string as stdio type', () => {
      expect(parseMCPServerConfig(makeMCPServerRecord({ host_address: 'node server.js' }))).toEqual({ type: 'stdio', command: 'node', args: ['server.js'] });
    });

    it('should parse single command without args', () => {
      const result = parseMCPServerConfig(makeMCPServerRecord({ host_address: 'my-server' }));
      expect(result).toEqual({ type: 'stdio', command: 'my-server' });
      expect(result!.args).toBeUndefined();
    });

    it('should return null for empty host_address', () => {
      expect(parseMCPServerConfig(makeMCPServerRecord({ host_address: '' }))).toBeNull();
    });

    it('should return null for whitespace-only host_address', () => {
      expect(parseMCPServerConfig(makeMCPServerRecord({ host_address: '   ' }))).toBeNull();
    });
  });

  // =========================================================================
  // Session Timeout and Cleanup
  // =========================================================================
  describe('session timeout and cleanup', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('should start and stop the cleanup timer', () => {
      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory([]));
      expect(service.isCleanupTimerRunning).toBe(false);
      service.startCleanupTimer();
      expect(service.isCleanupTimerRunning).toBe(true);
      service.stopCleanupTimer();
      expect(service.isCleanupTimerRunning).toBe(false);
    });

    it('should not start multiple timers', () => {
      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory([]));
      service.startCleanupTimer();
      service.startCleanupTimer();
      expect(service.isCleanupTimerRunning).toBe(true);
      service.stopCleanupTimer();
      expect(service.isCleanupTimerRunning).toBe(false);
    });

    it('should track last activity when a session starts', async () => {
      vi.useRealTimers();
      const messages: SDKMessage[] = [makeSystemMsg('sess-activity'), makeResultMsg('sess-activity')];
      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory(messages));
      vi.spyOn(service, 'loadMCPServers').mockResolvedValue({});

      const events: ConversationEvent[] = [];
      for await (const event of service.runConversation(
        { agentId: 'agent-001', message: 'test', organizationId: 'org-001', userId: 'user-001' },
        makeAgentConfig(),
        [],
      )) {
        events.push(event);
        if (event.type === 'session_start') {
          expect(service.getLastActivity('sess-activity')).toBeDefined();
        }
      }
      // After completion, cleaned up
      expect(service.getLastActivity('sess-activity')).toBeUndefined();
    });

    it('should disconnect timed-out sessions on triggerCleanup', async () => {
      vi.useRealTimers();
      const messages: SDKMessage[] = [makeSystemMsg('sess-timeout')];
      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory(messages));
      vi.spyOn(service, 'loadMCPServers').mockResolvedValue({});

      const gen = service.runConversation(
        { agentId: 'agent-001', message: 'test', organizationId: 'org-001', userId: 'user-001' },
        makeAgentConfig(),
        [],
      );
      await gen.next();
      expect(service.hasSession('sess-timeout')).toBe(true);

      // Set last activity far in the past
      (service as any).lastActivity.set('sess-timeout', Date.now() - 2_000_000);
      await service.triggerCleanup();

      expect(service.hasSession('sess-timeout')).toBe(false);
    });

    it('should not disconnect active sessions on triggerCleanup', async () => {
      vi.useRealTimers();
      const messages: SDKMessage[] = [makeSystemMsg('sess-active')];
      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory(messages));
      vi.spyOn(service, 'loadMCPServers').mockResolvedValue({});

      const gen = service.runConversation(
        { agentId: 'agent-001', message: 'test', organizationId: 'org-001', userId: 'user-001' },
        makeAgentConfig(),
        [],
      );
      await gen.next();
      await service.triggerCleanup();
      expect(service.hasSession('sess-active')).toBe(true);
    });

    it('should clear lastActivity and stop timer on disconnectAll', async () => {
      vi.useRealTimers();
      const messages: SDKMessage[] = [makeSystemMsg('sess-all')];
      const service = new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory(messages));
      vi.spyOn(service, 'loadMCPServers').mockResolvedValue({});

      service.startCleanupTimer();
      const gen = service.runConversation(
        { agentId: 'agent-001', message: 'test', organizationId: 'org-001', userId: 'user-001' },
        makeAgentConfig(),
        [],
      );
      await gen.next();

      const count = await service.disconnectAll();
      expect(count).toBe(1);
      expect(service.activeClientCount).toBe(0);
      expect(service.trackedSessionCount).toBe(0);
      expect(service.isCleanupTimerRunning).toBe(false);
    });
  });
});
