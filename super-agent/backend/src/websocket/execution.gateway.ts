/**
 * WebSocket Gateway for Workflow Execution Events
 *
 * This gateway handles WebSocket connections for real-time workflow execution events.
 * It allows clients to subscribe/unsubscribe to specific execution IDs and broadcasts
 * workflow events to subscribed clients.
 *
 * Requirements:
 * - 5.1: WHEN a node's status changes, THE Workflow_Execution_Engine SHALL emit a Workflow_Event to all subscribed clients
 * - 5.4: THE frontend SHALL update Canvas_Node visual state immediately upon receiving a Workflow_Event
 *
 * @module websocket/execution.gateway
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';
import type { WorkflowEvent } from '../types/workflow-execution.js';

/**
 * Client message types for WebSocket communication
 */
interface SubscribeMessage {
  type: 'subscribe';
  executionId: string;
}

interface UnsubscribeMessage {
  type: 'unsubscribe';
  executionId: string;
}

interface PingMessage {
  type: 'ping';
}

type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

/**
 * Server message types for WebSocket communication
 */
interface SubscribedMessage {
  type: 'subscribed';
  executionId: string;
}

interface UnsubscribedMessage {
  type: 'unsubscribed';
  executionId: string;
}

interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

interface PongMessage {
  type: 'pong';
}

interface WorkflowEventMessage {
  type: 'workflow_event';
  event: WorkflowEvent;
}

type ServerMessage =
  | SubscribedMessage
  | UnsubscribedMessage
  | ErrorMessage
  | PongMessage
  | WorkflowEventMessage;

/**
 * WebSocket client connection with subscription tracking
 */
interface WebSocketClient {
  socket: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
}

/**
 * Execution WebSocket Gateway
 *
 * Manages WebSocket connections for workflow execution events.
 * Handles subscribe/unsubscribe messages and broadcasts events to subscribed clients.
 */
export class ExecutionWebSocketGateway {
  /**
   * Map of WebSocket connections to their client info
   */
  private clients: Map<WebSocket, WebSocketClient> = new Map();

  /**
   * Map of execution IDs to subscribed WebSocket connections
   */
  private subscriptions: Map<string, Set<WebSocket>> = new Map();

  /**
   * Heartbeat interval for connection health checks
   */
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Heartbeat interval in milliseconds (30 seconds)
   */
  private readonly HEARTBEAT_INTERVAL_MS = 30000;

  /**
   * Connection timeout in milliseconds (60 seconds)
   */
  private readonly CONNECTION_TIMEOUT_MS = 60000;

  constructor() {
    // Start heartbeat monitoring
    this.startHeartbeat();
  }

  /**
   * Register the WebSocket gateway with a Fastify instance
   *
   * @param fastify - Fastify instance to register the gateway on
   */
  async register(fastify: FastifyInstance): Promise<void> {
    // Register the @fastify/websocket plugin
    await fastify.register(websocket, {
      options: {
        maxPayload: 1048576, // 1MB max message size
      },
    });

    // Register the WebSocket route
    fastify.get(
      '/ws/executions',
      { websocket: true },
      (socket: WebSocket, _request: FastifyRequest) => {
        this.handleConnection(socket);
      }
    );

    fastify.log.info('WebSocket gateway registered at /ws/executions');
  }

  /**
   * Handle a new WebSocket connection
   *
   * @param socket - WebSocket connection
   */
  private handleConnection(socket: WebSocket): void {
    // Create client record
    const client: WebSocketClient = {
      socket,
      subscriptions: new Set(),
      lastPing: Date.now(),
    };

    this.clients.set(socket, client);
    console.log(`🔌 WebSocket client connected. Total clients: ${this.clients.size}`);

    // Handle incoming messages
    socket.on('message', (data: Buffer | string) => {
      this.handleMessage(socket, data);
    });

    // Handle connection close
    socket.on('close', () => {
      this.handleDisconnect(socket);
    });

    // Handle connection errors
    socket.on('error', (error: Error) => {
      console.error('WebSocket error:', error.message);
      this.handleDisconnect(socket);
    });
  }

  /**
   * Handle incoming WebSocket message
   *
   * @param socket - WebSocket connection
   * @param data - Message data
   */
  private handleMessage(socket: WebSocket, data: Buffer | string): void {
    const client = this.clients.get(socket);
    if (!client) {
      return;
    }

    // Update last ping time
    client.lastPing = Date.now();

    try {
      const message = JSON.parse(data.toString()) as ClientMessage;

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(socket, message.executionId);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(socket, message.executionId);
          break;

        case 'ping':
          this.sendMessage(socket, { type: 'pong' });
          break;

        default:
          this.sendMessage(socket, {
            type: 'error',
            message: `Unknown message type: ${(message as { type: string }).type}`,
            code: 'UNKNOWN_MESSAGE_TYPE',
          });
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.sendMessage(socket, {
        type: 'error',
        message: 'Invalid JSON message',
        code: 'INVALID_JSON',
      });
    }
  }

  /**
   * Handle subscribe message
   *
   * @param socket - WebSocket connection
   * @param executionId - Execution ID to subscribe to
   */
  private handleSubscribe(socket: WebSocket, executionId: string): void {
    if (!executionId || typeof executionId !== 'string') {
      this.sendMessage(socket, {
        type: 'error',
        message: 'Invalid executionId',
        code: 'INVALID_EXECUTION_ID',
      });
      return;
    }

    const client = this.clients.get(socket);
    if (!client) {
      return;
    }

    // Add to client's subscriptions
    client.subscriptions.add(executionId);

    // Add to execution's subscribers
    let subscribers = this.subscriptions.get(executionId);
    if (!subscribers) {
      subscribers = new Set();
      this.subscriptions.set(executionId, subscribers);
    }
    subscribers.add(socket);

    console.log(
      `📥 Client subscribed to execution ${executionId}. ` +
        `Subscribers: ${subscribers.size}`
    );

    // Send confirmation
    this.sendMessage(socket, {
      type: 'subscribed',
      executionId,
    });
  }

  /**
   * Handle unsubscribe message
   *
   * @param socket - WebSocket connection
   * @param executionId - Execution ID to unsubscribe from
   */
  private handleUnsubscribe(socket: WebSocket, executionId: string): void {
    if (!executionId || typeof executionId !== 'string') {
      this.sendMessage(socket, {
        type: 'error',
        message: 'Invalid executionId',
        code: 'INVALID_EXECUTION_ID',
      });
      return;
    }

    const client = this.clients.get(socket);
    if (!client) {
      return;
    }

    // Remove from client's subscriptions
    client.subscriptions.delete(executionId);

    // Remove from execution's subscribers
    const subscribers = this.subscriptions.get(executionId);
    if (subscribers) {
      subscribers.delete(socket);
      if (subscribers.size === 0) {
        this.subscriptions.delete(executionId);
      }
      console.log(
        `📤 Client unsubscribed from execution ${executionId}. ` +
          `Remaining subscribers: ${subscribers.size}`
      );
    }

    // Send confirmation
    this.sendMessage(socket, {
      type: 'unsubscribed',
      executionId,
    });
  }

  /**
   * Handle WebSocket disconnection
   *
   * Cleans up client subscriptions and removes from all tracking maps.
   *
   * @param socket - WebSocket connection
   */
  private handleDisconnect(socket: WebSocket): void {
    const client = this.clients.get(socket);
    if (!client) {
      return;
    }

    // Remove from all subscriptions
    const subscriptionIds = Array.from(client.subscriptions);
    for (const executionId of subscriptionIds) {
      const subscribers = this.subscriptions.get(executionId);
      if (subscribers) {
        subscribers.delete(socket);
        if (subscribers.size === 0) {
          this.subscriptions.delete(executionId);
        }
      }
    }

    // Remove client record
    this.clients.delete(socket);
    console.log(`🔌 WebSocket client disconnected. Total clients: ${this.clients.size}`);
  }

  /**
   * Broadcast a workflow event to all subscribed clients
   *
   * Requirements:
   * - 5.1: WHEN a node's status changes, THE Workflow_Execution_Engine SHALL emit a Workflow_Event to all subscribed clients
   *
   * @param event - Workflow event to broadcast
   */
  broadcastEvent(event: WorkflowEvent): void {
    const subscribers = this.subscriptions.get(event.executionId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const message: WorkflowEventMessage = {
      type: 'workflow_event',
      event,
    };

    let successCount = 0;
    let failCount = 0;

    const subscriberArray = Array.from(subscribers);
    for (const socket of subscriberArray) {
      try {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(message));
          successCount++;
        } else {
          // Socket is not open, clean up
          this.handleDisconnect(socket);
          failCount++;
        }
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        this.handleDisconnect(socket);
        failCount++;
      }
    }

    console.log(
      `📡 Broadcast ${event.type} for execution ${event.executionId}: ` +
        `${successCount} sent, ${failCount} failed`
    );
  }

  /**
   * Send a message to a specific WebSocket client
   *
   * @param socket - WebSocket connection
   * @param message - Message to send
   */
  private sendMessage(socket: WebSocket, message: ServerMessage): void {
    try {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }

  /**
   * Start heartbeat monitoring for connection health
   *
   * Periodically checks for stale connections and removes them.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleConnections: WebSocket[] = [];

      const clientEntries = Array.from(this.clients.entries());
      for (const [socket, client] of clientEntries) {
        if (now - client.lastPing > this.CONNECTION_TIMEOUT_MS) {
          staleConnections.push(socket);
        }
      }

      // Clean up stale connections
      for (const socket of staleConnections) {
        console.log('🔌 Closing stale WebSocket connection');
        try {
          socket.close(1000, 'Connection timeout');
        } catch {
          // Ignore close errors
        }
        this.handleDisconnect(socket);
      }

      if (staleConnections.length > 0) {
        console.log(`🧹 Cleaned up ${staleConnections.length} stale connections`);
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get the number of connected clients
   *
   * @returns Number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get the number of subscribers for an execution
   *
   * @param executionId - Execution ID
   * @returns Number of subscribers
   */
  getSubscriberCount(executionId: string): number {
    return this.subscriptions.get(executionId)?.size ?? 0;
  }

  /**
   * Close all connections and clean up resources
   */
  close(): void {
    this.stopHeartbeat();

    // Close all client connections
    const clientSockets = Array.from(this.clients.keys());
    for (const socket of clientSockets) {
      try {
        socket.close(1000, 'Server shutting down');
      } catch {
        // Ignore close errors
      }
    }

    this.clients.clear();
    this.subscriptions.clear();
    console.log('🔌 WebSocket gateway closed');
  }
}

// Singleton instance
export const executionWebSocketGateway = new ExecutionWebSocketGateway();
