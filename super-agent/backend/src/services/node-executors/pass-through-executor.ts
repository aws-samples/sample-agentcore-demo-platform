/**
 * Pass-Through Node Executor
 *
 * Handles start and end nodes as pass-through nodes that mark workflow boundaries.
 *
 * Requirement 3.7: THE Node_Executor SHALL handle start and end nodes as
 * pass-through nodes that mark workflow boundaries.
 */

import { BaseNodeExecutor } from './base-executor.js';
import type { NodeExecutionParams, NodeExecutionResult } from './types.js';
import type { CanvasNodeType } from '../../types/workflow-execution.js';

/**
 * Start node metadata
 */
interface StartNodeMeta {
  inputVariables?: Array<{
    variableId: string;
    name: string;
    value: unknown;
  }>;
}

/**
 * End node metadata
 */
interface EndNodeMeta {
  outputMapping?: Record<string, string>;
  status?: 'success' | 'failure';
}

/**
 * Pass-through executor for start and end nodes
 *
 * These nodes mark workflow boundaries and don't perform any computation.
 * Start nodes may define input variables, and end nodes may define output mappings.
 */
export class PassThroughNodeExecutor extends BaseNodeExecutor {
  readonly supportedTypes: CanvasNodeType[] = ['start', 'end'];

  async execute(params: NodeExecutionParams): Promise<NodeExecutionResult> {
    const { node } = params;
    const nodeType = node.type;

    if (nodeType === 'start') {
      return this.executeStartNode(params);
    } else if (nodeType === 'end') {
      return this.executeEndNode(params);
    }

    // Default pass-through
    return this.success({
      type: 'passThrough',
      nodeType,
      title: node.data.title,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Execute start node
   *
   * Start nodes mark the beginning of workflow execution.
   * They may define input variables that are available to downstream nodes.
   */
  private async executeStartNode(
    params: NodeExecutionParams
  ): Promise<NodeExecutionResult> {
    const { node, context } = params;
    const metadata = this.getMetadata<StartNodeMeta>(params);

    // Collect input variables if defined
    const inputVariables: Record<string, unknown> = {};
    if (metadata?.inputVariables) {
      for (const variable of metadata.inputVariables) {
        inputVariables[variable.name] = variable.value;
      }
    }

    // Also include workflow variables from context
    const workflowVariables: Record<string, unknown> = {};
    context.variables.forEach((value, key) => {
      workflowVariables[key] = value;
    });

    return this.success({
      type: 'start',
      title: node.data.title,
      passThrough: true,
      inputVariables,
      workflowVariables,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Execute end node
   *
   * End nodes mark the completion of workflow execution.
   * They may define output mappings to collect results from upstream nodes.
   */
  private async executeEndNode(
    params: NodeExecutionParams
  ): Promise<NodeExecutionResult> {
    const { node, context } = params;
    const metadata = this.getMetadata<EndNodeMeta>(params);

    // Collect outputs based on output mapping
    const collectedOutputs: Record<string, unknown> = {};
    if (metadata?.outputMapping) {
      for (const [outputKey, reference] of Object.entries(metadata.outputMapping)) {
        const value = this.resolveReference(reference, context);
        if (value !== undefined) {
          collectedOutputs[outputKey] = value;
        }
      }
    }

    // Collect all parent outputs as workflow results
    const workflowResults: Record<string, unknown> = {};
    context.nodeOutputs.forEach((value, nodeId) => {
      workflowResults[nodeId] = value;
    });

    return this.success({
      type: 'end',
      title: node.data.title,
      passThrough: true,
      status: metadata?.status || 'success',
      collectedOutputs,
      workflowResults,
      timestamp: new Date().toISOString(),
    });
  }
}
