/**
 * Property-based tests for Claude Agent Service
 *
 * Feature: claude-agent-sdk-chat
 * Property 1: buildOptions produces correct ClaudeCodeOptions
 * Property 4: SDK message formatting preserves all content block fields
 * Property 5: ResultMessage formatting includes required metadata
 * Property 8: MCP server config transformation
 * Property 9: Inactive MCP servers are excluded
 * Validates: Requirements 1.1, 1.3, 2.2, 2.3, 2.4, 2.5, 4.3, 5.2, 5.3, 6.4
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ClaudeAgentService,
  transformMCPServers,
  type AgentConfig,
  type MCPServerRecord,
  type MCPServerSDKConfig,
  type SDKAssistantMessage,
  type SDKResultMessage,
  type QueryFactory,
} from '../../src/services/claude-agent.service.js';
import { WorkspaceManager } from '../../src/services/workspace-manager.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockWorkspaceManager(): WorkspaceManager {
  return {
    ensureWorkspace: async () => '/tmp/workspaces/agent-001',
    getWorkspacePath: () => '/tmp/workspaces/agent-001',
    getSkillsDir: () => '/tmp/workspaces/agent-001/.claude/skills',
    deleteWorkspace: async () => undefined,
    downloadSkill: async () => true,
  } as unknown as WorkspaceManager;
}

function createMockQueryFactory(): QueryFactory {
  return (args) => {
    const gen = (async function* () { /* empty */ })() as any;
    gen.interrupt = () => Promise.resolve();
    return gen;
  };
}

function createService(): ClaudeAgentService {
  return new ClaudeAgentService(createMockWorkspaceManager(), createMockQueryFactory());
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const idArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,40}$/);
const systemPromptArb = fc.oneof(fc.string({ minLength: 1, maxLength: 200 }), fc.constant(null));

const agentConfigArb = fc.record({
  id: idArb,
  name: idArb,
  displayName: fc.string({ minLength: 1, maxLength: 60 }),
  systemPrompt: systemPromptArb,
  organizationId: idArb,
  skillIds: fc.array(idArb, { maxLength: 10 }),
  mcpServerIds: fc.array(idArb, { maxLength: 10 }),
});

const workspacePathArb = fc.array(idArb, { minLength: 1, maxLength: 5 }).map((parts) => '/' + parts.join('/'));
const skillNamesArb = fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]{1,30}$/), { maxLength: 10 });
const resumeSessionIdArb = fc.option(idArb, { nil: undefined });

const mcpServersSDKArb = fc.dictionary(
  idArb,
  fc.oneof(
    fc.record({ type: fc.constant('sse' as const), url: fc.webUrl() }),
    fc.record({
      type: fc.constant('stdio' as const),
      command: fc.constantFrom('node', 'npx', 'python3', 'my-server'),
      args: fc.option(fc.array(fc.stringMatching(/^[a-zA-Z0-9._/-]{1,20}$/), { minLength: 1, maxLength: 5 }), { nil: undefined }),
    }),
  ),
) as fc.Arbitrary<Record<string, MCPServerSDKConfig>>;

// Content block arbitraries for SDK assistant messages
type SDKContentItem = SDKAssistantMessage['message']['content'][number];

const textBlockArb: fc.Arbitrary<SDKContentItem> = fc.string({ minLength: 0, maxLength: 200 }).map((text) => ({ type: 'text', text }));

const toolUseBlockArb: fc.Arbitrary<SDKContentItem> = fc.record({
  type: fc.constant('tool_use'),
  id: idArb,
  name: fc.constantFrom('Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'CustomTool'),
  input: fc.dictionary(fc.stringMatching(/^[a-zA-Z_]{1,20}$/), fc.oneof(fc.string(), fc.integer(), fc.boolean())) as fc.Arbitrary<Record<string, unknown>>,
});

const contentBlocksArb = fc.array(fc.oneof(textBlockArb, toolUseBlockArb), { minLength: 1, maxLength: 8 });

/** Generates an SDKAssistantMessage with random content blocks. */
const assistantMessageArb: fc.Arbitrary<SDKAssistantMessage> = fc.record({
  type: fc.constant('assistant' as const),
  uuid: idArb,
  session_id: idArb,
  message: fc.record({
    content: contentBlocksArb,
    model: fc.option(fc.constantFrom('claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'custom-model'), { nil: undefined }),
  }),
  parent_tool_use_id: fc.constant(null),
});

/** Generates an SDKResultMessage with random metadata. */
const resultMessageArb: fc.Arbitrary<SDKResultMessage> = fc.record({
  type: fc.constant('result' as const),
  subtype: fc.constant('success'),
  uuid: idArb,
  session_id: idArb,
  duration_ms: fc.nat({ max: 600000 }),
  num_turns: fc.nat({ max: 100 }),
  is_error: fc.constant(false),
});

// MCP server record arbitraries
const httpHostAddressArb = fc.webUrl();
const stdioHostAddressArb = fc.record({
  command: fc.constantFrom('node', 'npx', 'python3', 'my-server', '/usr/bin/tool'),
  args: fc.array(fc.stringMatching(/^[a-zA-Z0-9._/-]{1,20}$/), { maxLength: 4 }),
}).map(({ command, args }) => args.length > 0 ? `${command} ${args.join(' ')}` : command);

const hostAddressArb = fc.oneof(httpHostAddressArb, stdioHostAddressArb);

const mcpServerRecordArb = (statusArb: fc.Arbitrary<string> = fc.constantFrom('active', 'inactive', 'disabled')): fc.Arbitrary<MCPServerRecord> =>
  fc.record({
    id: idArb, organization_id: idArb, name: idArb,
    description: fc.oneof(fc.string({ maxLength: 100 }), fc.constant(null)),
    host_address: hostAddressArb, status: statusArb, headers: fc.constant({}),
  });

const activeMCPServerRecordArb = mcpServerRecordArb(fc.constant('active'));
const inactiveMCPServerRecordArb = mcpServerRecordArb(fc.constantFrom('inactive', 'disabled', 'paused'));


// ---------------------------------------------------------------------------
// Property 1: buildOptions produces correct ClaudeCodeOptions
// ---------------------------------------------------------------------------

describe('Property 1: buildOptions produces correct ClaudeCodeOptions', () => {
  const service = createService();

  it('(a) systemPrompt matches the agent system prompt', () => {
    fc.assert(fc.property(agentConfigArb, workspacePathArb, skillNamesArb, mcpServersSDKArb, resumeSessionIdArb,
      (agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId) => {
        const opts = service.buildOptions(agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId);
        if (agentConfig.systemPrompt !== null) {
          expect(opts.systemPrompt).toBe(agentConfig.systemPrompt);
        } else {
          expect(opts.systemPrompt).toBeUndefined();
        }
      }), { numRuns: 200 });
  });

  it('(b) cwd points to the agent isolated workspace path', () => {
    fc.assert(fc.property(agentConfigArb, workspacePathArb, skillNamesArb, mcpServersSDKArb, resumeSessionIdArb,
      (agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId) => {
        const opts = service.buildOptions(agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId);
        expect(opts.cwd).toBe(workspacePath);
      }), { numRuns: 200 });
  });

  it('(c) resume equals the provided session ID when resuming or is undefined for new sessions', () => {
    fc.assert(fc.property(agentConfigArb, workspacePathArb, skillNamesArb, mcpServersSDKArb, resumeSessionIdArb,
      (agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId) => {
        const opts = service.buildOptions(agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId);
        if (resumeSessionId !== undefined) {
          expect(opts.resume).toBe(resumeSessionId);
        } else {
          expect(opts.resume).toBeUndefined();
        }
      }), { numRuns: 200 });
  });

  it('(d) allowedTools includes the expected default tool set', () => {
    const expectedTools = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch'];
    fc.assert(fc.property(agentConfigArb, workspacePathArb, skillNamesArb, mcpServersSDKArb, resumeSessionIdArb,
      (agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId) => {
        const opts = service.buildOptions(agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId);
        expect(opts.allowedTools).toBeDefined();
        for (const tool of expectedTools) {
          expect(opts.allowedTools).toContain(tool);
        }
      }), { numRuns: 200 });
  });

  it('hooks always include PreToolUse with dangerous command blocker', () => {
    fc.assert(fc.property(agentConfigArb, workspacePathArb, skillNamesArb, mcpServersSDKArb, resumeSessionIdArb,
      (agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId) => {
        const opts = service.buildOptions(agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId);
        expect(opts.hooks).toBeDefined();
        expect(opts.hooks!.PreToolUse).toBeDefined();
        expect(opts.hooks!.PreToolUse!.length).toBeGreaterThanOrEqual(1);
      }), { numRuns: 100 });
  });

  it('hooks include skill access checker when skills are present, omit when empty', () => {
    fc.assert(fc.property(agentConfigArb, workspacePathArb, skillNamesArb, mcpServersSDKArb, resumeSessionIdArb,
      (agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId) => {
        const opts = service.buildOptions(agentConfig, workspacePath, skillNames, mcpServers, resumeSessionId);
        if (skillNames.length > 0) {
          expect(opts.hooks!.PreToolUse!.length).toBe(2);
        } else {
          expect(opts.hooks!.PreToolUse!.length).toBe(1);
        }
      }), { numRuns: 200 });
  });
});

// ---------------------------------------------------------------------------
// Property 4: SDK message formatting preserves all content block fields
// ---------------------------------------------------------------------------

describe('Property 4: SDK message formatting preserves all content block fields', () => {
  const service = createService();

  it('should produce an assistant event preserving all content block fields', () => {
    fc.assert(fc.property(assistantMessageArb, idArb, (message, sessionId) => {
      const event = service.formatMessage(message, sessionId);
      expect(event).not.toBeNull();
      expect(event!.type).toBe('assistant');
      expect(event!.sessionId).toBe(sessionId);
      expect(event!.content).toBeDefined();
      expect(event!.content!.length).toBe(message.message.content.length);

      for (let i = 0; i < message.message.content.length; i++) {
        const srcBlock = message.message.content[i];
        const outBlock = event!.content![i];
        expect(outBlock.type).toBe(srcBlock.type);

        if (srcBlock.type === 'text' && outBlock.type === 'text') {
          expect(outBlock.text).toBe(srcBlock.text);
        } else if (srcBlock.type === 'tool_use' && outBlock.type === 'tool_use') {
          expect(outBlock.id).toBe(srcBlock.id);
          expect(outBlock.name).toBe(srcBlock.name);
          expect(outBlock.input).toEqual(srcBlock.input);
        }
      }
    }), { numRuns: 200 });
  });

  it('should preserve the model field from the SDKAssistantMessage', () => {
    fc.assert(fc.property(assistantMessageArb, idArb, (message, sessionId) => {
      const event = service.formatMessage(message, sessionId);
      expect(event!.model).toBe(message.message.model);
    }), { numRuns: 100 });
  });

  it('should produce exactly one output block per input block', () => {
    fc.assert(fc.property(assistantMessageArb, idArb, (message, sessionId) => {
      const event = service.formatMessage(message, sessionId);
      expect(event!.content!.length).toBe(message.message.content.length);
    }), { numRuns: 200 });
  });
});

// ---------------------------------------------------------------------------
// Property 5: ResultMessage formatting includes required metadata
// ---------------------------------------------------------------------------

describe('Property 5: ResultMessage formatting includes required metadata', () => {
  const service = createService();

  it('should produce a result event with sessionId, durationMs, and numTurns', () => {
    fc.assert(fc.property(resultMessageArb, fc.option(idArb, { nil: undefined }), (message, fallbackSessionId) => {
      const event = service.formatMessage(message, fallbackSessionId);
      expect(event).not.toBeNull();
      expect(event!.type).toBe('result');
      expect(event!.sessionId).toBe(message.session_id ?? fallbackSessionId);
      expect(event!.durationMs).toBe(message.duration_ms);
      expect(event!.numTurns).toBe(message.num_turns);
    }), { numRuns: 200 });
  });

  it('durationMs should be a non-negative number', () => {
    fc.assert(fc.property(resultMessageArb, (message) => {
      const event = service.formatMessage(message);
      expect(event!.durationMs).toBeGreaterThanOrEqual(0);
    }), { numRuns: 100 });
  });

  it('numTurns should be a non-negative integer', () => {
    fc.assert(fc.property(resultMessageArb, (message) => {
      const event = service.formatMessage(message);
      expect(event!.numTurns).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(event!.numTurns)).toBe(true);
    }), { numRuns: 100 });
  });
});

// ---------------------------------------------------------------------------
// Property 8: MCP server config transformation
// ---------------------------------------------------------------------------

describe('Property 8: MCP server config transformation', () => {
  it('should produce a name-keyed object with correct type and connection fields for active servers', () => {
    fc.assert(fc.property(fc.array(activeMCPServerRecordArb, { minLength: 1, maxLength: 10 }), (servers) => {
      const uniqueServers = servers.filter((s, i, arr) => arr.findIndex((x) => x.name === s.name) === i);
      const result = transformMCPServers(uniqueServers);

      for (const server of uniqueServers) {
        const sdkConfig = result[server.name];
        expect(sdkConfig).toBeDefined();
        const address = server.host_address.trim();
        if (address.startsWith('http://') || address.startsWith('https://')) {
          expect(sdkConfig.type).toBe('sse');
          expect(sdkConfig.url).toBe(address);
        } else {
          expect(sdkConfig.type).toBe('stdio');
          const parts = address.split(/\s+/);
          expect(sdkConfig.command).toBe(parts[0]);
          if (parts.length > 1) expect(sdkConfig.args).toEqual(parts.slice(1));
        }
      }
    }), { numRuns: 200 });
  });

  it('should produce one entry per unique active server name', () => {
    fc.assert(fc.property(fc.array(activeMCPServerRecordArb, { minLength: 0, maxLength: 10 }), (servers) => {
      const uniqueServers = servers.filter((s, i, arr) => arr.findIndex((x) => x.name === s.name) === i);
      const result = transformMCPServers(uniqueServers);
      expect(Object.keys(result).length).toBe(uniqueServers.length);
    }), { numRuns: 100 });
  });

  it('should return an empty object for an empty server list', () => {
    expect(transformMCPServers([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Property 9: Inactive MCP servers are excluded
// ---------------------------------------------------------------------------

describe('Property 9: Inactive MCP servers are excluded', () => {
  it('should contain only servers with status "active"', () => {
    fc.assert(fc.property(fc.array(mcpServerRecordArb(), { minLength: 1, maxLength: 15 }), (servers) => {
      const result = transformMCPServers(servers);
      for (const name of Object.keys(result)) {
        const matchingServer = servers.find((s) => s.name === name && s.status === 'active');
        expect(matchingServer).toBeDefined();
      }
    }), { numRuns: 200 });
  });

  it('output count should be less than or equal to input count', () => {
    fc.assert(fc.property(fc.array(mcpServerRecordArb(), { minLength: 0, maxLength: 15 }), (servers) => {
      const result = transformMCPServers(servers);
      expect(Object.keys(result).length).toBeLessThanOrEqual(servers.length);
    }), { numRuns: 200 });
  });

  it('should exclude all servers when none are active', () => {
    fc.assert(fc.property(fc.array(inactiveMCPServerRecordArb, { minLength: 1, maxLength: 10 }), (servers) => {
      const result = transformMCPServers(servers);
      expect(Object.keys(result).length).toBe(0);
    }), { numRuns: 100 });
  });

  it('should include all servers when all are active (with unique names)', () => {
    fc.assert(fc.property(
      fc.uniqueArray(activeMCPServerRecordArb, { minLength: 1, maxLength: 10, comparator: (a, b) => a.name === b.name }),
      (servers) => {
        const result = transformMCPServers(servers);
        expect(Object.keys(result).length).toBe(servers.length);
      }), { numRuns: 100 });
  });
});
