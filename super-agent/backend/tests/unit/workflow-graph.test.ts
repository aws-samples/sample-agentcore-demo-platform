/**
 * Unit tests for workflow graph utilities
 *
 * Tests the core graph operations used in workflow execution:
 * - Cycle detection
 * - Root node identification
 * - Topological sorting
 * - Workflow validation
 */

import { describe, it, expect } from 'vitest';
import {
  detectCycles,
  findRootNodes,
  findStartNodes,
  topologicalSort,
  validateWorkflow,
  buildNodeGraph,
  prepareNodeExecutions,
  generateExecutionId,
} from '../../src/utils/workflow-graph.js';
import type { CanvasNode, CanvasEdge, CanvasData } from '../../src/types/workflow-execution.js';

// Helper to create a test node
function createNode(id: string, type: string = 'agent'): CanvasNode {
  return {
    id,
    type: type as CanvasNode['type'],
    position: { x: 0, y: 0 },
    data: {
      title: `Node ${id}`,
      entityId: `entity-${id}`,
    },
  };
}

// Helper to create a test edge
function createEdge(source: string, target: string): CanvasEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
  };
}

describe('Workflow Graph Utilities', () => {
  describe('detectCycles', () => {
    it('should return empty array for acyclic graph', () => {
      const nodes = [createNode('1'), createNode('2'), createNode('3')];
      const edges = [createEdge('1', '2'), createEdge('2', '3')];

      const cycles = detectCycles(nodes, edges);
      expect(cycles).toEqual([]);
    });

    it('should detect simple cycle', () => {
      const nodes = [createNode('1'), createNode('2'), createNode('3')];
      const edges = [
        createEdge('1', '2'),
        createEdge('2', '3'),
        createEdge('3', '1'), // Creates cycle
      ];

      const cycles = detectCycles(nodes, edges);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should detect self-loop', () => {
      const nodes = [createNode('1')];
      const edges = [createEdge('1', '1')]; // Self-loop

      const cycles = detectCycles(nodes, edges);
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should handle empty graph', () => {
      const cycles = detectCycles([], []);
      expect(cycles).toEqual([]);
    });
  });

  describe('findRootNodes', () => {
    it('should find nodes with no incoming edges', () => {
      const nodes = [createNode('1'), createNode('2'), createNode('3')];
      const edges = [createEdge('1', '2'), createEdge('1', '3')];

      const roots = findRootNodes(nodes, edges);
      expect(roots).toEqual(['1']);
    });

    it('should find multiple root nodes', () => {
      const nodes = [createNode('1'), createNode('2'), createNode('3')];
      const edges = [createEdge('1', '3'), createEdge('2', '3')];

      const roots = findRootNodes(nodes, edges);
      expect(roots).toContain('1');
      expect(roots).toContain('2');
      expect(roots).not.toContain('3');
    });

    it('should return all nodes when no edges', () => {
      const nodes = [createNode('1'), createNode('2')];
      const edges: CanvasEdge[] = [];

      const roots = findRootNodes(nodes, edges);
      expect(roots).toContain('1');
      expect(roots).toContain('2');
    });
  });

  describe('findStartNodes', () => {
    it('should prefer start type nodes', () => {
      const nodes = [
        createNode('1', 'start'),
        createNode('2', 'agent'),
        createNode('3', 'end'),
      ];
      const edges = [createEdge('1', '2'), createEdge('2', '3')];

      const starts = findStartNodes(nodes, edges);
      expect(starts).toEqual(['1']);
    });

    it('should fall back to root nodes when no start type', () => {
      const nodes = [createNode('1', 'agent'), createNode('2', 'agent')];
      const edges = [createEdge('1', '2')];

      const starts = findStartNodes(nodes, edges);
      expect(starts).toEqual(['1']);
    });
  });

  describe('topologicalSort', () => {
    it('should sort nodes in dependency order', () => {
      const nodes = [createNode('1'), createNode('2'), createNode('3')];
      const edges = [createEdge('1', '2'), createEdge('2', '3')];

      const sorted = topologicalSort(nodes, edges);
      expect(sorted).not.toBeNull();
      expect(sorted!.indexOf('1')).toBeLessThan(sorted!.indexOf('2'));
      expect(sorted!.indexOf('2')).toBeLessThan(sorted!.indexOf('3'));
    });

    it('should return null for cyclic graph', () => {
      const nodes = [createNode('1'), createNode('2')];
      const edges = [createEdge('1', '2'), createEdge('2', '1')];

      const sorted = topologicalSort(nodes, edges);
      expect(sorted).toBeNull();
    });

    it('should handle diamond dependency', () => {
      const nodes = [
        createNode('1'),
        createNode('2'),
        createNode('3'),
        createNode('4'),
      ];
      const edges = [
        createEdge('1', '2'),
        createEdge('1', '3'),
        createEdge('2', '4'),
        createEdge('3', '4'),
      ];

      const sorted = topologicalSort(nodes, edges);
      expect(sorted).not.toBeNull();
      expect(sorted!.indexOf('1')).toBeLessThan(sorted!.indexOf('2'));
      expect(sorted!.indexOf('1')).toBeLessThan(sorted!.indexOf('3'));
      expect(sorted!.indexOf('2')).toBeLessThan(sorted!.indexOf('4'));
      expect(sorted!.indexOf('3')).toBeLessThan(sorted!.indexOf('4'));
    });
  });

  describe('validateWorkflow', () => {
    it('should validate correct workflow', () => {
      const canvasData: CanvasData = {
        nodes: [
          createNode('1', 'start'),
          createNode('2', 'agent'),
          createNode('3', 'end'),
        ],
        edges: [createEdge('1', '2'), createEdge('2', '3')],
      };

      const result = validateWorkflow(canvasData);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.startNodes).toContain('1');
      expect(result.endNodes).toContain('3');
    });

    it('should reject empty workflow', () => {
      const canvasData: CanvasData = {
        nodes: [],
        edges: [],
      };

      const result = validateWorkflow(canvasData);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'EMPTY_WORKFLOW')).toBe(true);
    });

    it('should reject workflow with cycles', () => {
      const canvasData: CanvasData = {
        nodes: [createNode('1'), createNode('2')],
        edges: [createEdge('1', '2'), createEdge('2', '1')],
      };

      const result = validateWorkflow(canvasData);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'CYCLE_DETECTED')).toBe(true);
    });

    it('should reject workflow with invalid edge references', () => {
      const canvasData: CanvasData = {
        nodes: [createNode('1')],
        edges: [createEdge('1', 'nonexistent')],
      };

      const result = validateWorkflow(canvasData);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_EDGE_TARGET')).toBe(true);
    });
  });

  describe('buildNodeGraph', () => {
    it('should build graph with parent and child relationships', () => {
      const canvasData: CanvasData = {
        nodes: [createNode('1'), createNode('2'), createNode('3')],
        edges: [createEdge('1', '2'), createEdge('2', '3')],
      };

      const graph = buildNodeGraph(canvasData);

      expect(graph.get('1')?.childNodeIds).toContain('2');
      expect(graph.get('1')?.parentNodeIds).toHaveLength(0);

      expect(graph.get('2')?.parentNodeIds).toContain('1');
      expect(graph.get('2')?.childNodeIds).toContain('3');

      expect(graph.get('3')?.parentNodeIds).toContain('2');
      expect(graph.get('3')?.childNodeIds).toHaveLength(0);
    });
  });

  describe('prepareNodeExecutions', () => {
    it('should prepare executions in topological order', () => {
      const canvasData: CanvasData = {
        nodes: [
          createNode('1', 'start'),
          createNode('2', 'agent'),
          createNode('3', 'end'),
        ],
        edges: [createEdge('1', '2'), createEdge('2', '3')],
      };

      const result = prepareNodeExecutions('exec-1', canvasData);

      expect(result.nodeExecutions).toHaveLength(3);
      expect(result.startNodes).toContain('1');

      // Verify topological order
      const nodeIds = result.nodeExecutions.map((ne) => ne.node_id);
      expect(nodeIds.indexOf('1')).toBeLessThan(nodeIds.indexOf('2'));
      expect(nodeIds.indexOf('2')).toBeLessThan(nodeIds.indexOf('3'));
    });

    it('should use provided start nodes', () => {
      const canvasData: CanvasData = {
        nodes: [createNode('1'), createNode('2')],
        edges: [createEdge('1', '2')],
      };

      const result = prepareNodeExecutions('exec-1', canvasData, undefined, ['2']);
      expect(result.startNodes).toEqual(['2']);
    });

    it('should throw for invalid start node IDs', () => {
      const canvasData: CanvasData = {
        nodes: [createNode('1')],
        edges: [],
      };

      expect(() =>
        prepareNodeExecutions('exec-1', canvasData, undefined, ['nonexistent'])
      ).toThrow('Invalid start node IDs');
    });
  });

  describe('generateExecutionId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateExecutionId();
      const id2 = generateExecutionId();

      expect(id1).not.toEqual(id2);
      expect(id1).toMatch(/^exec_/);
      expect(id2).toMatch(/^exec_/);
    });
  });
});
