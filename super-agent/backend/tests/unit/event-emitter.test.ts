/**
 * Unit tests for workflow event emitter integration
 *
 * Tests the event emission functionality in the WorkflowExecutionService:
 * - Node events: node:started, node:progress, node:completed, node:failed
 * - Workflow events: workflow:started, workflow:completed, workflow:failed, workflow:aborted
 * - Event payload structure (executionId, nodeId, status, timestamp)
 *
 * Requirements: 5.1, 5.2, 5.5 - Real-time status updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowExecutionService } from '../../src/services/workflow-execution.service.js';
import type { WorkflowEvent, WorkflowEventType } from '../../src/types/workflow-execution.js';

// Mock the repository
vi.mock('../../src/repositories/workflow-execution.repository.js', () => ({
  workflowExecutionRepository: {
    updateNodeStatus: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    findByIdWithNodes: vi.fn(),
    findActiveExecution: vi.fn().mockResolvedValue(null),
    createWithNodes: vi.fn().mockResolvedValue('exec-123'),
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

describe('Workflow Event Emitter Integration', () => {
  let service: WorkflowExecutionService;
  let emittedEvents: WorkflowEvent[];

  beforeEach(() => {
    service = new WorkflowExecutionService();
    emittedEvents = [];

    // Capture all emitted events
    service.on('workflow:event', (event: WorkflowEvent) => {
      emittedEvents.push(event);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    service.removeAllListeners();
  });

  describe('emitWorkflowEvent', () => {
    it('should emit events with correct structure (Requirement 5.2)', () => {
      const executionId = 'exec-123';
      const nodeId = 'node-456';
      const data = { status: 'executing' as const };

      service.emitWorkflowEvent('node:started', executionId, nodeId, data);

      expect(emittedEvents).toHaveLength(1);
      const event = emittedEvents[0];

      // Verify all required fields are present (Requirement 5.2)
      expect(event).toHaveProperty('type', 'node:started');
      expect(event).toHaveProperty('executionId', executionId);
      expect(event).toHaveProperty('nodeId', nodeId);
      expect(event).toHaveProperty('timestamp');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.data).toEqual(data);
    });

    it('should emit events without nodeId for workflow-level events', () => {
      const executionId = 'exec-789';

      service.emitWorkflowEvent('workflow:started', executionId);

      expect(emittedEvents).toHaveLength(1);
      const event = emittedEvents[0];

      expect(event.type).toBe('workflow:started');
      expect(event.executionId).toBe(executionId);
      expect(event.nodeId).toBeUndefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should emit both specific event type and generic workflow:event', () => {
      const specificEvents: WorkflowEvent[] = [];
      service.on('node:started', (event: WorkflowEvent) => {
        specificEvents.push(event);
      });

      service.emitWorkflowEvent('node:started', 'exec-123', 'node-456');

      // Should emit to both specific type and generic workflow:event
      expect(specificEvents).toHaveLength(1);
      expect(emittedEvents).toHaveLength(1);
      expect(specificEvents[0]).toEqual(emittedEvents[0]);
    });
  });

  describe('Node Events', () => {
    describe('node:started', () => {
      it('should emit node:started with executing status', () => {
        service.emitWorkflowEvent('node:started', 'exec-1', 'node-1', {
          status: 'executing',
        });

        expect(emittedEvents).toHaveLength(1);
        expect(emittedEvents[0]).toMatchObject({
          type: 'node:started',
          executionId: 'exec-1',
          nodeId: 'node-1',
          data: { status: 'executing' },
        });
      });
    });

    describe('node:progress', () => {
      it('should emit node:progress with progress percentage', () => {
        service.emitNodeProgress('exec-1', 'node-1', 50, 'Processing...');

        expect(emittedEvents).toHaveLength(1);
        expect(emittedEvents[0]).toMatchObject({
          type: 'node:progress',
          executionId: 'exec-1',
          nodeId: 'node-1',
          data: {
            status: 'executing',
            progress: 50,
            message: 'Processing...',
          },
        });
      });

      it('should clamp progress to 0-100 range', () => {
        // Test progress > 100
        service.emitNodeProgress('exec-1', 'node-1', 150);
        expect(emittedEvents[0].data?.progress).toBe(100);

        // Test progress < 0
        service.emitNodeProgress('exec-1', 'node-2', -10);
        expect(emittedEvents[1].data?.progress).toBe(0);
      });

      it('should emit progress without message when not provided', () => {
        service.emitNodeProgress('exec-1', 'node-1', 75);

        expect(emittedEvents[0].data?.message).toBeUndefined();
      });
    });

    describe('node:completed', () => {
      it('should emit node:completed with finish status and result', () => {
        const result = { output: 'test result' };
        service.emitWorkflowEvent('node:completed', 'exec-1', 'node-1', {
          status: 'finish',
          result,
        });

        expect(emittedEvents).toHaveLength(1);
        expect(emittedEvents[0]).toMatchObject({
          type: 'node:completed',
          executionId: 'exec-1',
          nodeId: 'node-1',
          data: {
            status: 'finish',
            result,
          },
        });
      });
    });

    describe('node:failed', () => {
      it('should emit node:failed with error details', () => {
        service.emitWorkflowEvent('node:failed', 'exec-1', 'node-1', {
          status: 'failed',
          error: 'Something went wrong',
        });

        expect(emittedEvents).toHaveLength(1);
        expect(emittedEvents[0]).toMatchObject({
          type: 'node:failed',
          executionId: 'exec-1',
          nodeId: 'node-1',
          data: {
            status: 'failed',
            error: 'Something went wrong',
          },
        });
      });

      it('should emit node:failed with error code when provided', () => {
        service.emitWorkflowEvent('node:failed', 'exec-1', 'node-1', {
          status: 'failed',
          error: 'Timeout',
          errorCode: 'TIMEOUT_ERROR',
        });

        expect(emittedEvents[0].data?.errorCode).toBe('TIMEOUT_ERROR');
      });
    });
  });

  describe('Workflow Events', () => {
    describe('workflow:started', () => {
      it('should emit workflow:started event', () => {
        service.emitWorkflowEvent('workflow:started', 'exec-1');

        expect(emittedEvents).toHaveLength(1);
        expect(emittedEvents[0]).toMatchObject({
          type: 'workflow:started',
          executionId: 'exec-1',
        });
        expect(emittedEvents[0].nodeId).toBeUndefined();
      });
    });

    describe('workflow:completed', () => {
      it('should emit workflow:completed event (Requirement 5.5)', () => {
        service.emitWorkflowEvent('workflow:completed', 'exec-1');

        expect(emittedEvents).toHaveLength(1);
        expect(emittedEvents[0]).toMatchObject({
          type: 'workflow:completed',
          executionId: 'exec-1',
        });
      });
    });

    describe('workflow:failed', () => {
      it('should emit workflow:failed event with error (Requirement 5.5)', () => {
        service.emitWorkflowEvent('workflow:failed', 'exec-1', undefined, {
          error: 'Workflow failed',
        });

        expect(emittedEvents).toHaveLength(1);
        expect(emittedEvents[0]).toMatchObject({
          type: 'workflow:failed',
          executionId: 'exec-1',
          data: { error: 'Workflow failed' },
        });
      });
    });

    describe('workflow:aborted', () => {
      it('should emit workflow:aborted event', () => {
        service.emitWorkflowEvent('workflow:aborted', 'exec-1', undefined, {
          abortedByUser: true,
        });

        expect(emittedEvents).toHaveLength(1);
        expect(emittedEvents[0]).toMatchObject({
          type: 'workflow:aborted',
          executionId: 'exec-1',
          data: { abortedByUser: true },
        });
      });
    });
  });

  describe('abortExecution', () => {
    it('should emit workflow:aborted event when execution is aborted', async () => {
      const { workflowExecutionRepository } = await import('../../src/repositories/workflow-execution.repository.js');
      
      const executionId = 'exec-abort-1';
      const mockExecution = {
        id: executionId,
        status: 'executing',
        node_executions: [
          { node_id: 'node-1', status: 'executing' },
          { node_id: 'node-2', status: 'waiting' },
          { node_id: 'node-3', status: 'finish' },
        ],
      };

      vi.mocked(workflowExecutionRepository.findByIdWithNodes)
        .mockResolvedValueOnce(mockExecution as never)
        .mockResolvedValueOnce({ ...mockExecution, status: 'aborted' } as never);

      await service.abortExecution(executionId, 'org-1');

      // Should emit node:failed for each active node
      const nodeFailedEvents = emittedEvents.filter((e) => e.type === 'node:failed');
      expect(nodeFailedEvents).toHaveLength(2);

      // Should emit workflow:aborted
      const workflowAbortedEvents = emittedEvents.filter((e) => e.type === 'workflow:aborted');
      expect(workflowAbortedEvents).toHaveLength(1);
      expect(workflowAbortedEvents[0]).toMatchObject({
        type: 'workflow:aborted',
        executionId,
        data: {
          abortedByUser: true,
          abortedNodesCount: 2,
          abortedNodeIds: ['node-1', 'node-2'],
        },
      });
    });

    it('should throw error when execution is already in terminal state', async () => {
      const { workflowExecutionRepository } = await import('../../src/repositories/workflow-execution.repository.js');
      
      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue({
        id: 'exec-1',
        status: 'finish',
        node_executions: [],
      } as never);

      await expect(service.abortExecution('exec-1', 'org-1')).rejects.toThrow(
        'Cannot abort execution in terminal state: finish'
      );
    });

    it('should throw error when execution is not found', async () => {
      const { workflowExecutionRepository } = await import('../../src/repositories/workflow-execution.repository.js');
      
      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue(null);

      await expect(service.abortExecution('exec-not-found', 'org-1')).rejects.toThrow(
        'Execution not found: exec-not-found'
      );
    });

    it('should mark all active nodes as failed with abort reason', async () => {
      const { workflowExecutionRepository } = await import('../../src/repositories/workflow-execution.repository.js');
      
      const executionId = 'exec-abort-2';
      const mockExecution = {
        id: executionId,
        status: 'executing',
        node_executions: [
          { node_id: 'node-1', status: 'init' },
          { node_id: 'node-2', status: 'executing' },
        ],
      };

      vi.mocked(workflowExecutionRepository.findByIdWithNodes)
        .mockResolvedValueOnce(mockExecution as never)
        .mockResolvedValueOnce({ ...mockExecution, status: 'aborted' } as never);

      await service.abortExecution(executionId, 'org-1');

      // Verify updateNodeStatus was called for each active node
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledTimes(2);
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledWith(
        executionId,
        'node-1',
        'failed',
        expect.objectContaining({
          error: { message: 'Execution aborted by user' },
        })
      );
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledWith(
        executionId,
        'node-2',
        'failed',
        expect.objectContaining({
          error: { message: 'Execution aborted by user' },
        })
      );
    });

    it('should update execution status to aborted', async () => {
      const { workflowExecutionRepository } = await import('../../src/repositories/workflow-execution.repository.js');
      
      const executionId = 'exec-abort-3';
      const mockExecution = {
        id: executionId,
        status: 'executing',
        node_executions: [],
      };

      vi.mocked(workflowExecutionRepository.findByIdWithNodes)
        .mockResolvedValueOnce(mockExecution as never)
        .mockResolvedValueOnce({ ...mockExecution, status: 'aborted' } as never);

      await service.abortExecution(executionId, 'org-1');

      expect(workflowExecutionRepository.updateStatus).toHaveBeenCalledWith(
        executionId,
        'aborted',
        { message: 'Execution aborted by user' }
      );
    });
  });

  describe('Event Timestamp', () => {
    it('should include timestamp in all events', () => {
      const eventTypes: WorkflowEventType[] = [
        'workflow:started',
        'workflow:completed',
        'workflow:failed',
        'workflow:aborted',
        'node:started',
        'node:progress',
        'node:completed',
        'node:failed',
      ];

      for (const type of eventTypes) {
        service.emitWorkflowEvent(type, 'exec-1', 'node-1');
      }

      expect(emittedEvents).toHaveLength(eventTypes.length);
      for (const event of emittedEvents) {
        expect(event.timestamp).toBeInstanceOf(Date);
        // Timestamp should be recent (within last second)
        expect(Date.now() - event.timestamp.getTime()).toBeLessThan(1000);
      }
    });
  });

  describe('Event Subscription', () => {
    it('should allow subscribing to specific event types', () => {
      const nodeStartedEvents: WorkflowEvent[] = [];
      const nodeCompletedEvents: WorkflowEvent[] = [];

      service.on('node:started', (event: WorkflowEvent) => {
        nodeStartedEvents.push(event);
      });
      service.on('node:completed', (event: WorkflowEvent) => {
        nodeCompletedEvents.push(event);
      });

      service.emitWorkflowEvent('node:started', 'exec-1', 'node-1');
      service.emitWorkflowEvent('node:completed', 'exec-1', 'node-1');
      service.emitWorkflowEvent('node:failed', 'exec-1', 'node-2');

      expect(nodeStartedEvents).toHaveLength(1);
      expect(nodeCompletedEvents).toHaveLength(1);
    });

    it('should allow subscribing to all events via workflow:event', () => {
      service.emitWorkflowEvent('node:started', 'exec-1', 'node-1');
      service.emitWorkflowEvent('node:completed', 'exec-1', 'node-1');
      service.emitWorkflowEvent('workflow:completed', 'exec-1');

      // All events should be captured via workflow:event listener
      expect(emittedEvents).toHaveLength(3);
    });
  });
});
