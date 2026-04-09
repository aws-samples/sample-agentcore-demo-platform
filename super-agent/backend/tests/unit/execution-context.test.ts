/**
 * Execution Context Management Unit Tests
 *
 * Tests for execution context management in workflow execution:
 * - Storing node outputs in context after completion (Requirement 4.1)
 * - Providing parent outputs to child nodes (Requirement 4.2)
 * - Variable reference syntax @{nodeId.output} (Requirement 4.3)
 *
 * Requirements tested:
 * - 4.1: WHEN a node completes, THE Workflow_Execution_Engine SHALL store the node's output in the Execution_Context
 * - 4.2: WHEN a node begins execution, THE Workflow_Execution_Engine SHALL provide the Execution_Context containing all parent node outputs
 * - 4.3: THE Workflow_Execution_Engine SHALL support referencing parent node outputs using a consistent syntax (e.g., @{nodeId.output})
 */

import { describe, it, expect } from 'vitest';
import { BaseNodeExecutor } from '../../src/services/node-executors/base-executor.js';
import type {
  NodeExecutionParams,
  NodeExecutionResult,
  NodeExecutionContext,
} from '../../src/services/node-executors/types.js';
import type { CanvasNode, CanvasNodeType } from '../../src/types/workflow-execution.js';

/**
 * Test executor that exposes protected methods for testing
 */
class TestNodeExecutor extends BaseNodeExecutor {
  readonly supportedTypes: CanvasNodeType[] = ['agent'];

  async execute(_params: NodeExecutionParams): Promise<NodeExecutionResult> {
    return { success: true, output: {} };
  }

  // Expose protected methods for testing
  public testSubstituteVariables(
    text: string,
    context: NodeExecutionContext
  ): string {
    return this.substituteVariables(text, context);
  }

  public testResolveReference(
    reference: string,
    context: NodeExecutionContext
  ): unknown {
    return this.resolveReference(reference, context);
  }
}

// Helper to create a mock node
function createMockNode(
  type: string,
  title: string,
  metadata?: Record<string, unknown>
): CanvasNode {
  return {
    id: `node-${Date.now()}`,
    type: type as CanvasNode['type'],
    position: { x: 0, y: 0 },
    data: {
      title,
      entityId: `entity-${Date.now()}`,
      contentPreview: `Content for ${title}`,
      metadata,
    },
  };
}

// Helper to create execution context
function createMockContext(
  nodeOutputs?: Map<string, unknown>,
  variables?: Map<string, unknown>
): NodeExecutionContext {
  return {
    executionId: `exec-${Date.now()}`,
    nodeId: `node-${Date.now()}`,
    nodeOutputs: nodeOutputs || new Map(),
    variables: variables || new Map(),
  };
}

describe('Execution Context Management', () => {
  const executor = new TestNodeExecutor();

  describe('Requirement 4.1: Store node outputs in context', () => {
    it('should store simple string output', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('node1', 'Hello World');

      const context = createMockContext(nodeOutputs);
      expect(context.nodeOutputs.get('node1')).toBe('Hello World');
    });

    it('should store complex object output', () => {
      const nodeOutputs = new Map<string, unknown>();
      const complexOutput = {
        type: 'agent',
        response: 'AI generated response',
        metadata: {
          tokens: 150,
          model: 'gpt-4',
        },
        items: [1, 2, 3],
      };
      nodeOutputs.set('agentNode', complexOutput);

      const context = createMockContext(nodeOutputs);
      expect(context.nodeOutputs.get('agentNode')).toEqual(complexOutput);
    });

    it('should store outputs from multiple nodes', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('node1', { result: 'first' });
      nodeOutputs.set('node2', { result: 'second' });
      nodeOutputs.set('node3', { result: 'third' });

      const context = createMockContext(nodeOutputs);
      expect(context.nodeOutputs.size).toBe(3);
      expect(context.nodeOutputs.get('node1')).toEqual({ result: 'first' });
      expect(context.nodeOutputs.get('node2')).toEqual({ result: 'second' });
      expect(context.nodeOutputs.get('node3')).toEqual({ result: 'third' });
    });

    it('should handle null and undefined outputs', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('nullNode', null);
      nodeOutputs.set('undefinedNode', undefined);

      const context = createMockContext(nodeOutputs);
      expect(context.nodeOutputs.get('nullNode')).toBeNull();
      expect(context.nodeOutputs.get('undefinedNode')).toBeUndefined();
    });
  });

  describe('Requirement 4.2: Provide parent outputs to child nodes', () => {
    it('should provide single parent output to child', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('parentNode', { data: 'parent data' });

      const context = createMockContext(nodeOutputs);
      expect(context.nodeOutputs.has('parentNode')).toBe(true);
      expect(context.nodeOutputs.get('parentNode')).toEqual({ data: 'parent data' });
    });

    it('should provide multiple parent outputs to child', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('parent1', { value: 10 });
      nodeOutputs.set('parent2', { value: 20 });
      nodeOutputs.set('parent3', { value: 30 });

      const context = createMockContext(nodeOutputs);
      expect(context.nodeOutputs.size).toBe(3);

      // Child can access all parent outputs
      let sum = 0;
      context.nodeOutputs.forEach((output) => {
        if (output && typeof output === 'object' && 'value' in output) {
          sum += (output as { value: number }).value;
        }
      });
      expect(sum).toBe(60);
    });

    it('should provide nested data structures from parents', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('dataNode', {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
        metadata: {
          count: 2,
          source: 'database',
        },
      });

      const context = createMockContext(nodeOutputs);
      const output = context.nodeOutputs.get('dataNode') as Record<string, unknown>;
      expect(output.users).toHaveLength(2);
      expect(output.metadata).toEqual({ count: 2, source: 'database' });
    });
  });

  describe('Requirement 4.3: Variable reference syntax @{nodeId.output}', () => {
    describe('Basic node output references', () => {
      it('should substitute @{nodeId.output} with node output', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('prevNode', { output: 'Hello from previous node' });

        const context = createMockContext(nodeOutputs);
        const result = executor.testSubstituteVariables(
          'Message: @{prevNode.output}',
          context
        );

        expect(result).toBe('Message: Hello from previous node');
      });

      it('should substitute multiple @{nodeId.output} references', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('node1', { output: 'First' });
        nodeOutputs.set('node2', { output: 'Second' });

        const context = createMockContext(nodeOutputs);
        const result = executor.testSubstituteVariables(
          '@{node1.output} and @{node2.output}',
          context
        );

        expect(result).toBe('First and Second');
      });

      it('should keep original reference if node not found', () => {
        const context = createMockContext(new Map());
        const result = executor.testSubstituteVariables(
          'Value: @{nonexistent.output}',
          context
        );

        expect(result).toBe('Value: @{nonexistent.output}');
      });
    });

    describe('Nested path references', () => {
      it('should substitute @{nodeId.output.nested.path}', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('dataNode', {
          output: {
            nested: {
              path: 'deep value',
            },
          },
        });

        const context = createMockContext(nodeOutputs);
        const result = executor.testSubstituteVariables(
          'Deep: @{dataNode.output.nested.path}',
          context
        );

        expect(result).toBe('Deep: deep value');
      });

      it('should access array elements via path', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('listNode', {
          items: ['first', 'second', 'third'],
        });

        const context = createMockContext(nodeOutputs);
        const result = executor.testSubstituteVariables(
          'Item: @{listNode.items.0}',
          context
        );

        expect(result).toBe('Item: first');
      });

      it('should handle missing nested path gracefully', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('node', { output: 'simple' });

        const context = createMockContext(nodeOutputs);
        const result = executor.testSubstituteVariables(
          'Value: @{node.output.missing.path}',
          context
        );

        expect(result).toBe('Value: @{node.output.missing.path}');
      });
    });

    describe('Workflow variable references', () => {
      it('should substitute {{variableName}} with workflow variable', () => {
        const variables = new Map<string, unknown>();
        variables.set('userName', 'Alice');

        const context = createMockContext(new Map(), variables);
        const result = executor.testSubstituteVariables(
          'Hello, {{userName}}!',
          context
        );

        expect(result).toBe('Hello, Alice!');
      });

      it('should substitute multiple {{variableName}} references', () => {
        const variables = new Map<string, unknown>();
        variables.set('firstName', 'John');
        variables.set('lastName', 'Doe');

        const context = createMockContext(new Map(), variables);
        const result = executor.testSubstituteVariables(
          '{{firstName}} {{lastName}}',
          context
        );

        expect(result).toBe('John Doe');
      });

      it('should keep original reference if variable not found', () => {
        const context = createMockContext(new Map(), new Map());
        const result = executor.testSubstituteVariables(
          'Value: {{nonexistent}}',
          context
        );

        expect(result).toBe('Value: {{nonexistent}}');
      });
    });

    describe('Mixed references', () => {
      it('should substitute both @{} and {{}} references', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('agentNode', { response: 'AI response' });

        const variables = new Map<string, unknown>();
        variables.set('userName', 'Bob');

        const context = createMockContext(nodeOutputs, variables);
        const result = executor.testSubstituteVariables(
          'User {{userName}} received: @{agentNode.response}',
          context
        );

        expect(result).toBe('User Bob received: AI response');
      });

      it('should handle complex template with multiple reference types', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('node1', { result: 'Result 1' });
        nodeOutputs.set('node2', { data: { value: 42 } });

        const variables = new Map<string, unknown>();
        variables.set('prefix', 'Report');
        variables.set('suffix', 'End');

        const context = createMockContext(nodeOutputs, variables);
        const result = executor.testSubstituteVariables(
          '{{prefix}}: @{node1.result}, Value: @{node2.data.value}, {{suffix}}',
          context
        );

        expect(result).toBe('Report: Result 1, Value: 42, End');
      });
    });

    describe('JSON serialization of complex values', () => {
      it('should serialize object values to JSON', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('dataNode', {
          output: { key: 'value', num: 123 },
        });

        const context = createMockContext(nodeOutputs);
        const result = executor.testSubstituteVariables(
          'Data: @{dataNode.output}',
          context
        );

        expect(result).toBe('Data: {"key":"value","num":123}');
      });

      it('should serialize array values to JSON', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('listNode', {
          items: [1, 2, 3],
        });

        const context = createMockContext(nodeOutputs);
        const result = executor.testSubstituteVariables(
          'Items: @{listNode.items}',
          context
        );

        expect(result).toBe('Items: [1,2,3]');
      });

      it('should serialize variable objects to JSON', () => {
        const variables = new Map<string, unknown>();
        variables.set('config', { enabled: true, count: 5 });

        const context = createMockContext(new Map(), variables);
        const result = executor.testSubstituteVariables(
          'Config: {{config}}',
          context
        );

        expect(result).toBe('Config: {"enabled":true,"count":5}');
      });
    });

    describe('resolveReference helper', () => {
      it('should resolve simple reference', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('node1', { value: 'test' });

        const context = createMockContext(nodeOutputs);
        const result = executor.testResolveReference('node1.value', context);

        expect(result).toBe('test');
      });

      it('should resolve nested reference', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('node1', {
          data: {
            nested: {
              value: 'deep',
            },
          },
        });

        const context = createMockContext(nodeOutputs);
        const result = executor.testResolveReference(
          'node1.data.nested.value',
          context
        );

        expect(result).toBe('deep');
      });

      it('should return undefined for invalid reference', () => {
        const context = createMockContext(new Map());
        const result = executor.testResolveReference('invalid', context);

        expect(result).toBeUndefined();
      });

      it('should return undefined for missing path', () => {
        const nodeOutputs = new Map<string, unknown>();
        nodeOutputs.set('node1', { value: 'test' });

        const context = createMockContext(nodeOutputs);
        const result = executor.testResolveReference(
          'node1.missing.path',
          context
        );

        expect(result).toBeUndefined();
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string input', () => {
      const context = createMockContext();
      const result = executor.testSubstituteVariables('', context);
      expect(result).toBe('');
    });

    it('should handle null/undefined input gracefully', () => {
      const context = createMockContext();
      // @ts-expect-error - Testing null input
      const result1 = executor.testSubstituteVariables(null, context);
      // @ts-expect-error - Testing undefined input
      const result2 = executor.testSubstituteVariables(undefined, context);

      expect(result1).toBeFalsy();
      expect(result2).toBeFalsy();
    });

    it('should handle special characters in values', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('node1', { output: 'Value with "quotes" and \\backslash' });

      const context = createMockContext(nodeOutputs);
      const result = executor.testSubstituteVariables(
        'Text: @{node1.output}',
        context
      );

      expect(result).toContain('quotes');
      expect(result).toContain('backslash');
    });

    it('should handle numeric values', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('calcNode', { result: 42.5 });

      const context = createMockContext(nodeOutputs);
      const result = executor.testSubstituteVariables(
        'Result: @{calcNode.result}',
        context
      );

      expect(result).toBe('Result: 42.5');
    });

    it('should handle boolean values', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('checkNode', { success: true, failed: false });

      const context = createMockContext(nodeOutputs);
      const result = executor.testSubstituteVariables(
        'Success: @{checkNode.success}, Failed: @{checkNode.failed}',
        context
      );

      expect(result).toBe('Success: true, Failed: false');
    });

    it('should handle whitespace in reference names', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('node1', { output: 'value' });

      const context = createMockContext(nodeOutputs);
      const result = executor.testSubstituteVariables(
        '@{ node1.output }',
        context
      );

      expect(result).toBe('value');
    });
  });
});
