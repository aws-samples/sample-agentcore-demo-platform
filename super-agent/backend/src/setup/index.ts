/**
 * Setup Module
 *
 * Contains initialization functions for connecting various components
 * of the application during startup.
 *
 * @module setup
 */

export {
  initializeEventWebSocketBridge,
  isBridgeInitialized,
  resetBridgeForTesting,
} from './event-websocket-bridge.js';

export {
  initializeWorkflowQueues,
  shutdownWorkflowQueues,
  isWorkflowQueuesInitialized,
} from './workflow-queue-setup.js';

export {
  startScheduleProcessor,
  stopScheduleProcessor,
} from './schedule-processor.js';
