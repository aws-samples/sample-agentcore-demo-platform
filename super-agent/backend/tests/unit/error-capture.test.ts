/**
 * Unit tests for error capture and propagation in workflow execution
 *
 * Tests the error handling functionality in the WorkflowExecutionService:
 * - Error message and stack trace capture on node failure
 * - Node status update to failed with error details
 * - node:failed event emission with error details
 * - Independent branch execution continuation when one branch fails
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4 - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkflowExecutionService } from '../../src/services/workflow-execution.service.js';
import type { WorkflowEvent } from '../../src/types/workflow-execution.js';

// Mock the repository
vi.mock('../../src/repositories/workflow-execution.repository.js', () => ({
  workflowExecutionRepository: {
    updateNodeStatus: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    findByIdWithNodes: vi.fn(),
    getNodeExecution: vi.fn(),
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

// Mock the node executor registry
vi.mock('../../src/services/node-executors/index.js', () => ({
  nodeExecutorRegistry: {
    execute: vi.fn(),
  },
}));


describe('Error Capture and Propagation', () => {
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

  describe('Requirement 6.1: Error message and stack trace capture', () => {
    it('should capture error message when node execution fails', async () => {
      const { workflowExecutionRepository } = await import(
        '../../src/repositories/workflow-execution.repository.js'
      );
      const { nodeExecutorRegistry } = await import(
        '../../src/services/node-executors/index.js'
      );

      const executionId = 'exec-error-1';
      const nodeId = 'node-1';

      // Mock node execution record
      vi.mocked(workflowExecutionRepository.getNodeExecution).mockResolvedValue({
        node_id: nodeId,
        status: 'init',
        node_type: 'agent',
        node_data: {
          id: nodeId,
          type: 'agent',
          position: { x: 0, y: 0 },
          data: { title: 'Test Agent', entityId: 'entity-1' },
        },
      } as never);

      // Mock execution with no parents (root node)
      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue({
        id: executionId,
        status: 'executing',
        canvas_data: {
          nodes: [{ id: nodeId, type: 'agent', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        },
        node_executions: [{ node_id: nodeId, status: 'init' }],
      } as never);

      // Mock executor to throw an error
      const testError = new Error('AI service unavailable');
      vi.mocked(nodeExecutorRegistry.execute).mockRejectedValue(testError);

      await service.runWorkflow({ executionId, nodeId, userId: 'user-1' });

      // Verify error message was captured
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledWith(
        executionId,
        nodeId,
        'failed',
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'AI service unavailable',
          }),
        })
      );
    });


    it('should capture stack trace when node execution fails', async () => {
      const { workflowExecutionRepository } = await import(
        '../../src/repositories/workflow-execution.repository.js'
      );
      const { nodeExecutorRegistry } = await import(
        '../../src/services/node-executors/index.js'
      );

      const executionId = 'exec-stack-1';
      const nodeId = 'node-stack';

      vi.mocked(workflowExecutionRepository.getNodeExecution).mockResolvedValue({
        node_id: nodeId,
        status: 'init',
        node_type: 'agent',
        node_data: {
          id: nodeId,
          type: 'agent',
          position: { x: 0, y: 0 },
          data: { title: 'Test Agent', entityId: 'entity-1' },
        },
      } as never);

      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue({
        id: executionId,
        status: 'executing',
        canvas_data: {
          nodes: [{ id: nodeId, type: 'agent', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        },
        node_executions: [{ node_id: nodeId, status: 'init' }],
      } as never);

      // Create error with stack trace
      const testError = new Error('Connection timeout');
      vi.mocked(nodeExecutorRegistry.execute).mockRejectedValue(testError);

      await service.runWorkflow({ executionId, nodeId, userId: 'user-1' });

      // Verify stack trace was captured
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledWith(
        executionId,
        nodeId,
        'failed',
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.stringContaining('Error: Connection timeout'),
          }),
        })
      );
    });

    it('should handle non-Error objects thrown during execution', async () => {
      const { workflowExecutionRepository } = await import(
        '../../src/repositories/workflow-execution.repository.js'
      );
      const { nodeExecutorRegistry } = await import(
        '../../src/services/node-executors/index.js'
      );

      const executionId = 'exec-non-error';
      const nodeId = 'node-non-error';

      vi.mocked(workflowExecutionRepository.getNodeExecution).mockResolvedValue({
        node_id: nodeId,
        status: 'init',
        node_type: 'action',
        node_data: {
          id: nodeId,
          type: 'action',
          position: { x: 0, y: 0 },
          data: { title: 'Test Action', entityId: 'entity-1' },
        },
      } as never);

      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue({
        id: executionId,
        status: 'executing',
        canvas_data: {
          nodes: [{ id: nodeId, type: 'action', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        },
        node_executions: [{ node_id: nodeId, status: 'init' }],
      } as never);

      // Throw a string instead of Error
      vi.mocked(nodeExecutorRegistry.execute).mockRejectedValue('String error message');

      await service.runWorkflow({ executionId, nodeId, userId: 'user-1' });

      // Verify string error was captured
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledWith(
        executionId,
        nodeId,
        'failed',
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'String error message',
          }),
        })
      );
    });
  });


  describe('Requirement 6.2: Node status update to failed with error details', () => {
    it('should update node status to failed when execution fails', async () => {
      const { workflowExecutionRepository } = await import(
        '../../src/repositories/workflow-execution.repository.js'
      );
      const { nodeExecutorRegistry } = await import(
        '../../src/services/node-executors/index.js'
      );

      const executionId = 'exec-status-1';
      const nodeId = 'node-status';

      vi.mocked(workflowExecutionRepository.getNodeExecution).mockResolvedValue({
        node_id: nodeId,
        status: 'init',
        node_type: 'agent',
        node_data: {
          id: nodeId,
          type: 'agent',
          position: { x: 0, y: 0 },
          data: { title: 'Test Agent', entityId: 'entity-1' },
        },
      } as never);

      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue({
        id: executionId,
        status: 'executing',
        canvas_data: {
          nodes: [{ id: nodeId, type: 'agent', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        },
        node_executions: [{ node_id: nodeId, status: 'init' }],
      } as never);

      // Mock executor to return failure result
      vi.mocked(nodeExecutorRegistry.execute).mockResolvedValue({
        success: false,
        error: 'Validation failed',
        errorStack: 'Error: Validation failed\n    at validate()',
      });

      await service.runWorkflow({ executionId, nodeId, userId: 'user-1' });

      // Verify status was updated to failed
      expect(workflowExecutionRepository.updateNodeStatus).toHaveBeenCalledWith(
        executionId,
        nodeId,
        'failed',
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Validation failed',
            stack: expect.stringContaining('Validation failed'),
          }),
        })
      );
    });

    it('should store error details in node execution record', async () => {
      const { workflowExecutionRepository } = await import(
        '../../src/repositories/workflow-execution.repository.js'
      );
      const { nodeExecutorRegistry } = await import(
        '../../src/services/node-executors/index.js'
      );

      const executionId = 'exec-details-1';
      const nodeId = 'node-details';

      vi.mocked(workflowExecutionRepository.getNodeExecution).mockResolvedValue({
        node_id: nodeId,
        status: 'init',
        node_type: 'action',
        node_data: {
          id: nodeId,
          type: 'action',
          position: { x: 0, y: 0 },
          data: { title: 'API Call', entityId: 'entity-1' },
        },
      } as never);

      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue({
        id: executionId,
        status: 'executing',
        canvas_data: {
          nodes: [{ id: nodeId, type: 'action', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        },
        node_executions: [{ node_id: nodeId, status: 'init' }],
      } as never);

      vi.mocked(nodeExecutorRegistry.execute).mockResolvedValue({
        success: false,
        error: 'HTTP 500: Internal Server Error',
      });

      await service.runWorkflow({ executionId, nodeId, userId: 'user-1' });

      // Verify error details structure
      const updateCall = vi.mocked(workflowExecutionRepository.updateNodeStatus).mock.calls.find(
        (call) => call[2] === 'failed'
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![3]).toHaveProperty('error');
      expect(updateCall![3].error).toHaveProperty('message', 'HTTP 500: Internal Server Error');
    });
  });


  describe('Requirement 6.3: node:failed event emission with error details', () => {
    it('should emit node:failed event when node fails', async () => {
      const { workflowExecutionRepository } = await import(
        '../../src/repositories/workflow-execution.repository.js'
      );
      const { nodeExecutorRegistry } = await import(
        '../../src/services/node-executors/index.js'
      );

      const executionId = 'exec-event-1';
      const nodeId = 'node-event';

      vi.mocked(workflowExecutionRepository.getNodeExecution).mockResolvedValue({
        node_id: nodeId,
        status: 'init',
        node_type: 'agent',
        node_data: {
          id: nodeId,
          type: 'agent',
          position: { x: 0, y: 0 },
          data: { title: 'Test Agent', entityId: 'entity-1' },
        },
      } as never);

      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue({
        id: executionId,
        status: 'executing',
        canvas_data: {
          nodes: [{ id: nodeId, type: 'agent', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        },
        node_executions: [{ node_id: nodeId, status: 'init' }],
      } as never);

      vi.mocked(nodeExecutorRegistry.execute).mockResolvedValue({
        success: false,
        error: 'Agent execution failed',
      });

      await service.runWorkflow({ executionId, nodeId, userId: 'user-1' });

      // Verify node:failed event was emitted
      const failedEvents = emittedEvents.filter((e) => e.type === 'node:failed');
      expect(failedEvents).toHaveLength(1);
      expect(failedEvents[0]).toMatchObject({
        type: 'node:failed',
        executionId,
        nodeId,
        data: expect.objectContaining({
          status: 'failed',
          error: 'Agent execution failed',
        }),
      });
    });

    it('should include error details in node:failed event', async () => {
      const { workflowExecutionRepository } = await import(
        '../../src/repositories/workflow-execution.repository.js'
      );
      const { nodeExecutorRegistry } = await import(
        '../../src/services/node-executors/index.js'
      );

      const executionId = 'exec-event-details';
      const nodeId = 'node-event-details';

      vi.mocked(workflowExecutionRepository.getNodeExecution).mockResolvedValue({
        node_id: nodeId,
        status: 'init',
        node_type: 'condition',
        node_data: {
          id: nodeId,
          type: 'condition',
          position: { x: 0, y: 0 },
          data: { title: 'Check Condition', entityId: 'entity-1' },
        },
      } as never);

      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue({
        id: executionId,
        status: 'executing',
        canvas_data: {
          nodes: [{ id: nodeId, type: 'condition', position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        },
        node_executions: [{ node_id: nodeId, status: 'init' }],
      } as never);

      vi.mocked(nodeExecutorRegistry.execute).mockResolvedValue({
        success: false,
        error: 'Invalid condition expression',
      });

      await service.runWorkflow({ executionId, nodeId, userId: 'user-1' });

      const failedEvent = emittedEvents.find((e) => e.type === 'node:failed');
      expect(failedEvent).toBeDefined();
      expect(failedEvent!.data).toHaveProperty('error', 'Invalid condition expression');
      expect(failedEvent!.timestamp).toBeInstanceOf(Date);
    });
  });


  describe('Requirement 6.4: Continue executing independent branches', () => {
    it('should only skip downstream nodes when a node fails', async () => {
      const { workflowExecutionRepository } = await import(
        '../../src/repositories/workflow-execution.repository.js'
      );
      const { nodeExecutorRegistry } = await import(
        '../../src/services/node-executors/index.js'
      );

      const executionId = 'exec-branch-1';
      const failedNodeId = 'node-failed';
      const downstreamNodeId = 'node-downstream';
      const independentNodeId = 'node-independent';

      // Setup: node-failed -> node-downstream (should be skipped)
      //        node-independent (no connection, should NOT be skipped)
      vi.mocked(workflowExecutionRepository.getNodeExecution).mockResolvedValue({
        node_id: failedNodeId,
        status: 'init',
        node_type: 'agent',
        node_data: {
          id: failedNodeId,
          type: 'agent',
          position: { x: 0, y: 0 },
          data: { title: 'Failed Agent', entityId: 'entity-1' },
        },
      } as never);

      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue({
        id: executionId,
        status: 'executing',
        canvas_data: {
          nodes: [
            { id: failedNodeId, type: 'agent', position: { x: 0, y: 0 }, data: {} },
            { id: downstreamNodeId, type: 'action', position: { x: 100, y: 0 }, data: {} },
            { id: independentNodeId, type: 'action', position: { x: 0, y: 100 }, data: {} },
          ],
          edges: [
            { id: 'edge-1', source: failedNodeId, target: downstreamNodeId },
          ],
        },
        node_executions: [
          { node_id: failedNodeId, status: 'init' },
          { node_id: downstreamNodeId, status: 'init' },
          { node_id: independentNodeId, status: 'init' },
        ],
      } as never);

      vi.mocked(nodeExecutorRegistry.execute).mockResolvedValue({
        success: false,
        error: 'Node failed',
      });

      await service.runWorkflow({ executionId, nodeId: failedNodeId, userId: 'user-1' });

      // Verify downstream node was marked as failed (skipped)
      const updateCalls = vi.mocked(workflowExecutionRepository.updateNodeStatus).mock.calls;
      const downstreamSkipCall = updateCalls.find(
        (call) => call[1] === downstreamNodeId && call[2] === 'failed'
      );
      expect(downstreamSkipCall).toBeDefined();
      expect(downstreamSkipCall![3].error.message).toContain('upstream node failure');

      // Verify independent node was NOT marked as failed
      const independentSkipCall = updateCalls.find(
        (call) => call[1] === independentNodeId && call[2] === 'failed'
      );
      expect(independentSkipCall).toBeUndefined();
    });


    it('should emit node:failed events for skipped downstream nodes', async () => {
      const { workflowExecutionRepository } = await import(
        '../../src/repositories/workflow-execution.repository.js'
      );
      const { nodeExecutorRegistry } = await import(
        '../../src/services/node-executors/index.js'
      );

      const executionId = 'exec-skip-events';
      const failedNodeId = 'node-failed';
      const downstream1 = 'node-downstream-1';
      const downstream2 = 'node-downstream-2';

      // Setup: node-failed -> downstream1 -> downstream2
      vi.mocked(workflowExecutionRepository.getNodeExecution).mockResolvedValue({
        node_id: failedNodeId,
        status: 'init',
        node_type: 'agent',
        node_data: {
          id: failedNodeId,
          type: 'agent',
          position: { x: 0, y: 0 },
          data: { title: 'Failed Agent', entityId: 'entity-1' },
        },
      } as never);

      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue({
        id: executionId,
        status: 'executing',
        canvas_data: {
          nodes: [
            { id: failedNodeId, type: 'agent', position: { x: 0, y: 0 }, data: {} },
            { id: downstream1, type: 'action', position: { x: 100, y: 0 }, data: {} },
            { id: downstream2, type: 'action', position: { x: 200, y: 0 }, data: {} },
          ],
          edges: [
            { id: 'edge-1', source: failedNodeId, target: downstream1 },
            { id: 'edge-2', source: downstream1, target: downstream2 },
          ],
        },
        node_executions: [
          { node_id: failedNodeId, status: 'init' },
          { node_id: downstream1, status: 'init' },
          { node_id: downstream2, status: 'init' },
        ],
      } as never);

      vi.mocked(nodeExecutorRegistry.execute).mockResolvedValue({
        success: false,
        error: 'Execution error',
      });

      await service.runWorkflow({ executionId, nodeId: failedNodeId, userId: 'user-1' });

      // Verify node:failed events were emitted for all affected nodes
      const failedEvents = emittedEvents.filter((e) => e.type === 'node:failed');
      
      // Should have 3 events: original failure + 2 downstream skips
      expect(failedEvents.length).toBeGreaterThanOrEqual(3);
      
      // Verify downstream nodes have skip message
      const downstream1Event = failedEvents.find((e) => e.nodeId === downstream1);
      const downstream2Event = failedEvents.find((e) => e.nodeId === downstream2);
      
      expect(downstream1Event).toBeDefined();
      expect(downstream1Event!.data?.error).toContain('upstream node failure');
      
      expect(downstream2Event).toBeDefined();
      expect(downstream2Event!.data?.error).toContain('upstream node failure');
    });

    it('should not skip nodes that are already completed', async () => {
      const { workflowExecutionRepository } = await import(
        '../../src/repositories/workflow-execution.repository.js'
      );
      const { nodeExecutorRegistry } = await import(
        '../../src/services/node-executors/index.js'
      );

      const executionId = 'exec-completed';
      const failedNodeId = 'node-failed';
      const completedNodeId = 'node-completed';

      vi.mocked(workflowExecutionRepository.getNodeExecution).mockResolvedValue({
        node_id: failedNodeId,
        status: 'init',
        node_type: 'agent',
        node_data: {
          id: failedNodeId,
          type: 'agent',
          position: { x: 0, y: 0 },
          data: { title: 'Failed Agent', entityId: 'entity-1' },
        },
      } as never);

      vi.mocked(workflowExecutionRepository.findByIdWithNodes).mockResolvedValue({
        id: executionId,
        status: 'executing',
        canvas_data: {
          nodes: [
            { id: failedNodeId, type: 'agent', position: { x: 0, y: 0 }, data: {} },
            { id: completedNodeId, type: 'action', position: { x: 100, y: 0 }, data: {} },
          ],
          edges: [
            { id: 'edge-1', source: failedNodeId, target: completedNodeId },
          ],
        },
        node_executions: [
          { node_id: failedNodeId, status: 'init' },
          { node_id: completedNodeId, status: 'finish' }, // Already completed
        ],
      } as never);

      vi.mocked(nodeExecutorRegistry.execute).mockResolvedValue({
        success: false,
        error: 'Node failed',
      });

      await service.runWorkflow({ executionId, nodeId: failedNodeId, userId: 'user-1' });

      // Verify completed node was NOT marked as failed
      const updateCalls = vi.mocked(workflowExecutionRepository.updateNodeStatus).mock.calls;
      const completedSkipCall = updateCalls.find(
        (call) => call[1] === completedNodeId && call[2] === 'failed'
      );
      expect(completedSkipCall).toBeUndefined();
    });
  });
});
