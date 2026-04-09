/**
 * Node Executors Unit Tests
 *
 * Tests for the node executor classes that handle different node types
 * in workflow execution.
 *
 * Requirements tested:
 * - 3.1: Agent node execution with AI service
 * - 3.2: Action node execution
 * - 3.3: Condition node evaluation
 * - 3.4: Human approval node pause/resume
 * - 3.5: Document node generation
 * - 3.6: Code artifact node generation/execution
 * - 3.7: Start/end node pass-through
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  nodeExecutorRegistry,
  PassThroughNodeExecutor,
  ConditionNodeExecutor,
  ActionNodeExecutor,
  HumanApprovalNodeExecutor,
  DocumentNodeExecutor,
  CodeArtifactNodeExecutor,
  type NodeExecutionContext,
} from '../../src/services/node-executors/index.js';
import type { CanvasNode } from '../../src/types/workflow-execution.js';

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

describe('NodeExecutorRegistry', () => {
  it('should have all required executors registered', () => {
    const stats = nodeExecutorRegistry.getStats();
    
    expect(stats.totalExecutors).toBeGreaterThanOrEqual(6);
    expect(stats.supportedTypes).toContain('start');
    expect(stats.supportedTypes).toContain('end');
    expect(stats.supportedTypes).toContain('agent');
    expect(stats.supportedTypes).toContain('condition');
    expect(stats.supportedTypes).toContain('action');
    expect(stats.supportedTypes).toContain('humanApproval');
    expect(stats.supportedTypes).toContain('document');
    expect(stats.supportedTypes).toContain('codeArtifact');
  });

  it('should return correct executor for each node type', () => {
    expect(nodeExecutorRegistry.getExecutor('start')).toBeInstanceOf(PassThroughNodeExecutor);
    expect(nodeExecutorRegistry.getExecutor('end')).toBeInstanceOf(PassThroughNodeExecutor);
    expect(nodeExecutorRegistry.getExecutor('condition')).toBeInstanceOf(ConditionNodeExecutor);
    expect(nodeExecutorRegistry.getExecutor('action')).toBeInstanceOf(ActionNodeExecutor);
    expect(nodeExecutorRegistry.getExecutor('humanApproval')).toBeInstanceOf(HumanApprovalNodeExecutor);
    expect(nodeExecutorRegistry.getExecutor('document')).toBeInstanceOf(DocumentNodeExecutor);
    expect(nodeExecutorRegistry.getExecutor('codeArtifact')).toBeInstanceOf(CodeArtifactNodeExecutor);
  });

  it('should handle unknown node types gracefully', async () => {
    const node = createMockNode('unknownType', 'Unknown Node');
    const context = createMockContext();

    const result = await nodeExecutorRegistry.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('type', 'passThrough');
    expect(result.output).toHaveProperty('nodeType', 'unknownType');
  });
});

describe('PassThroughNodeExecutor', () => {
  const executor = new PassThroughNodeExecutor();

  it('should support start and end node types', () => {
    expect(executor.supports('start')).toBe(true);
    expect(executor.supports('end')).toBe(true);
    expect(executor.supports('agent')).toBe(false);
  });

  it('should execute start node successfully', async () => {
    const node = createMockNode('start', 'Start');
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('type', 'start');
    expect(result.output).toHaveProperty('passThrough', true);
  });

  it('should execute end node and collect workflow results', async () => {
    const nodeOutputs = new Map<string, unknown>([
      ['node1', { result: 'output1' }],
      ['node2', { result: 'output2' }],
    ]);
    const node = createMockNode('end', 'End');
    const context = createMockContext(nodeOutputs);

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('type', 'end');
    expect(result.output).toHaveProperty('passThrough', true);
    expect(result.output).toHaveProperty('workflowResults');
    expect((result.output as Record<string, unknown>).workflowResults).toHaveProperty('node1');
    expect((result.output as Record<string, unknown>).workflowResults).toHaveProperty('node2');
  });
});

describe('ConditionNodeExecutor', () => {
  const executor = new ConditionNodeExecutor();

  it('should support condition node type', () => {
    expect(executor.supports('condition')).toBe(true);
    expect(executor.supports('agent')).toBe(false);
  });

  it('should evaluate simple true condition', async () => {
    const node = createMockNode('condition', 'Check True', {
      condition: 'true',
      trueBranch: 'branch-true',
      falseBranch: 'branch-false',
    });
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('branch', 'true');
    expect(result.output).toHaveProperty('result', true);
    expect(result.activeBranch).toBe('branch-true');
  });

  it('should evaluate simple false condition', async () => {
    const node = createMockNode('condition', 'Check False', {
      condition: 'false',
      trueBranch: 'branch-true',
      falseBranch: 'branch-false',
    });
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('branch', 'false');
    expect(result.output).toHaveProperty('result', false);
    expect(result.activeBranch).toBe('branch-false');
  });

  it('should evaluate condition with node output reference', async () => {
    const nodeOutputs = new Map<string, unknown>([
      ['prevNode', { success: true, value: 42 }],
    ]);
    const node = createMockNode('condition', 'Check Output', {
      condition: '@{prevNode.success}',
    });
    const context = createMockContext(nodeOutputs);

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('result', true);
  });

  it('should evaluate condition with variable reference', async () => {
    const variables = new Map<string, unknown>([
      ['isEnabled', true],
    ]);
    const node = createMockNode('condition', 'Check Variable', {
      condition: '{{isEnabled}}',
    });
    const context = createMockContext(new Map(), variables);

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('result', true);
  });

  it('should evaluate condition rules with equals operator', async () => {
    const nodeOutputs = new Map<string, unknown>([
      ['prevNode', { status: 'completed' }],
    ]);
    const node = createMockNode('condition', 'Check Rules', {
      rules: [
        { field: 'prevNode.status', operator: 'equals', value: 'completed' },
      ],
      logic: 'and',
    });
    const context = createMockContext(nodeOutputs);

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('result', true);
  });

  it('should evaluate condition rules with is_empty operator', async () => {
    const nodeOutputs = new Map<string, unknown>([
      ['prevNode', { items: [] }],
    ]);
    const node = createMockNode('condition', 'Check Empty', {
      rules: [
        { field: 'prevNode.items', operator: 'is_empty' },
      ],
      logic: 'and',
    });
    const context = createMockContext(nodeOutputs);

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('result', true);
  });
});

describe('ActionNodeExecutor', () => {
  const executor = new ActionNodeExecutor();

  it('should support action node type', () => {
    expect(executor.supports('action')).toBe(true);
    expect(executor.supports('condition')).toBe(false);
  });

  it('should execute custom action successfully', async () => {
    const node = createMockNode('action', 'Custom Action', {
      actionType: 'custom',
      config: { key: 'value' },
    });
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('type', 'action');
    expect(result.output).toHaveProperty('actionType', 'custom');
  });

  it('should execute transform action with mapping', async () => {
    const nodeOutputs = new Map<string, unknown>([
      ['prevNode', { name: 'John', age: 30 }],
    ]);
    const node = createMockNode('action', 'Transform', {
      actionType: 'transform',
      transformConfig: {
        type: 'map',
        mapping: {
          userName: 'prevNode.name',
          userAge: 'prevNode.age',
        },
      },
    });
    const context = createMockContext(nodeOutputs);

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('actionType', 'transform');
    expect(result.output).toHaveProperty('result');
    expect((result.output as Record<string, unknown>).result).toHaveProperty('userName', 'John');
    expect((result.output as Record<string, unknown>).result).toHaveProperty('userAge', 30);
  });

  it('should fail API call without URL', async () => {
    const node = createMockNode('action', 'API Call', {
      actionType: 'api_call',
      apiConfig: {},
    });
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(false);
    expect(result.error).toContain('URL');
  });
});

describe('HumanApprovalNodeExecutor', () => {
  const executor = new HumanApprovalNodeExecutor();

  it('should support humanApproval node type', () => {
    expect(executor.supports('humanApproval')).toBe(true);
    expect(executor.supports('action')).toBe(false);
  });

  it('should return approved status when pre-approved', async () => {
    const node = createMockNode('humanApproval', 'Approval', {
      status: 'approved',
      approverId: 'user-123',
      approverName: 'John Doe',
    });
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('status', 'approved');
    expect(result.output).toHaveProperty('approved', true);
  });

  it('should return failure when rejected', async () => {
    const node = createMockNode('humanApproval', 'Approval', {
      status: 'rejected',
      rejectionReason: 'Not authorized',
    });
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(false);
    expect(result.error).toContain('rejected');
  });

  it('should auto-approve when autoApprove is true', async () => {
    const node = createMockNode('humanApproval', 'Approval', {
      autoApprove: true,
    });
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('autoApproved', true);
  });

  it('should pause execution when pending approval', async () => {
    const node = createMockNode('humanApproval', 'Approval', {
      instructions: 'Please review and approve',
    });
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.paused).toBe(true);
    expect(result.output).toHaveProperty('status', 'pending');
  });
});

describe('DocumentNodeExecutor', () => {
  const executor = new DocumentNodeExecutor();

  it('should support document node type', () => {
    expect(executor.supports('document')).toBe(true);
    expect(executor.supports('action')).toBe(false);
  });

  it('should generate document from content preview', async () => {
    const node = createMockNode('document', 'My Document');
    node.data.contentPreview = 'This is the document content';
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('type', 'document');
    expect(result.output).toHaveProperty('content');
    expect((result.output as Record<string, unknown>).content).toContain('document content');
  });

  it('should generate document from template with variable substitution', async () => {
    const variables = new Map<string, unknown>([
      ['userName', 'Alice'],
      ['projectName', 'Super Agent'],
    ]);
    const node = createMockNode('document', 'Report', {
      template: 'Hello {{userName}}, welcome to {{projectName}}!',
    });
    const context = createMockContext(new Map(), variables);

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect((result.output as Record<string, unknown>).content).toContain('Hello Alice');
    expect((result.output as Record<string, unknown>).content).toContain('Super Agent');
  });

  it('should include word and character count', async () => {
    const node = createMockNode('document', 'Doc');
    node.data.contentPreview = 'One two three four five';
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('wordCount', 5);
    expect(result.output).toHaveProperty('characterCount');
  });
});

describe('CodeArtifactNodeExecutor', () => {
  const executor = new CodeArtifactNodeExecutor();

  it('should support codeArtifact node type', () => {
    expect(executor.supports('codeArtifact')).toBe(true);
    expect(executor.supports('document')).toBe(false);
  });

  it('should generate code from content preview', async () => {
    const node = createMockNode('codeArtifact', 'Code');
    node.data.contentPreview = 'const x = 42;';
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('type', 'codeArtifact');
    expect(result.output).toHaveProperty('code', 'const x = 42;');
  });

  it('should generate code from template with variable substitution', async () => {
    const variables = new Map<string, unknown>([
      ['functionName', 'greet'],
      ['message', 'Hello World'],
    ]);
    const node = createMockNode('codeArtifact', 'Function', {
      template: 'function {{functionName}}() { return "{{message}}"; }',
      language: 'javascript',
    });
    const context = createMockContext(new Map(), variables);

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect((result.output as Record<string, unknown>).code).toContain('function greet');
    expect((result.output as Record<string, unknown>).code).toContain('Hello World');
  });

  it('should include line count', async () => {
    const node = createMockNode('codeArtifact', 'Code');
    node.data.contentPreview = 'line1\nline2\nline3';
    const context = createMockContext();

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('lineCount', 3);
  });
});

describe('Variable Substitution', () => {
  const executor = new PassThroughNodeExecutor();

  it('should substitute workflow variables in start node', async () => {
    const variables = new Map<string, unknown>([
      ['inputVar', 'test value'],
    ]);
    const node = createMockNode('start', 'Start', {
      inputVariables: [
        { variableId: 'v1', name: 'inputVar', value: 'default' },
      ],
    });
    const context = createMockContext(new Map(), variables);

    const result = await executor.execute({ node, context });

    expect(result.success).toBe(true);
    expect(result.output).toHaveProperty('workflowVariables');
    expect((result.output as Record<string, unknown>).workflowVariables).toHaveProperty('inputVar', 'test value');
  });
});
