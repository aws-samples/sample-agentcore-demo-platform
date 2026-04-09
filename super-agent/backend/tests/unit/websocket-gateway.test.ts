/**
 * WebSocket Gateway Unit Tests
 *
 * Tests for the ExecutionWebSocketGateway class.
 *
 * Requirements:
 * - 5.1: WHEN a node's status changes, THE Workflow_Execution_Engine SHALL emit a Workflow_Event to all subscribed clients
 * - 5.4: THE frontend SHALL update Canvas_Node visual state immediately upon receiving a Workflow_Event
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExecutionWebSocketGateway } from '../../src/websocket/execution.gateway.js';
import type { WorkflowEvent } from '../../src/types/workflow-execution.js';

// Mock WebSocket class
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  CONNECTING = MockWebSocket.CONNECTING;
  OPEN = MockWebSocket.OPEN;
  CLOSING = MockWebSocket.CLOSING;
  CLOSED = MockWebSocket.CLOSED;

  readyState = MockWebSocket.OPEN;
  sentMessages: string[] = [];
  eventHandlers: Map<string, Function[]> = new Map();

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  on(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach((handler) => handler(...args));
  }
}

describe('ExecutionWebSocketGateway', () => {
  let gateway: ExecutionWebSocketGateway;

  beforeEach(() => {
    gateway = new ExecutionWebSocketGateway();
  });

  afterEach(() => {
    gateway.close();
  });

  describe('Client Management', () => {
    it('should track connected clients', () => {
      expect(gateway.getClientCount()).toBe(0);
    });

    it('should return 0 subscribers for unknown execution', () => {
      expect(gateway.getSubscriberCount('unknown-execution')).toBe(0);
    });
  });

  describe('Subscription Management', () => {
    it('should handle subscribe message', () => {
      const mockSocket = new MockWebSocket();
      
      // Simulate connection
      (gateway as any).handleConnection(mockSocket);
      
      // Simulate subscribe message
      const subscribeMessage = JSON.stringify({
        type: 'subscribe',
        executionId: 'exec-123',
      });
      (gateway as any).handleMessage(mockSocket, subscribeMessage);

      // Verify subscription
      expect(gateway.getSubscriberCount('exec-123')).toBe(1);
      
      // Verify confirmation message was sent
      expect(mockSocket.sentMessages.length).toBe(1);
      const response = JSON.parse(mockSocket.sentMessages[0]);
      expect(response.type).toBe('subscribed');
      expect(response.executionId).toBe('exec-123');
    });

    it('should handle unsubscribe message', () => {
      const mockSocket = new MockWebSocket();
      
      // Simulate connection and subscription
      (gateway as any).handleConnection(mockSocket);
      (gateway as any).handleMessage(mockSocket, JSON.stringify({
        type: 'subscribe',
        executionId: 'exec-123',
      }));

      // Verify subscription
      expect(gateway.getSubscriberCount('exec-123')).toBe(1);

      // Simulate unsubscribe
      (gateway as any).handleMessage(mockSocket, JSON.stringify({
        type: 'unsubscribe',
        executionId: 'exec-123',
      }));

      // Verify unsubscription
      expect(gateway.getSubscriberCount('exec-123')).toBe(0);
      
      // Verify confirmation message was sent
      expect(mockSocket.sentMessages.length).toBe(2);
      const response = JSON.parse(mockSocket.sentMessages[1]);
      expect(response.type).toBe('unsubscribed');
      expect(response.executionId).toBe('exec-123');
    });

    it('should handle multiple subscriptions from same client', () => {
      const mockSocket = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket);
      
      // Subscribe to multiple executions
      (gateway as any).handleMessage(mockSocket, JSON.stringify({
        type: 'subscribe',
        executionId: 'exec-1',
      }));
      (gateway as any).handleMessage(mockSocket, JSON.stringify({
        type: 'subscribe',
        executionId: 'exec-2',
      }));

      expect(gateway.getSubscriberCount('exec-1')).toBe(1);
      expect(gateway.getSubscriberCount('exec-2')).toBe(1);
    });

    it('should handle multiple clients subscribing to same execution', () => {
      const mockSocket1 = new MockWebSocket();
      const mockSocket2 = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket1);
      (gateway as any).handleConnection(mockSocket2);
      
      // Both subscribe to same execution
      (gateway as any).handleMessage(mockSocket1, JSON.stringify({
        type: 'subscribe',
        executionId: 'exec-shared',
      }));
      (gateway as any).handleMessage(mockSocket2, JSON.stringify({
        type: 'subscribe',
        executionId: 'exec-shared',
      }));

      expect(gateway.getSubscriberCount('exec-shared')).toBe(2);
    });
  });

  describe('Message Handling', () => {
    it('should handle ping message', () => {
      const mockSocket = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket);
      (gateway as any).handleMessage(mockSocket, JSON.stringify({
        type: 'ping',
      }));

      expect(mockSocket.sentMessages.length).toBe(1);
      const response = JSON.parse(mockSocket.sentMessages[0]);
      expect(response.type).toBe('pong');
    });

    it('should handle invalid JSON message', () => {
      const mockSocket = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket);
      (gateway as any).handleMessage(mockSocket, 'invalid json');

      expect(mockSocket.sentMessages.length).toBe(1);
      const response = JSON.parse(mockSocket.sentMessages[0]);
      expect(response.type).toBe('error');
      expect(response.code).toBe('INVALID_JSON');
    });

    it('should handle unknown message type', () => {
      const mockSocket = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket);
      (gateway as any).handleMessage(mockSocket, JSON.stringify({
        type: 'unknown',
      }));

      expect(mockSocket.sentMessages.length).toBe(1);
      const response = JSON.parse(mockSocket.sentMessages[0]);
      expect(response.type).toBe('error');
      expect(response.code).toBe('UNKNOWN_MESSAGE_TYPE');
    });

    it('should handle invalid executionId in subscribe', () => {
      const mockSocket = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket);
      (gateway as any).handleMessage(mockSocket, JSON.stringify({
        type: 'subscribe',
        executionId: '',
      }));

      expect(mockSocket.sentMessages.length).toBe(1);
      const response = JSON.parse(mockSocket.sentMessages[0]);
      expect(response.type).toBe('error');
      expect(response.code).toBe('INVALID_EXECUTION_ID');
    });
  });

  describe('Event Broadcasting', () => {
    it('should broadcast event to subscribed clients', () => {
      const mockSocket = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket);
      (gateway as any).handleMessage(mockSocket, JSON.stringify({
        type: 'subscribe',
        executionId: 'exec-broadcast',
      }));

      // Clear previous messages
      mockSocket.sentMessages = [];

      // Broadcast event
      const event: WorkflowEvent = {
        type: 'node:started',
        executionId: 'exec-broadcast',
        nodeId: 'node-1',
        data: { status: 'executing' },
        timestamp: new Date(),
      };
      gateway.broadcastEvent(event);

      expect(mockSocket.sentMessages.length).toBe(1);
      const response = JSON.parse(mockSocket.sentMessages[0]);
      expect(response.type).toBe('workflow_event');
      expect(response.event.type).toBe('node:started');
      expect(response.event.executionId).toBe('exec-broadcast');
      expect(response.event.nodeId).toBe('node-1');
    });

    it('should not broadcast to unsubscribed clients', () => {
      const mockSocket = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket);
      // Don't subscribe

      // Broadcast event
      const event: WorkflowEvent = {
        type: 'node:started',
        executionId: 'exec-other',
        nodeId: 'node-1',
        timestamp: new Date(),
      };
      gateway.broadcastEvent(event);

      expect(mockSocket.sentMessages.length).toBe(0);
    });

    it('should broadcast to multiple subscribed clients', () => {
      const mockSocket1 = new MockWebSocket();
      const mockSocket2 = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket1);
      (gateway as any).handleConnection(mockSocket2);
      
      (gateway as any).handleMessage(mockSocket1, JSON.stringify({
        type: 'subscribe',
        executionId: 'exec-multi',
      }));
      (gateway as any).handleMessage(mockSocket2, JSON.stringify({
        type: 'subscribe',
        executionId: 'exec-multi',
      }));

      // Clear previous messages
      mockSocket1.sentMessages = [];
      mockSocket2.sentMessages = [];

      // Broadcast event
      const event: WorkflowEvent = {
        type: 'workflow:completed',
        executionId: 'exec-multi',
        timestamp: new Date(),
      };
      gateway.broadcastEvent(event);

      expect(mockSocket1.sentMessages.length).toBe(1);
      expect(mockSocket2.sentMessages.length).toBe(1);
    });

    it('should handle closed sockets during broadcast', () => {
      const mockSocket = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket);
      (gateway as any).handleMessage(mockSocket, JSON.stringify({
        type: 'subscribe',
        executionId: 'exec-closed',
      }));

      // Close the socket
      mockSocket.readyState = MockWebSocket.CLOSED;
      mockSocket.sentMessages = [];

      // Broadcast event
      const event: WorkflowEvent = {
        type: 'node:completed',
        executionId: 'exec-closed',
        nodeId: 'node-1',
        timestamp: new Date(),
      };
      gateway.broadcastEvent(event);

      // Should not have sent any messages
      expect(mockSocket.sentMessages.length).toBe(0);
      // Should have cleaned up the subscription
      expect(gateway.getSubscriberCount('exec-closed')).toBe(0);
    });
  });

  describe('Connection Cleanup', () => {
    it('should clean up subscriptions on disconnect', () => {
      const mockSocket = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket);
      (gateway as any).handleMessage(mockSocket, JSON.stringify({
        type: 'subscribe',
        executionId: 'exec-cleanup',
      }));

      expect(gateway.getSubscriberCount('exec-cleanup')).toBe(1);
      expect(gateway.getClientCount()).toBe(1);

      // Simulate disconnect
      (gateway as any).handleDisconnect(mockSocket);

      expect(gateway.getSubscriberCount('exec-cleanup')).toBe(0);
      expect(gateway.getClientCount()).toBe(0);
    });

    it('should handle disconnect for unknown socket gracefully', () => {
      const mockSocket = new MockWebSocket();
      
      // Should not throw
      expect(() => {
        (gateway as any).handleDisconnect(mockSocket);
      }).not.toThrow();
    });
  });

  describe('Gateway Lifecycle', () => {
    it('should close all connections on close()', () => {
      const mockSocket1 = new MockWebSocket();
      const mockSocket2 = new MockWebSocket();
      
      (gateway as any).handleConnection(mockSocket1);
      (gateway as any).handleConnection(mockSocket2);

      expect(gateway.getClientCount()).toBe(2);

      gateway.close();

      expect(gateway.getClientCount()).toBe(0);
    });
  });
});
