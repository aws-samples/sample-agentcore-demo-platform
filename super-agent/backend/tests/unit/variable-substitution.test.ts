/**
 * Variable Substitution Unit Tests
 *
 * Tests for variable substitution in workflow execution:
 * - String variable substitution (Requirement 1.5)
 * - Resource variable substitution (Requirement 1.5)
 * - Mixed variable types (Requirement 1.5)
 *
 * Requirements tested:
 * - 1.5: WHEN an execution request includes workflow variables, THE Workflow_Execution_Engine
 *        SHALL substitute variable values into node configurations before execution
 */

import { describe, it, expect } from 'vitest';
import { BaseNodeExecutor } from '../../src/services/node-executors/base-executor.js';
import type {
  NodeExecutionParams,
  NodeExecutionResult,
  NodeExecutionContext,
} from '../../src/services/node-executors/types.js';
import type {
  CanvasNodeType,
  WorkflowVariableDefinition,
  VariableValue,
} from '../../src/types/workflow-execution.js';

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

/**
 * Helper to extract variable value (mirrors the implementation in workflow-execution.service.ts)
 * This is used to test the extraction logic independently
 */
function extractVariableValue(variable: WorkflowVariableDefinition): unknown {
  const values = variable.value;

  // Handle empty or undefined values
  if (!values || !Array.isArray(values) || values.length === 0) {
    return '';
  }

  // Extract values based on type
  const extractedValues = values.map((v: VariableValue) => {
    if (v.type === 'text') {
      // String variable - return the text value
      return v.text ?? '';
    } else if (v.type === 'resource' && v.resource) {
      // Resource variable - return the resource metadata
      return {
        name: v.resource.name,
        fileType: v.resource.fileType,
        fileId: v.resource.fileId,
        storageKey: v.resource.storageKey,
        entityId: v.resource.entityId,
      };
    }
    return '';
  });

  // If single value (isSingle flag or only one value), return directly
  if (variable.isSingle || extractedValues.length === 1) {
    return extractedValues[0];
  }

  // Return array for multiple values
  return extractedValues;
}

describe('Variable Substitution - Requirement 1.5', () => {
  const executor = new TestNodeExecutor();

  describe('String variable extraction', () => {
    it('should extract single text variable value', () => {
      const variable: WorkflowVariableDefinition = {
        variableId: 'var-1',
        name: 'userName',
        value: [{ type: 'text', text: 'Alice' }],
        isSingle: true,
      };

      const result = extractVariableValue(variable);
      expect(result).toBe('Alice');
    });

    it('should extract multiple text variable values as array', () => {
      const variable: WorkflowVariableDefinition = {
        variableId: 'var-2',
        name: 'tags',
        value: [
          { type: 'text', text: 'tag1' },
          { type: 'text', text: 'tag2' },
          { type: 'text', text: 'tag3' },
        ],
        isSingle: false,
      };

      const result = extractVariableValue(variable);
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle empty text value', () => {
      const variable: WorkflowVariableDefinition = {
        variableId: 'var-3',
        name: 'emptyVar',
        value: [{ type: 'text', text: '' }],
        isSingle: true,
      };

      const result = extractVariableValue(variable);
      expect(result).toBe('');
    });

    it('should handle undefined text value', () => {
      const variable: WorkflowVariableDefinition = {
        variableId: 'var-4',
        name: 'undefinedVar',
        value: [{ type: 'text' }],
        isSingle: true,
      };

      const result = extractVariableValue(variable);
      expect(result).toBe('');
    });

    it('should handle empty value array', () => {
      const variable: WorkflowVariableDefinition = {
        variableId: 'var-5',
        name: 'noValues',
        value: [],
        isSingle: true,
      };

      const result = extractVariableValue(variable);
      expect(result).toBe('');
    });
  });

  describe('Resource variable extraction', () => {
    it('should extract single resource variable value', () => {
      const variable: WorkflowVariableDefinition = {
        variableId: 'var-6',
        name: 'document',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'report.pdf',
              fileType: 'document',
              fileId: 'file-123',
              storageKey: 'uploads/report.pdf',
              entityId: 'entity-456',
            },
          },
        ],
        isSingle: true,
        variableType: 'resource',
      };

      const result = extractVariableValue(variable);
      expect(result).toEqual({
        name: 'report.pdf',
        fileType: 'document',
        fileId: 'file-123',
        storageKey: 'uploads/report.pdf',
        entityId: 'entity-456',
      });
    });

    it('should extract multiple resource variable values as array', () => {
      const variable: WorkflowVariableDefinition = {
        variableId: 'var-7',
        name: 'images',
        value: [
          {
            type: 'resource',
            resource: {
              name: 'image1.png',
              fileType: 'image',
              fileId: 'file-1',
            },
          },
          {
            type: 'resource',
            resource: {
              name: 'image2.png',
              fileType: 'image',
              fileId: 'file-2',
            },
          },
        ],
        isSingle: false,
        variableType: 'resource',
      };

      const result = extractVariableValue(variable);
      expect(result).toEqual([
        {
          name: 'image1.png',
          fileType: 'image',
          fileId: 'file-1',
          storageKey: undefined,
          entityId: undefined,
        },
        {
          name: 'image2.png',
          fileType: 'image',
          fileId: 'file-2',
          storageKey: undefined,
          entityId: undefined,
        },
      ]);
    });

    it('should handle resource with missing resource object', () => {
      const variable: WorkflowVariableDefinition = {
        variableId: 'var-8',
        name: 'missingResource',
        value: [{ type: 'resource' }],
        isSingle: true,
      };

      const result = extractVariableValue(variable);
      expect(result).toBe('');
    });
  });

  describe('Variable substitution in text', () => {
    it('should substitute string variable in query', () => {
      const variables = new Map<string, unknown>();
      variables.set('userName', 'Alice');

      const context = createMockContext(new Map(), variables);
      const result = executor.testSubstituteVariables(
        'Hello {{userName}}, how can I help you?',
        context
      );

      expect(result).toBe('Hello Alice, how can I help you?');
    });

    it('should substitute multiple variables in query', () => {
      const variables = new Map<string, unknown>();
      variables.set('firstName', 'John');
      variables.set('lastName', 'Doe');
      variables.set('company', 'Acme Corp');

      const context = createMockContext(new Map(), variables);
      const result = executor.testSubstituteVariables(
        'Dear {{firstName}} {{lastName}} from {{company}},',
        context
      );

      expect(result).toBe('Dear John Doe from Acme Corp,');
    });

    it('should serialize resource variable to JSON when substituted', () => {
      const variables = new Map<string, unknown>();
      variables.set('document', {
        name: 'report.pdf',
        fileType: 'document',
        fileId: 'file-123',
      });

      const context = createMockContext(new Map(), variables);
      const result = executor.testSubstituteVariables(
        'Processing document: {{document}}',
        context
      );

      expect(result).toContain('report.pdf');
      expect(result).toContain('file-123');
    });

    it('should handle array variable substitution', () => {
      const variables = new Map<string, unknown>();
      variables.set('tags', ['important', 'urgent', 'review']);

      const context = createMockContext(new Map(), variables);
      const result = executor.testSubstituteVariables(
        'Tags: {{tags}}',
        context
      );

      expect(result).toBe('Tags: ["important","urgent","review"]');
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

  describe('Mixed variable and node output substitution', () => {
    it('should substitute both variables and node outputs', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('agentNode', { response: 'AI generated content' });

      const variables = new Map<string, unknown>();
      variables.set('userName', 'Bob');

      const context = createMockContext(nodeOutputs, variables);
      const result = executor.testSubstituteVariables(
        'User {{userName}} received: @{agentNode.response}',
        context
      );

      expect(result).toBe('User Bob received: AI generated content');
    });

    it('should handle complex template with multiple reference types', () => {
      const nodeOutputs = new Map<string, unknown>();
      nodeOutputs.set('dataNode', { count: 42, items: ['a', 'b', 'c'] });

      const variables = new Map<string, unknown>();
      variables.set('title', 'Report');
      variables.set('author', 'Alice');

      const context = createMockContext(nodeOutputs, variables);
      const result = executor.testSubstituteVariables(
        '{{title}} by {{author}}: Found @{dataNode.count} items - @{dataNode.items}',
        context
      );

      expect(result).toBe('Report by Alice: Found 42 items - ["a","b","c"]');
    });
  });

  describe('Edge cases for variable substitution', () => {
    it('should handle whitespace in variable names', () => {
      const variables = new Map<string, unknown>();
      variables.set('myVar', 'value');

      const context = createMockContext(new Map(), variables);
      const result = executor.testSubstituteVariables(
        'Value: {{ myVar }}',
        context
      );

      expect(result).toBe('Value: value');
    });

    it('should handle special characters in variable values', () => {
      const variables = new Map<string, unknown>();
      variables.set('query', 'SELECT * FROM users WHERE name = "John"');

      const context = createMockContext(new Map(), variables);
      const result = executor.testSubstituteVariables(
        'Query: {{query}}',
        context
      );

      expect(result).toContain('SELECT * FROM users');
      expect(result).toContain('"John"');
    });

    it('should handle newlines in variable values', () => {
      const variables = new Map<string, unknown>();
      variables.set('multiline', 'Line 1\nLine 2\nLine 3');

      const context = createMockContext(new Map(), variables);
      const result = executor.testSubstituteVariables(
        'Content:\n{{multiline}}',
        context
      );

      expect(result).toBe('Content:\nLine 1\nLine 2\nLine 3');
    });

    it('should handle numeric variable values', () => {
      const variables = new Map<string, unknown>();
      variables.set('count', 100);
      variables.set('price', 19.99);

      const context = createMockContext(new Map(), variables);
      const result = executor.testSubstituteVariables(
        'Count: {{count}}, Price: ${{price}}',
        context
      );

      expect(result).toBe('Count: 100, Price: $19.99');
    });

    it('should handle boolean variable values', () => {
      const variables = new Map<string, unknown>();
      variables.set('enabled', true);
      variables.set('disabled', false);

      const context = createMockContext(new Map(), variables);
      const result = executor.testSubstituteVariables(
        'Enabled: {{enabled}}, Disabled: {{disabled}}',
        context
      );

      expect(result).toBe('Enabled: true, Disabled: false');
    });

    it('should handle null variable values', () => {
      const variables = new Map<string, unknown>();
      variables.set('nullVar', null);

      const context = createMockContext(new Map(), variables);
      const result = executor.testSubstituteVariables(
        'Value: {{nullVar}}',
        context
      );

      expect(result).toBe('Value: null');
    });
  });
});
