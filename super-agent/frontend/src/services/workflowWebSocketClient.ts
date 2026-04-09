/**
 * WebSocket Client for Workflow Execution Events
 *
 * This client handles WebSocket connections for real-time workflow execution events.
 * It connects to the backend WebSocket gateway at /ws/executions and manages
 * subscriptions to specific execution IDs.
 *
 * Requirements:
 * - 8.2: WHEN the execution starts, THE frontend SHALL establish a WebSocket connection to receive real-time events
 *
 * Features:
 * - Automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
 * - Multiple subscriptions per connection
 * - Heartbeat ping every 25 seconds to keep connection alive
 * - Connection state management (connecting, connected, disconnected)
 *
 * @module services/workflowWebSocketClient
 */

import type { WorkflowEvent } from '@/types/canvas/workflow';

// ============================================================================
// Types
// ============================================================================

/**
 * Connection state for the WebSocket client
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

/**
 * Client message types sent to the server
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
 * Server message types received from the server
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
 * Event callback for workflow events
 */
export type WorkflowEventCallback = (event: WorkflowEvent) => void;

/**
 * Connection state change callback
 */
export type ConnectionStateCallback = (state: ConnectionState) => void;

/**
 * Error callback
 */
export type ErrorCallback = (error: Error) => void;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Reconnection configuration with exponential backoff
 */
const RECONNECT_CONFIG = {
  /** Initial delay in milliseconds */
  initialDelay: 1000,
  /** Maximum delay in milliseconds */
  maxDelay: 30000,
  /** Backoff multiplier */
  multiplier: 2,
  /** Maximum reconnection attempts (0 = unlimited) */
  maxAttempts: 0,
};

/**
 * Heartbeat configuration
 */
const HEARTBEAT_CONFIG = {
  /** Interval between heartbeat pings in milliseconds (25 seconds) */
  interval: 25000,
  /** Timeout for pong response in milliseconds */
  timeout: 10000,
};

// ============================================================================
// WebSocket Client Implementation
// ============================================================================

/**
 * WebSocket client for workflow execution events
 *
 * Manages a single WebSocket connection to the backend and handles
 * subscriptions to multiple execution IDs.
 */
export class WorkflowWebSocketClient {
  /** WebSocket connection */
  private socket: WebSocket | null = null;

  /** Current connection state */
  private _connectionState: ConnectionState = 'disconnected';

  /** Active subscriptions (executionId -> Set of callbacks) */
  private subscriptions: Map<string, Set<WorkflowEventCallback>> = new Map();

  /** Pending subscriptions (to be sent after connection) */
  private pendingSubscriptions: Set<string> = new Set();

  /** Connection state change listeners */
  private connectionStateListeners: Set<ConnectionStateCallback> = new Set();

  /** Error listeners */
  private errorListeners: Set<ErrorCallback> = new Set();

  /** Reconnection attempt count */
  private reconnectAttempts = 0;

  /** Reconnection timeout handle */
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Heartbeat interval handle */
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /** Heartbeat timeout handle */
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Whether the client is intentionally disconnecting */
  private isIntentionalDisconnect = false;

  /** WebSocket URL */
  private wsUrl: string | null = null;

  /**
   * Get the current connection state
   */
  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  /**
   * Check if the client is connected
   */
  get isConnected(): boolean {
    return this._connectionState === 'connected';
  }

  /**
   * Get the WebSocket URL from environment configuration
   * Converts http/https to ws/wss
   */
  private getWebSocketUrl(): string {
    if (this.wsUrl) {
      return this.wsUrl;
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
    
    // Convert http(s) to ws(s)
    let wsUrl = baseUrl.replace(/^http/, 'ws');
    
    // Ensure the URL ends without a trailing slash
    wsUrl = wsUrl.replace(/\/$/, '');
    
    // Add the WebSocket endpoint
    this.wsUrl = `${wsUrl}/ws/executions`;
    
    return this.wsUrl;
  }

  /**
   * Set the connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this._connectionState === state) {
      return;
    }

    this._connectionState = state;
    console.log(`[WebSocket] Connection state changed to: ${state}`);

    // Notify listeners
    this.connectionStateListeners.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        console.error('[WebSocket] Error in connection state listener:', error);
      }
    });
  }

  /**
   * Emit an error to all error listeners
   */
  private emitError(error: Error): void {
    console.error('[WebSocket] Error:', error.message);
    
    this.errorListeners.forEach((callback) => {
      try {
        callback(error);
      } catch (err) {
        console.error('[WebSocket] Error in error listener:', err);
      }
    });
  }

  /**
   * Connect to the WebSocket server
   *
   * @returns Promise that resolves when connected
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Already connected or connecting
      if (this._connectionState === 'connected') {
        resolve();
        return;
      }

      if (this._connectionState === 'connecting') {
        // Wait for connection to complete
        const checkConnection = () => {
          if (this._connectionState === 'connected') {
            resolve();
          } else if (this._connectionState === 'disconnected') {
            reject(new Error('Connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      this.isIntentionalDisconnect = false;
      this.setConnectionState('connecting');

      try {
        const url = this.getWebSocketUrl();
        console.log(`[WebSocket] Connecting to ${url}`);

        this.socket = new WebSocket(url);

        // Connection opened
        this.socket.onopen = () => {
          console.log('[WebSocket] Connected');
          this.setConnectionState('connected');
          this.reconnectAttempts = 0;
          
          // Start heartbeat
          this.startHeartbeat();
          
          // Send pending subscriptions
          this.sendPendingSubscriptions();
          
          resolve();
        };

        // Message received
        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        // Connection closed
        this.socket.onclose = (event) => {
          console.log(`[WebSocket] Closed: code=${event.code}, reason=${event.reason}`);
          this.handleDisconnect();
          
          if (this._connectionState === 'connecting') {
            reject(new Error(`Connection closed: ${event.reason || 'Unknown reason'}`));
          }
        };

        // Connection error
        this.socket.onerror = (event) => {
          console.error('[WebSocket] Error:', event);
          const error = new Error('WebSocket connection error');
          this.emitError(error);
          
          if (this._connectionState === 'connecting') {
            reject(error);
          }
        };
      } catch (error) {
        this.setConnectionState('disconnected');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    console.log('[WebSocket] Disconnecting');
    this.isIntentionalDisconnect = true;
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Cancel reconnection
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Close socket
    if (this.socket) {
      try {
        this.socket.close(1000, 'Client disconnecting');
      } catch {
        // Ignore close errors
      }
      this.socket = null;
    }
    
    this.setConnectionState('disconnected');
  }

  /**
   * Handle disconnection and attempt reconnection
   */
  private handleDisconnect(): void {
    this.stopHeartbeat();
    this.socket = null;
    this.setConnectionState('disconnected');

    // Don't reconnect if intentionally disconnected
    if (this.isIntentionalDisconnect) {
      return;
    }

    // Don't reconnect if no active subscriptions
    if (this.subscriptions.size === 0) {
      return;
    }

    // Schedule reconnection
    this.scheduleReconnect();
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    // Check max attempts
    if (
      RECONNECT_CONFIG.maxAttempts > 0 &&
      this.reconnectAttempts >= RECONNECT_CONFIG.maxAttempts
    ) {
      console.log('[WebSocket] Max reconnection attempts reached');
      this.emitError(new Error('Max reconnection attempts reached'));
      return;
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      RECONNECT_CONFIG.initialDelay * Math.pow(RECONNECT_CONFIG.multiplier, this.reconnectAttempts),
      RECONNECT_CONFIG.maxDelay
    );

    this.reconnectAttempts++;
    console.log(`[WebSocket] Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      
      try {
        await this.connect();
      } catch (error) {
        console.error('[WebSocket] Reconnection failed:', error);
        // handleDisconnect will schedule another attempt
      }
    }, delay);
  }

  /**
   * Send pending subscriptions after connection
   */
  private sendPendingSubscriptions(): void {
    // Re-subscribe to all active subscriptions
    this.subscriptions.forEach((_, executionId) => {
      this.sendSubscribe(executionId);
    });

    // Send any pending subscriptions
    this.pendingSubscriptions.forEach((executionId) => {
      this.sendSubscribe(executionId);
    });
    this.pendingSubscriptions.clear();
  }

  /**
   * Send a message to the server
   */
  private sendMessage(message: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send message: not connected');
      return;
    }

    try {
      this.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error);
    }
  }

  /**
   * Send a subscribe message
   */
  private sendSubscribe(executionId: string): void {
    this.sendMessage({ type: 'subscribe', executionId });
  }

  /**
   * Send an unsubscribe message
   */
  private sendUnsubscribe(executionId: string): void {
    this.sendMessage({ type: 'unsubscribe', executionId });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as ServerMessage;

      switch (message.type) {
        case 'subscribed':
          console.log(`[WebSocket] Subscribed to execution ${message.executionId}`);
          break;

        case 'unsubscribed':
          console.log(`[WebSocket] Unsubscribed from execution ${message.executionId}`);
          break;

        case 'pong':
          this.handlePong();
          break;

        case 'workflow_event':
          this.handleWorkflowEvent(message.event);
          break;

        case 'error':
          console.error(`[WebSocket] Server error: ${message.message} (${message.code})`);
          this.emitError(new Error(`Server error: ${message.message}`));
          break;

        default:
          console.warn('[WebSocket] Unknown message type:', (message as { type: string }).type);
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }

  /**
   * Handle a workflow event from the server
   */
  private handleWorkflowEvent(event: WorkflowEvent): void {
    const callbacks = this.subscriptions.get(event.executionId);
    if (!callbacks || callbacks.size === 0) {
      return;
    }

    // Convert timestamp string to Date if needed
    const normalizedEvent: WorkflowEvent = {
      ...event,
      timestamp: event.timestamp instanceof Date 
        ? event.timestamp 
        : new Date(event.timestamp as unknown as string),
    };

    // Notify all callbacks for this execution
    callbacks.forEach((callback) => {
      try {
        callback(normalizedEvent);
      } catch (error) {
        console.error('[WebSocket] Error in event callback:', error);
      }
    });
  }

  /**
   * Start heartbeat ping interval
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      this.sendPing();
    }, HEARTBEAT_CONFIG.interval);
  }

  /**
   * Stop heartbeat ping interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Send a ping message and set timeout for pong response
   */
  private sendPing(): void {
    if (!this.isConnected) {
      return;
    }

    this.sendMessage({ type: 'ping' });

    // Set timeout for pong response
    this.heartbeatTimeout = setTimeout(() => {
      console.warn('[WebSocket] Heartbeat timeout - no pong received');
      // Force reconnection
      if (this.socket) {
        this.socket.close(4000, 'Heartbeat timeout');
      }
    }, HEARTBEAT_CONFIG.timeout);
  }

  /**
   * Handle pong response
   */
  private handlePong(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Subscribe to execution events
   *
   * @param executionId - Execution ID to subscribe to
   * @param callback - Callback function for events
   * @returns Unsubscribe function
   */
  subscribe(executionId: string, callback: WorkflowEventCallback): () => void {
    // Get or create callback set for this execution
    let callbacks = this.subscriptions.get(executionId);
    if (!callbacks) {
      callbacks = new Set();
      this.subscriptions.set(executionId, callbacks);
    }

    // Add callback
    callbacks.add(callback);

    // Send subscribe message if connected
    if (this.isConnected) {
      this.sendSubscribe(executionId);
    } else {
      // Queue for when connected
      this.pendingSubscriptions.add(executionId);
      
      // Auto-connect if not connected
      if (this._connectionState === 'disconnected') {
        this.connect().catch((error) => {
          console.error('[WebSocket] Auto-connect failed:', error);
        });
      }
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(executionId, callback);
    };
  }

  /**
   * Unsubscribe from execution events
   *
   * @param executionId - Execution ID to unsubscribe from
   * @param callback - Callback function to remove (optional, removes all if not provided)
   */
  unsubscribe(executionId: string, callback?: WorkflowEventCallback): void {
    const callbacks = this.subscriptions.get(executionId);
    if (!callbacks) {
      return;
    }

    if (callback) {
      // Remove specific callback
      callbacks.delete(callback);
    } else {
      // Remove all callbacks
      callbacks.clear();
    }

    // If no more callbacks, unsubscribe from server
    if (callbacks.size === 0) {
      this.subscriptions.delete(executionId);
      this.pendingSubscriptions.delete(executionId);

      if (this.isConnected) {
        this.sendUnsubscribe(executionId);
      }

      // Disconnect if no more subscriptions
      if (this.subscriptions.size === 0 && this.isConnected) {
        console.log('[WebSocket] No more subscriptions, disconnecting');
        this.disconnect();
      }
    }
  }

  /**
   * Register a connection state change listener
   *
   * @param callback - Callback function for state changes
   * @returns Unregister function
   */
  onConnectionStateChange(callback: ConnectionStateCallback): () => void {
    this.connectionStateListeners.add(callback);
    
    // Immediately call with current state
    callback(this._connectionState);

    return () => {
      this.connectionStateListeners.delete(callback);
    };
  }

  /**
   * Register an error listener
   *
   * @param callback - Callback function for errors
   * @returns Unregister function
   */
  onError(callback: ErrorCallback): () => void {
    this.errorListeners.add(callback);

    return () => {
      this.errorListeners.delete(callback);
    };
  }

  /**
   * Get the number of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Check if subscribed to a specific execution
   */
  isSubscribed(executionId: string): boolean {
    return this.subscriptions.has(executionId);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Singleton instance of the WebSocket client
 */
export const workflowWebSocketClient = new WorkflowWebSocketClient();

export default workflowWebSocketClient;
