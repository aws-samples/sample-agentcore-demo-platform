/**
 * Event-WebSocket Bridge
 *
 * Connects the WorkflowExecutionService EventEmitter to the ExecutionWebSocketGateway.
 * This bridge listens for workflow events emitted by the execution service and
 * forwards them to the WebSocket gateway for broadcasting to subscribed clients.
 *
 * Requirements:
 * - 5.1: WHEN a node's status changes, THE Workflow_Execution_Engine SHALL emit a Workflow_Event to all subscribed clients
 *
 * @module setup/event-websocket-bridge
 */

import { workflowExecutionService } from '../services/workflow-execution.service.js';
import { executionWebSocketGateway } from '../websocket/execution.gateway.js';
import type { WorkflowEvent } from '../types/workflow-execution.js';

/**
 * Flag to track if the bridge has been initialized
 */
let isInitialized = false;

/**
 * Initialize the event-websocket bridge
 *
 * This function sets up a listener on the WorkflowExecutionService's EventEmitter
 * that forwards all workflow events to the WebSocket gateway for broadcasting
 * to subscribed clients.
 *
 * The bridge listens for the 'workflow:event' event which is emitted for all
 * workflow-related events (node:started, node:completed, node:failed, etc.).
 *
 * Requirements:
 * - 5.1: WHEN a node's status changes, THE Workflow_Execution_Engine SHALL emit a Workflow_Event to all subscribed clients
 *
 * @returns void
 */
export function initializeEventWebSocketBridge(): void {
  // Prevent double initialization
  if (isInitialized) {
    console.log('⚠️ Event-WebSocket bridge already initialized');
    return;
  }

  // Listen for all workflow events and forward to WebSocket gateway
  workflowExecutionService.on('workflow:event', (event: WorkflowEvent) => {
    // Forward the event to the WebSocket gateway for broadcasting
    executionWebSocketGateway.broadcastEvent(event);
  });

  isInitialized = true;
  console.log('🔗 Event-WebSocket bridge initialized - workflow events will be broadcast to WebSocket clients');
}

/**
 * Check if the bridge has been initialized
 *
 * @returns True if the bridge has been initialized
 */
export function isBridgeInitialized(): boolean {
  return isInitialized;
}

/**
 * Reset the bridge initialization state (for testing purposes)
 *
 * @internal
 */
export function resetBridgeForTesting(): void {
  isInitialized = false;
  workflowExecutionService.removeAllListeners('workflow:event');
}
