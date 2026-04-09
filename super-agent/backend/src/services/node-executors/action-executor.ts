/**
 * Action Node Executor
 *
 * Performs configured actions such as API calls, data transformations, etc.
 *
 * Requirement 3.2: WHEN executing an action node, THE Node_Executor SHALL
 * perform the configured action (API call, data transformation, etc.)
 */

import { BaseNodeExecutor } from './base-executor.js';
import type {
  NodeExecutionParams,
  NodeExecutionResult,
  ActionType,
  ApiCallConfig,
  TransformConfig,
  NotificationConfig,
} from './types.js';
import type { CanvasNodeType } from '../../types/workflow-execution.js';

/**
 * Action node metadata structure
 */
interface ActionNodeMeta {
  /** Action type */
  actionType?: ActionType;
  /** Action configuration */
  config?: Record<string, unknown>;
  /** API call configuration */
  apiConfig?: ApiCallConfig;
  /** Transform configuration */
  transformConfig?: TransformConfig;
  /** Notification configuration */
  notificationConfig?: NotificationConfig;
}

/**
 * Action node executor
 *
 * Supports multiple action types:
 * - api_call: Make HTTP requests
 * - transform: Transform data
 * - notification: Send notifications
 * - database: Database operations (placeholder)
 * - custom: Custom actions
 */
export class ActionNodeExecutor extends BaseNodeExecutor {
  readonly supportedTypes: CanvasNodeType[] = ['action'];

  async execute(params: NodeExecutionParams): Promise<NodeExecutionResult> {
    const { node, context } = params;
    const metadata = this.getMetadata<ActionNodeMeta>(params);
    const actionType = metadata?.actionType || 'custom';

    try {
      switch (actionType) {
        case 'api_call':
          return await this.executeApiCall(params, metadata);

        case 'transform':
          return await this.executeTransform(params, metadata);

        case 'notification':
          return await this.executeNotification(params, metadata);

        case 'database':
          return await this.executeDatabaseAction(params, metadata);

        case 'custom':
        default:
          return await this.executeCustomAction(params, metadata);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error(`Action node execution failed: ${errorMessage}`, {
        nodeId: node.id,
        executionId: context.executionId,
        actionType,
        error,
      });

      return this.failure(`Action execution failed: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Execute an API call action
   */
  private async executeApiCall(
    params: NodeExecutionParams,
    metadata: ActionNodeMeta | undefined
  ): Promise<NodeExecutionResult> {
    const { node, context } = params;
    const apiConfig = metadata?.apiConfig || (metadata?.config as unknown as ApiCallConfig | undefined);

    if (!apiConfig?.url) {
      return this.failure('API call action requires a URL');
    }

    // Substitute variables in URL and body
    const url = this.substituteVariables(apiConfig.url, context);
    let body = apiConfig.body;
    if (typeof body === 'string') {
      body = this.substituteVariables(body, context);
    }

    // Substitute variables in headers
    const headers: Record<string, string> = {};
    if (apiConfig.headers) {
      for (const [key, value] of Object.entries(apiConfig.headers)) {
        headers[key] = this.substituteVariables(value, context);
      }
    }

    // Make the HTTP request
    const controller = new AbortController();
    const timeout = apiConfig.timeout || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: apiConfig.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.text();
      let parsedResponse: unknown;
      try {
        parsedResponse = JSON.parse(responseData);
      } catch {
        parsedResponse = responseData;
      }

      if (!response.ok) {
        return this.failure(
          `API call failed with status ${response.status}: ${responseData}`
        );
      }

      return this.success({
        type: 'action',
        actionType: 'api_call',
        title: node.data.title,
        url,
        method: apiConfig.method || 'GET',
        status: response.status,
        response: parsedResponse,
        result: parsedResponse,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Execute a data transformation action
   */
  private async executeTransform(
    params: NodeExecutionParams,
    metadata: ActionNodeMeta | undefined
  ): Promise<NodeExecutionResult> {
    const { node, context } = params;
    const transformConfig = metadata?.transformConfig || (metadata?.config as unknown as TransformConfig | undefined);

    // Get input data from parent nodes
    const inputData = this.collectParentOutputs(context);

    let result: unknown;

    switch (transformConfig?.type) {
      case 'map':
        result = this.applyMapping(inputData, transformConfig.mapping || {});
        break;

      case 'filter':
        result = this.applyFilter(inputData, transformConfig.expression);
        break;

      case 'reduce':
        result = this.applyReduce(inputData, transformConfig.expression);
        break;

      case 'custom':
        result = this.applyCustomTransform(inputData, transformConfig.expression);
        break;

      default:
        // Pass through input data
        result = inputData;
    }

    return this.success({
      type: 'action',
      actionType: 'transform',
      title: node.data.title,
      transformType: transformConfig?.type || 'passthrough',
      input: inputData,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Collect outputs from all parent nodes
   */
  private collectParentOutputs(context: NodeExecutionParams['context']): unknown {
    const outputs: Record<string, unknown> = {};
    context.nodeOutputs.forEach((value, nodeId) => {
      outputs[nodeId] = value;
    });
    return outputs;
  }

  /**
   * Apply field mapping transformation
   */
  private applyMapping(
    data: unknown,
    mapping: Record<string, string>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [targetKey, sourcePath] of Object.entries(mapping)) {
      const value = this.getNestedValue(data, sourcePath);
      if (value !== undefined) {
        result[targetKey] = value;
      }
    }

    return result;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Apply filter transformation
   */
  private applyFilter(data: unknown, expression?: string): unknown {
    if (!Array.isArray(data)) {
      return data;
    }

    if (!expression) {
      return data.filter(Boolean);
    }

    // Simple filter expression evaluation
    return data.filter((item) => {
      try {
        // Replace 'item' placeholder with actual value
        const evalExpr = expression.replace(/\bitem\b/g, JSON.stringify(item));
        // eslint-disable-next-line no-eval
        return Boolean(eval(evalExpr));
      } catch {
        return true;
      }
    });
  }

  /**
   * Apply reduce transformation
   */
  private applyReduce(data: unknown, expression?: string): unknown {
    if (!Array.isArray(data)) {
      return data;
    }

    if (!expression) {
      // Default: concatenate strings or sum numbers
      if (data.every((item) => typeof item === 'number')) {
        return data.reduce((acc: number, item: number) => acc + item, 0);
      }
      return data.join(', ');
    }

    // Custom reduce expression (simplified)
    try {
      // eslint-disable-next-line no-eval
      const reduceFn = eval(`(acc, item) => ${expression}`);
      return data.reduce(reduceFn, null);
    } catch {
      return data;
    }
  }

  /**
   * Apply custom transformation
   */
  private applyCustomTransform(data: unknown, expression?: string): unknown {
    if (!expression) {
      return data;
    }

    try {
      // Replace 'data' placeholder with actual value
      const evalExpr = expression.replace(/\bdata\b/g, JSON.stringify(data));
      // eslint-disable-next-line no-eval
      return eval(evalExpr);
    } catch (error) {
      console.warn('Custom transform failed:', error);
      return data;
    }
  }

  /**
   * Execute a notification action
   */
  private async executeNotification(
    params: NodeExecutionParams,
    metadata: ActionNodeMeta | undefined
  ): Promise<NodeExecutionResult> {
    const { node, context } = params;
    const notificationConfig =
      metadata?.notificationConfig || (metadata?.config as unknown as NotificationConfig | undefined);

    if (!notificationConfig?.message) {
      return this.failure('Notification action requires a message');
    }

    // Substitute variables in message
    const message = this.substituteVariables(notificationConfig.message, context);
    const subject = notificationConfig.subject
      ? this.substituteVariables(notificationConfig.subject, context)
      : undefined;

    // Log notification (actual implementation would send via email/slack/webhook)
    console.log(`📧 Notification [${notificationConfig.type}]:`, {
      recipient: notificationConfig.recipient,
      subject,
      message,
    });

    // Placeholder: In production, integrate with actual notification services
    // For now, just log and return success
    return this.success({
      type: 'action',
      actionType: 'notification',
      title: node.data.title,
      notificationType: notificationConfig.type,
      recipient: notificationConfig.recipient,
      subject,
      message,
      sent: true,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Execute a database action (placeholder)
   */
  private async executeDatabaseAction(
    params: NodeExecutionParams,
    metadata: ActionNodeMeta | undefined
  ): Promise<NodeExecutionResult> {
    const { node } = params;

    // Placeholder implementation
    // In production, this would connect to a database and execute queries
    console.log('📊 Database action (placeholder):', {
      nodeId: node.id,
      config: metadata?.config,
    });

    return this.success({
      type: 'action',
      actionType: 'database',
      title: node.data.title,
      message: 'Database action executed (placeholder)',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Execute a custom action
   */
  private async executeCustomAction(
    params: NodeExecutionParams,
    metadata: ActionNodeMeta | undefined
  ): Promise<NodeExecutionResult> {
    const { node, context } = params;

    // Collect parent outputs as input
    const inputData = this.collectParentOutputs(context);

    return this.success({
      type: 'action',
      actionType: 'custom',
      title: node.data.title,
      config: metadata?.config,
      input: inputData,
      result: `Custom action "${node.data.title}" executed successfully`,
      timestamp: new Date().toISOString(),
    });
  }
}
