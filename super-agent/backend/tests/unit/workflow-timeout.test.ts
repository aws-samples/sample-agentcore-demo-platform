/**
 * Unit tests for workflow execution timeout handling
 *
 * Tests the timeout handling functionality in the WorkflowExecutionService:
 * - Execution age checking against timeout limit
 * - Marking timed-out nodes as failed
 * - Marking execution as failed on timeout
 * - Proper event emission for timeouts
 *
 * Requirements: 6.1, 6.2 - Error handling and capture
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowExecutionService } from '../../src/services/workflow-execution.service.js';
import { EXECUTION_TIMEOUT_MS } from '../../src/config/queue.js';

// Mock the repository
vi.mock('../../src/repositories/workflow-execution.repository.js', () => ({
  workflowExecutionRepository: {
    updateNodeStatus: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    findByIdWithNodes: vi.fn(),
  },
}));

// Mock the queue service
vi.mock('../../src/services/workflow-queue.service.js', () => ({
  workflowQueueService: {
    addRunWorkflowJob: vi.fn().mockResolvedValue(undefined),
    addPollWorkflowJob: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the redis service
vi.mock('../../src/services/redis.service.js', () => ({
  redisService: {
    acquireNodeLock: vi.fn().mockResolvedValue(() => Promise.resolve()),
    acquirePollLock: vi.fn().mockResolvedValue(() => Promise.resolve()),
  },
}));

describe('Workflow Execution Timeout Handling', () => {
  let service: WorkflowExecutionService;
  let emittedEvents: Array<{ type: string; executionId: string; nodeId?: string; data?: Record<string, unknown> }>;

  beforeEach(() => {
    service = new WorkflowExecutionService();
    emittedEvents = [];

    // Capture emitted events
    service.on('workflow:event', (event) => {
      emittedEvents.push(event);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    service.removeAllListeners();
  });

  describe('isTimedOut', () => {
    it('should return false when execution is within timeout limit', () => {
      const startedAt = new Date();
      // Access private method via any cast for testing
      const isTimedOut = (service as unknown as { isTimedOut: (date: Date) => boolean }).isTimedOut(startedAt);
      expect(isTimedOut).toBe(false);
    });

    it('should return true when execution exceeds timeout limit', () => {
      // Create a date that is older than the timeout
      const startedAt = new Date(Date.now() - EXECUTION_TIMEOUT_MS - 1000);
      const isTimedOut = (service as unknown as { isTimedOut: (date: Date) => boolean }).isTimedOut(startedAt);
      expect(isTimedOut).toBe(true);
    });

    it('should return false when execution is exactly at timeout limit', () => {
      // Create a date that is exactly at the timeout (should not be timed out yet)
      const startedAt = new Date(Date.now() - EXECUTION_TIMEOUT_MS + 100);
      const isTimedOut = (service as unknown as { isTimedOut: (date: Date) => boolean }).isTimedOut(startedAt);
      expect(isTimedOut).toBe(false);
    });
  });

  describe('handleExecutionTimeout', () => {
    it('should mark all active nodes as failed with timeout error', async () => {
      const { workflowExecutionRepository } = await import('../../src/repositories/workflow-execution.repository.js');
      
      const executionId = 'exec-123';
      const execution = {
        started_at: new Date(Date.now() - EXECUTION_TIMEOUT_MS - 60000), // 1 minute past timeout
        node_executions: [
          { node_id: 'node-1', status: 'finish' },
          { node_id: 'node-2', status: 'executing' },
          { node_id: 'node-3', status: 'waiting' },
          { node_id: 'node-4', status: 'init' },
        ],
      };

      // Call the private method
      await (service as unknown as { 
        handleExecutionTimeout: (id: string, exec: typeof execution) => Promise<void> 
      }).handleExecutionTimeout(executionId, execution);

      // Verify that only active nodes (executing, waiting, init) were marked as failed
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledTimes(3);
      
      // Verify node-2 (executing) was marked as failed
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledWith(
        executionId,
        'node-2',
        'failed',
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Execution timeout exceeded'),
            stack: expect.any(String),
          }),
        })
      );

      // Verify node-3 (waiting) was marked as failed
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledWith(
        executionId,
        'node-3',
        'failed',
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Execution timeout exceeded'),
          }),
        })
      );

      // Verify node-4 (init) was marked as failed
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledWith(
        executionId,
        'node-4',
        'failed',
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('Execution timeout exceeded'),
          }),
        })
      );
    });

    it('should emit node:failed events for each timed-out node', async () => {
      const executionId = 'exec-456';
      const execution = {
        started_at: new Date(Date.now() - EXECUTION_TIMEOUT_MS - 1000),
        node_executions: [
          { node_id: 'node-1', status: 'executing' },
          { node_id: 'node-2', status: 'waiting' },
        ],
      };

      await (service as unknown as { 
        handleExecutionTimeout: (id: string, exec: typeof execution) => Promise<void> 
      }).handleExecutionTimeout(executionId, execution);

      // Filter for node:failed events
      const nodeFailedEvents = emittedEvents.filter((e) => e.type === 'node:failed');
      expect(nodeFailedEvents).toHaveLength(2);

      // Verify event content
      expect(nodeFailedEvents[0]).toMatchObject({
        type: 'node:failed',
        executionId,
        nodeId: 'node-1',
        data: expect.objectContaining({
          status: 'failed',
          error: expect.stringContaining('Execution timeout exceeded'),
          errorCode: 'TIMEOUT_ERROR',
        }),
      });

      expect(nodeFailedEvents[1]).toMatchObject({
        type: 'node:failed',
        executionId,
        nodeId: 'node-2',
        data: expect.objectContaining({
          status: 'failed',
          errorCode: 'TIMEOUT_ERROR',
        }),
      });
    });

    it('should mark execution as failed with timeout error', async () => {
      const { workflowExecutionRepository } = await import('../../src/repositories/workflow-execution.repository.js');
      
      const executionId = 'exec-789';
      const execution = {
        started_at: new Date(Date.now() - EXECUTION_TIMEOUT_MS - 1000),
        node_executions: [
          { node_id: 'node-1', status: 'executing' },
        ],
      };

      await (service as unknown as { 
        handleExecutionTimeout: (id: string, exec: typeof execution) => Promise<void> 
      }).handleExecutionTimeout(executionId, execution);

      // Verify execution was marked as failed
      expect(workflowExecutionRepository.updateStatus).toHaveBeenCalledWith(
        executionId,
        'failed',
        expect.objectContaining({
          message: expect.stringContaining('Execution timeout exceeded'),
          stack: expect.any(String),
        })
      );
    });

    it('should emit workflow:failed event with timeout details', async () => {
      const executionId = 'exec-abc';
      const execution = {
        started_at: new Date(Date.now() - EXECUTION_TIMEOUT_MS - 1000),
        node_executions: [
          { node_id: 'node-1', status: 'executing' },
          { node_id: 'node-2', status: 'waiting' },
        ],
      };

      await (service as unknown as { 
        handleExecutionTimeout: (id: string, exec: typeof execution) => Promise<void> 
      }).handleExecutionTimeout(executionId, execution);

      // Filter for workflow:failed event
      const workflowFailedEvents = emittedEvents.filter((e) => e.type === 'workflow:failed');
      expect(workflowFailedEvents).toHaveLength(1);

      expect(workflowFailedEvents[0]).toMatchObject({
        type: 'workflow:failed',
        executionId,
        data: expect.objectContaining({
          error: expect.stringContaining('Execution timeout exceeded'),
          errorCode: 'TIMEOUT_ERROR',
          timedOutNodes: ['node-1', 'node-2'],
        }),
      });
    });

    it('should include elapsed time in error message', async () => {
      const { workflowExecutionRepository } = await import('../../src/repositories/workflow-execution.repository.js');
      
      const executionId = 'exec-time';
      // Set started_at to 35 minutes ago (5 minutes past the 30 minute timeout)
      const execution = {
        started_at: new Date(Date.now() - 35 * 60 * 1000),
        node_executions: [
          { node_id: 'node-1', status: 'executing' },
        ],
      };

      await (service as unknown as { 
        handleExecutionTimeout: (id: string, exec: typeof execution) => Promise<void> 
      }).handleExecutionTimeout(executionId, execution);

      // Verify the error message includes elapsed time
      expect(workflowExecutionRepository.updateStatus).toHaveBeenCalledWith(
        executionId,
        'failed',
        expect.objectContaining({
          message: expect.stringMatching(/Execution timeout exceeded after \d+m \d+s/),
        })
      );
    });

    it('should handle execution with no active nodes gracefully', async () => {
      const { workflowExecutionRepository } = await import('../../src/repositories/workflow-execution.repository.js');
      
      const executionId = 'exec-no-active';
      const execution = {
        started_at: new Date(Date.now() - EXECUTION_TIMEOUT_MS - 1000),
        node_executions: [
          { node_id: 'node-1', status: 'finish' },
          { node_id: 'node-2', status: 'failed' },
        ],
      };

      await (service as unknown as { 
        handleExecutionTimeout: (id: string, exec: typeof execution) => Promise<void> 
      }).handleExecutionTimeout(executionId, execution);

      // No node status updates should be made
      expect(workflowExecutionRepository.updateNodeStatus).not.toHaveBeenCalled();

      // Execution should still be marked as failed
      expect(workflowExecutionRepository.updateStatus).toHaveBeenCalledWith(
        executionId,
        'failed',
        expect.any(Object)
      );

      // Workflow failed event should have empty timedOutNodes array
      const workflowFailedEvents = emittedEvents.filter((e) => e.type === 'workflow:failed');
      expect(workflowFailedEvents[0].data?.timedOutNodes).toEqual([]);
    });

    it('should capture stack trace in error details (Requirement 6.1)', async () => {
      const { workflowExecutionRepository } = await import('../../src/repositories/workflow-execution.repository.js');
      
      const executionId = 'exec-stack';
      const execution = {
        started_at: new Date(Date.now() - EXECUTION_TIMEOUT_MS - 1000),
        node_executions: [
          { node_id: 'node-1', status: 'executing' },
        ],
      };

      await (service as unknown as { 
        handleExecutionTimeout: (id: string, exec: typeof execution) => Promise<void> 
      }).handleExecutionTimeout(executionId, execution);

      // Verify stack trace is captured for node
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledWith(
        executionId,
        'node-1',
        'failed',
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.stringContaining('Error: Execution timeout exceeded'),
          }),
        })
      );

      // Verify stack trace is captured for execution
      expect(workflowExecutionRepository.updateStatus).toHaveBeenCalledWith(
        executionId,
        'failed',
        expect.objectContaining({
          stack: expect.stringContaining('Error: Execution timeout exceeded'),
        })
      );
    });
  });
});
