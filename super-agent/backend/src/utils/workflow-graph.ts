/**
 * Workflow Graph Utilities
 *
 * Provides graph operations for workflow validation and execution:
 * - Cycle detection
 * - Root node identification
 * - Topological sorting
 * - Graph building from canvas data
 *
 * Requirements: 1.2, 1.3, 2.1 - Workflow validation and structure analysis
 */

import type {
  CanvasData,
  CanvasNode,
  CanvasEdge,
  WorkflowNode,
  WorkflowValidationResult,
  WorkflowValidationError,
  PreparedNodeExecution,
  PrepareNodeExecutionsResult,
  WorkflowVariableDefinition,
} from '../types/workflow-execution.js';

// ============================================================================
// Graph Building
// ============================================================================

/**
 * Build adjacency lists from canvas edges
 *
 * @param nodes - Canvas nodes
 * @param edges - Canvas edges
 * @returns Object with children and parents maps
 */
export function buildAdjacencyLists(
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): {
  children: Map<string, string[]>;
  parents: Map<string, string[]>;
} {
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();

  // Initialize maps for all nodes
  for (const node of nodes) {
    children.set(node.id, []);
    parents.set(node.id, []);
  }

  // Build adjacency lists from edges
  for (const edge of edges) {
    const childList = children.get(edge.source);
    if (childList) {
      childList.push(edge.target);
    }

    const parentList = parents.get(edge.target);
    if (parentList) {
      parentList.push(edge.source);
    }
  }

  return { children, parents };
}

/**
 * Build workflow node graph from canvas data
 *
 * @param canvasData - Canvas data with nodes and edges
 * @returns Map of node ID to WorkflowNode
 */
export function buildNodeGraph(canvasData: CanvasData): Map<string, WorkflowNode> {
  const { nodes, edges } = canvasData;
  const { children, parents } = buildAdjacencyLists(nodes, edges);
  const nodeGraph = new Map<string, WorkflowNode>();

  for (const node of nodes) {
    const workflowNode: WorkflowNode = {
      nodeId: node.id,
      nodeType: node.type,
      node,
      entityId: node.data.entityId,
      title: node.data.title,
      status: 'init',
      parentNodeIds: parents.get(node.id) || [],
      childNodeIds: children.get(node.id) || [],
    };
    nodeGraph.set(node.id, workflowNode);
  }

  return nodeGraph;
}

// ============================================================================
// Cycle Detection
// ============================================================================

/**
 * Detect cycles in the workflow graph using DFS
 *
 * @param nodes - Canvas nodes
 * @param edges - Canvas edges
 * @returns Array of node IDs involved in cycles (empty if no cycles)
 */
export function detectCycles(nodes: CanvasNode[], edges: CanvasEdge[]): string[] {
  const { children } = buildAdjacencyLists(nodes, edges);
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Track visited state: 0 = unvisited, 1 = visiting, 2 = visited
  const state = new Map<string, number>();
  const nodeIdArray = Array.from(nodeIds);
  for (const id of nodeIdArray) {
    state.set(id, 0);
  }

  const cycleNodes: string[] = [];

  function dfs(nodeId: string, path: Set<string>): boolean {
    const currentState = state.get(nodeId);

    if (currentState === 2) {
      // Already fully processed
      return false;
    }

    if (currentState === 1) {
      // Found a cycle - this node is in the current path
      return true;
    }

    // Mark as visiting
    state.set(nodeId, 1);
    path.add(nodeId);

    const childNodes = children.get(nodeId) || [];
    for (const childId of childNodes) {
      if (dfs(childId, path)) {
        // Part of a cycle
        cycleNodes.push(nodeId);
        return true;
      }
    }

    // Mark as visited
    state.set(nodeId, 2);
    path.delete(nodeId);
    return false;
  }

  // Run DFS from each unvisited node
  for (const nodeId of nodeIdArray) {
    if (state.get(nodeId) === 0) {
      dfs(nodeId, new Set());
    }
  }

  return cycleNodes;
}

// ============================================================================
// Root Node Identification
// ============================================================================

/**
 * Find root nodes (nodes with no incoming edges)
 *
 * Property 4: Root Node Identification
 * For any workflow graph, the set of identified root nodes SHALL equal
 * the set of nodes with zero incoming edges.
 *
 * @param nodes - Canvas nodes
 * @param edges - Canvas edges
 * @returns Array of root node IDs
 */
export function findRootNodes(nodes: CanvasNode[], edges: CanvasEdge[]): string[] {
  const { parents } = buildAdjacencyLists(nodes, edges);
  const rootNodes: string[] = [];

  for (const node of nodes) {
    const parentList = parents.get(node.id) || [];
    if (parentList.length === 0) {
      rootNodes.push(node.id);
    }
  }

  return rootNodes;
}

/**
 * Find start nodes (nodes of type 'start' or root nodes if no start nodes exist)
 *
 * @param nodes - Canvas nodes
 * @param edges - Canvas edges
 * @returns Array of start node IDs
 */
export function findStartNodes(nodes: CanvasNode[], edges: CanvasEdge[]): string[] {
  // First, look for explicit start nodes
  const startTypeNodes = nodes.filter((n) => n.type === 'start').map((n) => n.id);

  if (startTypeNodes.length > 0) {
    return startTypeNodes;
  }

  // Fall back to root nodes (nodes with no incoming edges)
  return findRootNodes(nodes, edges);
}

/**
 * Find end nodes (nodes of type 'end' or leaf nodes if no end nodes exist)
 *
 * @param nodes - Canvas nodes
 * @param edges - Canvas edges
 * @returns Array of end node IDs
 */
export function findEndNodes(nodes: CanvasNode[], edges: CanvasEdge[]): string[] {
  // First, look for explicit end nodes
  const endTypeNodes = nodes.filter((n) => n.type === 'end').map((n) => n.id);

  if (endTypeNodes.length > 0) {
    return endTypeNodes;
  }

  // Fall back to leaf nodes (nodes with no outgoing edges)
  const { children } = buildAdjacencyLists(nodes, edges);
  const leafNodes: string[] = [];

  for (const node of nodes) {
    const childList = children.get(node.id) || [];
    if (childList.length === 0) {
      leafNodes.push(node.id);
    }
  }

  return leafNodes;
}

// ============================================================================
// Topological Sort
// ============================================================================

/**
 * Perform topological sort on the workflow graph
 *
 * Returns nodes in execution order (parents before children).
 * Returns null if the graph has cycles.
 *
 * @param nodes - Canvas nodes
 * @param edges - Canvas edges
 * @returns Array of node IDs in topological order, or null if cycles exist
 */
export function topologicalSort(
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): string[] | null {
  const { children, parents } = buildAdjacencyLists(nodes, edges);

  // Calculate in-degree for each node
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    inDegree.set(node.id, (parents.get(node.id) || []).length);
  }

  // Start with nodes that have no incoming edges
  const queue: string[] = [];
  for (const node of nodes) {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  }

  const sorted: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeId);

    // Reduce in-degree of children
    const childNodes = children.get(nodeId) || [];
    for (const childId of childNodes) {
      const newDegree = (inDegree.get(childId) || 0) - 1;
      inDegree.set(childId, newDegree);

      if (newDegree === 0) {
        queue.push(childId);
      }
    }
  }

  // If we couldn't process all nodes, there's a cycle
  if (sorted.length !== nodes.length) {
    return null;
  }

  return sorted;
}

// ============================================================================
// Workflow Validation
// ============================================================================

/**
 * Validate workflow structure
 *
 * Property 1: Workflow Validation Correctness
 * For any workflow canvas data, if the workflow structure is invalid
 * (no nodes, cycles, disconnected nodes), the execution engine SHALL
 * reject it with a descriptive error.
 *
 * @param canvasData - Canvas data to validate
 * @returns Validation result with errors if any
 */
export function validateWorkflow(canvasData: CanvasData): WorkflowValidationResult {
  const errors: WorkflowValidationError[] = [];
  const { nodes, edges } = canvasData;

  // Check for empty workflow
  if (!nodes || nodes.length === 0) {
    errors.push({
      code: 'EMPTY_WORKFLOW',
      message: 'Workflow must have at least one node',
    });
    return {
      valid: false,
      errors,
      startNodes: [],
      endNodes: [],
      nodeCount: 0,
      edgeCount: edges?.length || 0,
    };
  }

  // Check for cycles
  const cycleNodes = detectCycles(nodes, edges);
  if (cycleNodes.length > 0) {
    errors.push({
      code: 'CYCLE_DETECTED',
      message: `Workflow contains cycles involving nodes: ${cycleNodes.join(', ')}`,
      nodeId: cycleNodes[0],
    });
  }

  // Find start and end nodes
  const startNodes = findStartNodes(nodes, edges);
  const endNodes = findEndNodes(nodes, edges);

  // Check for start nodes
  if (startNodes.length === 0) {
    errors.push({
      code: 'NO_START_NODES',
      message: 'Workflow must have at least one start node or root node',
    });
  }

  // Validate edge references
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        code: 'INVALID_EDGE_SOURCE',
        message: `Edge ${edge.id} references non-existent source node: ${edge.source}`,
      });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        code: 'INVALID_EDGE_TARGET',
        message: `Edge ${edge.id} references non-existent target node: ${edge.target}`,
      });
    }
  }

  // Check for disconnected nodes (nodes not reachable from any start node)
  if (errors.length === 0 && startNodes.length > 0) {
    const reachable = new Set<string>();
    const queue = [...startNodes];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (reachable.has(nodeId)) continue;
      reachable.add(nodeId);

      const { children } = buildAdjacencyLists(nodes, edges);
      const childNodes = children.get(nodeId) || [];
      for (const childId of childNodes) {
        if (!reachable.has(childId)) {
          queue.push(childId);
        }
      }
    }

    // Find disconnected nodes
    const disconnected = nodes.filter((n) => !reachable.has(n.id));
    if (disconnected.length > 0) {
      // This is a warning, not an error - disconnected nodes won't execute
      // but the workflow can still run
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    startNodes,
    endNodes,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}

// ============================================================================
// Node Execution Preparation
// ============================================================================

/**
 * Prepare node executions from canvas data
 *
 * Creates execution records for all nodes in topological order.
 *
 * @param _executionId - The execution ID (reserved for future use)
 * @param canvasData - Canvas data
 * @param _variables - Workflow variables (reserved for future use)
 * @param startNodeIds - Optional specific start node IDs
 * @returns Prepared node executions and start nodes
 */
export function prepareNodeExecutions(
  _executionId: string,
  canvasData: CanvasData,
  _variables?: WorkflowVariableDefinition[],
  startNodeIds?: string[]
): PrepareNodeExecutionsResult {
  const { nodes, edges } = canvasData;

  // Build the node graph
  const nodeGraph = buildNodeGraph(canvasData);

  // Get topological order
  const sortedNodeIds = topologicalSort(nodes, edges);
  if (!sortedNodeIds) {
    throw new Error('Cannot prepare executions for workflow with cycles');
  }

  // Determine start nodes
  let startNodes: string[];
  if (startNodeIds && startNodeIds.length > 0) {
    // Validate provided start nodes exist
    const nodeIds = new Set(nodes.map((n) => n.id));
    const invalidStartNodes = startNodeIds.filter((id) => !nodeIds.has(id));
    if (invalidStartNodes.length > 0) {
      throw new Error(`Invalid start node IDs: ${invalidStartNodes.join(', ')}`);
    }
    startNodes = startNodeIds;
  } else {
    startNodes = findStartNodes(nodes, edges);
  }

  // Create node execution records in topological order
  const nodeExecutions: PreparedNodeExecution[] = sortedNodeIds.map((nodeId) => {
    const workflowNode = nodeGraph.get(nodeId)!;
    return {
      node_id: nodeId,
      node_type: workflowNode.nodeType,
      node_data: workflowNode.node,
      status: 'init' as const,
      progress: 0,
    };
  });

  return {
    nodeExecutions,
    startNodes,
    nodeGraph,
  };
}

/**
 * Generate a unique execution ID
 */
export function generateExecutionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `exec_${timestamp}_${random}`;
}
