/**
 * Event-WebSocket Bridge Tests
 *
 * Tests for the event-websocket bridge that connects the WorkflowExecutionService
 * EventEmitter to the ExecutionWebSocketGateway.
 *
 * Requirements:
 * - 5.1: WHEN a node's status changes, THE Workflow_Execution_Engine SHALL emit a Workflow_Event to all subscribed clients
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initializeEventWebSocketBridge,
  isBridgeInitialized,
  resetBridgeForTesting,
} from '../../src/setup/event-websocket-bridge.js';
import { workflowExecutionService } from '../../src/services/workflow-execution.service.js';
import { executionWebSocketGateway } from '../../src/websocket/execution.gateway.js';
import type { WorkflowEvent } from '../../src/types/workflow-execution.js';

describe('Event-WebSocket Bridge', () => {
  beforeEach(() => {
    // Reset the bridge state before each test
    resetBridgeForTesting();
  });

  afterEach(() => {
    // Clean up after each test
    resetBridgeForTesting();
    vi.restoreAllMocks();
  });

  describe('initializeEventWebSocketBridge', () => {
    it('should initialize the bridge successfully', () => {
      expect(isBridgeInitialized()).toBe(false);

      initializeEventWebSocketBridge();

      expect(isBridgeInitialized()).toBe(true);
    });

    it('should not initialize twice', () => {
      const consoleSpy = vi.spyOn(console, 'log');

      initializeEventWebSocketBridge();
      initializeEventWebSocketBridge();

      // Should log warning about already being initialized
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already initialized')
      );
    });

    it('should forward workflow events to WebSocket gateway', () => {
      // Mock the broadcastEvent method
      const broadcastSpy = vi
        .spyOn(executionWebSocketGateway, 'broadcastEvent')
        .mockImplementation(() => {});

      // Initialize the bridge
      initializeEventWebSocketBridge();

      // Create a test event
      const testEvent: WorkflowEvent = {
        type: 'node:started',
        executionId: 'test-execution-123',
        nodeId: 'test-node-456',
        data: { status: 'executing' },
        timestamp: new Date(),
      };

      // Emit the event through the workflow execution service
      workflowExecutionService.emit('workflow:event', testEvent);

      // Verify the event was forwarded to the WebSocket gateway
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
      expect(broadcastSpy).toHaveBeenCalledWith(testEvent);
    });

    it('should forward node:completed events', () => {
      const broadcastSpy = vi
        .spyOn(executionWebSocketGateway, 'broadcastEvent')
        .mockImplementation(() => {});

      initializeEventWebSocketBridge();

      const testEvent: WorkflowEvent = {
        type: 'node:completed',
        executionId: 'test-execution-123',
        nodeId: 'test-node-456',
        data: { status: 'finish', result: { output: 'test result' } },
        timestamp: new Date(),
      };

      workflowExecutionService.emit('workflow:event', testEvent);

      expect(broadcastSpy).toHaveBeenCalledWith(testEvent);
    });

    it('should forward node:failed events', () => {
      const broadcastSpy = vi
        .spyOn(executionWebSocketGateway, 'broadcastEvent')
        .mockImplementation(() => {});

      initializeEventWebSocketBridge();

      const testEvent: WorkflowEvent = {
        type: 'node:failed',
        executionId: 'test-execution-123',
        nodeId: 'test-node-456',
        data: { status: 'failed', error: 'Test error message' },
        timestamp: new Date(),
      };

      workflowExecutionService.emit('workflow:event', testEvent);

      expect(broadcastSpy).toHaveBeenCalledWith(testEvent);
    });

    it('should forward workflow:started events', () => {
      const broadcastSpy = vi
        .spyOn(executionWebSocketGateway, 'broadcastEvent')
        .mockImplementation(() => {});

      initializeEventWebSocketBridge();

      const testEvent: WorkflowEvent = {
        type: 'workflow:started',
        executionId: 'test-execution-123',
        timestamp: new Date(),
      };

      workflowExecutionService.emit('workflow:event', testEvent);

      expect(broadcastSpy).toHaveBeenCalledWith(testEvent);
    });

    it('should forward workflow:completed events', () => {
      const broadcastSpy = vi
        .spyOn(executionWebSocketGateway, 'broadcastEvent')
        .mockImplementation(() => {});

      initializeEventWebSocketBridge();

      const testEvent: WorkflowEvent = {
        type: 'workflow:completed',
        executionId: 'test-execution-123',
        timestamp: new Date(),
      };

      workflowExecutionService.emit('workflow:event', testEvent);

      expect(broadcastSpy).toHaveBeenCalledWith(testEvent);
    });

    it('should forward workflow:failed events', () => {
      const broadcastSpy = vi
        .spyOn(executionWebSocketGateway, 'broadcastEvent')
        .mockImplementation(() => {});

      initializeEventWebSocketBridge();

      const testEvent: WorkflowEvent = {
        type: 'workflow:failed',
        executionId: 'test-execution-123',
        data: { error: 'Workflow failed' },
        timestamp: new Date(),
      };

      workflowExecutionService.emit('workflow:event', testEvent);

      expect(broadcastSpy).toHaveBeenCalledWith(testEvent);
    });

    it('should forward workflow:aborted events', () => {
      const broadcastSpy = vi
        .spyOn(executionWebSocketGateway, 'broadcastEvent')
        .mockImplementation(() => {});

      initializeEventWebSocketBridge();

      const testEvent: WorkflowEvent = {
        type: 'workflow:aborted',
        executionId: 'test-execution-123',
        data: { abortedByUser: true },
        timestamp: new Date(),
      };

      workflowExecutionService.emit('workflow:event', testEvent);

      expect(broadcastSpy).toHaveBeenCalledWith(testEvent);
    });

    it('should forward node:progress events', () => {
      const broadcastSpy = vi
        .spyOn(executionWebSocketGateway, 'broadcastEvent')
        .mockImplementation(() => {});

      initializeEventWebSocketBridge();

      const testEvent: WorkflowEvent = {
        type: 'node:progress',
        executionId: 'test-execution-123',
        nodeId: 'test-node-456',
        data: { status: 'executing', progress: 50 },
        timestamp: new Date(),
      };

      workflowExecutionService.emit('workflow:event', testEvent);

      expect(broadcastSpy).toHaveBeenCalledWith(testEvent);
    });

    it('should forward multiple events in sequence', () => {
      const broadcastSpy = vi
        .spyOn(executionWebSocketGateway, 'broadcastEvent')
        .mockImplementation(() => {});

      initializeEventWebSocketBridge();

      const events: WorkflowEvent[] = [
        {
          type: 'workflow:started',
          executionId: 'test-execution-123',
          timestamp: new Date(),
        },
        {
          type: 'node:started',
          executionId: 'test-execution-123',
          nodeId: 'node-1',
          data: { status: 'executing' },
          timestamp: new Date(),
        },
        {
          type: 'node:completed',
          executionId: 'test-execution-123',
          nodeId: 'node-1',
          data: { status: 'finish' },
          timestamp: new Date(),
        },
        {
          type: 'workflow:completed',
          executionId: 'test-execution-123',
          timestamp: new Date(),
        },
      ];

      // Emit all events
      for (const event of events) {
        workflowExecutionService.emit('workflow:event', event);
      }

      // Verify all events were forwarded
      expect(broadcastSpy).toHaveBeenCalledTimes(4);
      events.forEach((event, index) => {
        expect(broadcastSpy).toHaveBeenNthCalledWith(index + 1, event);
      });
    });
  });

  describe('resetBridgeForTesting', () => {
    it('should reset the bridge state', () => {
      initializeEventWebSocketBridge();
      expect(isBridgeInitialized()).toBe(true);

      resetBridgeForTesting();
      expect(isBridgeInitialized()).toBe(false);
    });

    it('should remove event listeners', () => {
      const broadcastSpy = vi
        .spyOn(executionWebSocketGateway, 'broadcastEvent')
        .mockImplementation(() => {});

      initializeEventWebSocketBridge();

      // Reset the bridge
      resetBridgeForTesting();

      // Emit an event - should not be forwarded
      const testEvent: WorkflowEvent = {
        type: 'node:started',
        executionId: 'test-execution-123',
        nodeId: 'test-node-456',
        timestamp: new Date(),
      };

      workflowExecutionService.emit('workflow:event', testEvent);

      // Should not have been called since listeners were removed
      expect(broadcastSpy).not.toHaveBeenCalled();
    });
  });
});
