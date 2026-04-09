/**
 * Graceful Shutdown Tests
 *
 * Tests for the Fastify onClose hook that calls claudeAgentService.disconnectAll()
 * during server shutdown.
 *
 * Requirements: 10.1, 10.2, 10.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the claude-agent.service module BEFORE importing app.
// vi.hoisted ensures the variable is available when vi.mock factory runs.
const mocks = vi.hoisted(() => ({
  disconnectAll: vi.fn<() => Promise<number>>(),
  stopCleanupTimer: vi.fn(),
}));

vi.mock('../../src/services/claude-agent.service.js', () => {
  const mockService = {
    disconnectAll: mocks.disconnectAll,
    stopCleanupTimer: mocks.stopCleanupTimer,
    startCleanupTimer: vi.fn(),
    runConversation: vi.fn(),
    buildOptions: vi.fn(),
    formatMessage: vi.fn(),
    disconnectSession: vi.fn(),
    loadMCPServers: vi.fn(),
    activeClientCount: 0,
    hasSession: vi.fn(),
  };

  return {
    claudeAgentService: mockService,
    ClaudeAgentService: vi.fn(() => mockService),
    transformMCPServers: vi.fn(() => ({})),
    parseMCPServerConfig: vi.fn(),
  };
});

// Mock Prisma to avoid database connection
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    agents: { findMany: vi.fn().mockResolvedValue([]) },
    chat_sessions: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

// Mock Redis to avoid connection
vi.mock('../../src/services/redis.service.js', () => ({
  RedisService: vi.fn(),
  redisService: {
    getClient: vi.fn(),
    acquireLock: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
  },
}));

// Mock workflow queue service
vi.mock('../../src/services/workflow-queue.service.js', () => ({
  WorkflowQueueService: vi.fn(),
  workflowQueueService: {
    initialize: vi.fn(),
    shutdown: vi.fn(),
  },
}));

// Mock setup modules
vi.mock('../../src/setup/index.js', () => ({
  initializeEventWebSocketBridge: vi.fn(),
  initializeWorkflowQueues: vi.fn().mockResolvedValue(undefined),
  isBridgeInitialized: vi.fn().mockReturnValue(false),
  resetBridgeForTesting: vi.fn(),
  shutdownWorkflowQueues: vi.fn(),
}));

// Mock websocket gateway
vi.mock('../../src/websocket/index.js', () => ({
  executionWebSocketGateway: {
    register: vi.fn().mockResolvedValue(undefined),
  },
}));

import { buildApp } from '../../src/app.js';

describe('Graceful Shutdown (onClose hook)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('should call claudeAgentService.disconnectAll() when the server closes', async () => {
    mocks.disconnectAll.mockResolvedValue(3);

    const app = await buildApp();
    await app.close();

    expect(mocks.disconnectAll).toHaveBeenCalledTimes(1);
  });

  it('should log the number of sessions cleaned up', async () => {
    mocks.disconnectAll.mockResolvedValue(5);

    const app = await buildApp();

    // Spy on the app logger
    const logInfoSpy = vi.spyOn(app.log, 'info');

    await app.close();

    expect(mocks.disconnectAll).toHaveBeenCalledTimes(1);

    // Verify that the shutdown messages were logged
    const logCalls = logInfoSpy.mock.calls.map((call) => call[0]);
    const shutdownStartLog = logCalls.find(
      (msg) => typeof msg === 'string' && msg.includes('shutting down'),
    );
    const shutdownCompleteLog = logCalls.find(
      (msg) => typeof msg === 'string' && msg.includes('cleaned up 5'),
    );

    expect(shutdownStartLog).toBeDefined();
    expect(shutdownCompleteLog).toBeDefined();
  });

  it('should handle disconnectAll() returning 0 sessions', async () => {
    mocks.disconnectAll.mockResolvedValue(0);

    const app = await buildApp();
    const logInfoSpy = vi.spyOn(app.log, 'info');

    await app.close();

    expect(mocks.disconnectAll).toHaveBeenCalledTimes(1);

    const logCalls = logInfoSpy.mock.calls.map((call) => call[0]);
    const shutdownCompleteLog = logCalls.find(
      (msg) => typeof msg === 'string' && msg.includes('cleaned up 0'),
    );
    expect(shutdownCompleteLog).toBeDefined();
  });

  it('should handle errors from disconnectAll() gracefully without crashing', async () => {
    mocks.disconnectAll.mockRejectedValue(new Error('Disconnect failed'));

    const app = await buildApp();
    const logErrorSpy = vi.spyOn(app.log, 'error');

    // Should not throw even when disconnectAll fails
    await expect(app.close()).resolves.not.toThrow();

    expect(mocks.disconnectAll).toHaveBeenCalledTimes(1);

    // Verify error was logged
    expect(logErrorSpy).toHaveBeenCalled();
    const errorCalls = logErrorSpy.mock.calls;
    const hasShutdownError = errorCalls.some((call) => {
      // Fastify structured logging: first arg is object with err, second is message string
      const msg = typeof call[1] === 'string' ? call[1] : typeof call[0] === 'string' ? call[0] : '';
      return msg.includes('Claude Agent SDK graceful shutdown');
    });
    expect(hasShutdownError).toBe(true);
  });
});
