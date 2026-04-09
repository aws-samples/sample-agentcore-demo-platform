/**
 * Base Node Executor
 *
 * Abstract base class for all node executors providing common functionality.
 */

import type {
  INodeExecutor,
  NodeExecutionParams,
  NodeExecutionResult,
} from './types.js';
import type { CanvasNodeType } from '../../types/workflow-execution.js';

/**
 * Abstract base class for node executors
 */
export abstract class BaseNodeExecutor implements INodeExecutor {
  /**
   * Node types this executor handles
   */
  abstract readonly supportedTypes: CanvasNodeType[];

  /**
   * Execute the node - must be implemented by subclasses
   */
  abstract execute(params: NodeExecutionParams): Promise<NodeExecutionResult>;

  /**
   * Check if this executor supports the given node type
   */
  supports(nodeType: CanvasNodeType): boolean {
    return this.supportedTypes.includes(nodeType);
  }

  /**
   * Create a success result
   */
  protected success(output: unknown): NodeExecutionResult {
    return { success: true, output };
  }

  /**
   * Create a failure result
   */
  protected failure(error: string, errorStack?: string): NodeExecutionResult {
    return { success: false, error, errorStack };
  }

  /**
   * Create a paused result (for human approval)
   */
  protected paused(output: unknown): NodeExecutionResult {
    return { success: true, output, paused: true };
  }

  /**
   * Substitute variables in a string
   * Supports formats:
   * - {{variableName}} - workflow variables
   * - @{nodeId.output} - parent node outputs
   * - @{nodeId.output.path} - nested paths in parent outputs
   */
  protected substituteVariables(
    text: string,
    context: NodeExecutionParams['context']
  ): string {
    if (!text) return text;

    let result = text;

    // Substitute workflow variables: {{variableName}}
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const value = context.variables.get(varName.trim());
      if (value !== undefined) {
        return typeof value === 'string' ? value : JSON.stringify(value);
      }
      return match; // Keep original if not found
    });

    // Substitute node outputs: @{nodeId.output} or @{nodeId.output.path}
    result = result.replace(/@\{([^}]+)\}/g, (match, reference) => {
      const parts = reference.trim().split('.');
      if (parts.length < 2) return match;

      const nodeId = parts[0];
      const outputPath = parts.slice(1);

      const nodeOutput = context.nodeOutputs.get(nodeId);
      if (nodeOutput === undefined) return match;

      // Navigate the path
      let value: unknown = nodeOutput;
      for (const key of outputPath) {
        if (value && typeof value === 'object' && key in value) {
          value = (value as Record<string, unknown>)[key];
        } else {
          return match; // Path not found
        }
      }

      return typeof value === 'string' ? value : JSON.stringify(value);
    });

    return result;
  }

  /**
   * Get a value from context by reference
   * @param reference - Reference string like "nodeId.output.path"
   * @param context - Execution context
   * @returns The resolved value or undefined
   */
  protected resolveReference(
    reference: string,
    context: NodeExecutionParams['context']
  ): unknown {
    const parts = reference.split('.');
    if (parts.length < 2) return undefined;

    const nodeId = parts[0];
    if (!nodeId) return undefined;
    
    const outputPath = parts.slice(1);

    const nodeOutput = context.nodeOutputs.get(nodeId);
    if (nodeOutput === undefined) return undefined;

    let value: unknown = nodeOutput;
    for (const key of outputPath) {
      if (value && typeof value === 'object' && key && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get metadata from node data with type safety
   */
  protected getMetadata<T>(params: NodeExecutionParams): T | undefined {
    return params.node.data.metadata as T | undefined;
  }

  /**
   * Safely get a string value, returning empty string if undefined
   */
  protected safeString(value: string | undefined): string {
    return value ?? '';
  }
}
