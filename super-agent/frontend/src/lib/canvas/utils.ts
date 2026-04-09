/**
 * Canvas Utility Functions
 * 
 * General utilities for canvas operations.
 */

import type { 
  CanvasNode, 
  CanvasEdge, 
  CanvasData,
  CanvasNodeType 
} from '../../types/canvas';

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generates a generic unique ID
 */
export const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generates a unique node ID
 */
export const generateNodeId = (): string => {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generates a unique edge ID
 */
export const generateEdgeId = (source: string, target: string): string => {
  return `edge_${source}_${target}_${Math.random().toString(36).substr(2, 5)}`;
};

/**
 * Generates a unique entity ID
 */
export const generateEntityId = (): string => {
  return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================================================
// Canvas Data Operations
// ============================================================================

/**
 * Creates an empty canvas data structure
 */
export const createEmptyCanvasData = (): CanvasData => ({
  nodes: [],
  edges: [],
});

/**
 * Clones canvas data (deep copy)
 */
export const cloneCanvasData = (data: CanvasData): CanvasData => ({
  nodes: data.nodes.map(node => ({
    ...node,
    data: { ...node.data },
    position: { ...node.position },
  })),
  edges: data.edges.map(edge => ({ ...edge })),
});

/**
 * Merges two canvas data structures
 */
export const mergeCanvasData = (
  base: CanvasData, 
  overlay: CanvasData
): CanvasData => {
  const nodeIds = new Set(base.nodes.map(n => n.id));
  const edgeIds = new Set(base.edges.map(e => e.id));

  return {
    nodes: [
      ...base.nodes,
      ...overlay.nodes.filter(n => !nodeIds.has(n.id)),
    ],
    edges: [
      ...base.edges,
      ...overlay.edges.filter(e => !edgeIds.has(e.id)),
    ],
  };
};

// ============================================================================
// Node Operations
// ============================================================================

/**
 * Finds a node by ID
 */
export const findNodeById = (
  nodes: CanvasNode[], 
  nodeId: string
): CanvasNode | undefined => {
  return nodes.find(n => n.id === nodeId);
};

/**
 * Finds a node by entity ID
 */
export const findNodeByEntityId = (
  nodes: CanvasNode[], 
  entityId: string
): CanvasNode | undefined => {
  return nodes.find(n => n.data.entityId === entityId);
};

/**
 * Filters nodes by type
 */
export const filterNodesByType = (
  nodes: CanvasNode[], 
  type: CanvasNodeType
): CanvasNode[] => {
  return nodes.filter(n => n.type === type);
};

/**
 * Updates a node in the nodes array
 */
export const updateNode = (
  nodes: CanvasNode[],
  nodeId: string,
  updates: Partial<CanvasNode>
): CanvasNode[] => {
  return nodes.map(node => 
    node.id === nodeId ? { ...node, ...updates } : node
  );
};

/**
 * Updates node data
 */
export const updateNodeData = (
  nodes: CanvasNode[],
  nodeId: string,
  dataUpdates: Partial<CanvasNode['data']>
): CanvasNode[] => {
  return nodes.map(node => 
    node.id === nodeId 
      ? { ...node, data: { ...node.data, ...dataUpdates } }
      : node
  );
};

/**
 * Removes a node and its connected edges
 */
export const removeNode = (
  data: CanvasData,
  nodeId: string
): CanvasData => ({
  nodes: data.nodes.filter(n => n.id !== nodeId),
  edges: data.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
});

/**
 * Removes multiple nodes and their connected edges
 */
export const removeNodes = (
  data: CanvasData,
  nodeIds: string[]
): CanvasData => {
  const nodeIdSet = new Set(nodeIds);
  return {
    nodes: data.nodes.filter(n => !nodeIdSet.has(n.id)),
    edges: data.edges.filter(e => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target)),
  };
};

// ============================================================================
// Edge Operations
// ============================================================================

/**
 * Creates a new edge
 */
export const createEdge = (
  source: string,
  target: string,
  options?: Partial<CanvasEdge>
): CanvasEdge => ({
  id: generateEdgeId(source, target),
  source,
  target,
  type: 'default',
  ...options,
});

/**
 * Finds edges connected to a node
 */
export const findConnectedEdges = (
  edges: CanvasEdge[],
  nodeId: string
): CanvasEdge[] => {
  return edges.filter(e => e.source === nodeId || e.target === nodeId);
};

/**
 * Finds incoming edges to a node
 */
export const findIncomingEdges = (
  edges: CanvasEdge[],
  nodeId: string
): CanvasEdge[] => {
  return edges.filter(e => e.target === nodeId);
};

/**
 * Finds outgoing edges from a node
 */
export const findOutgoingEdges = (
  edges: CanvasEdge[],
  nodeId: string
): CanvasEdge[] => {
  return edges.filter(e => e.source === nodeId);
};

/**
 * Checks if an edge already exists
 */
export const edgeExists = (
  edges: CanvasEdge[],
  source: string,
  target: string
): boolean => {
  return edges.some(e => e.source === source && e.target === target);
};

/**
 * Removes an edge by ID
 */
export const removeEdge = (
  edges: CanvasEdge[],
  edgeId: string
): CanvasEdge[] => {
  return edges.filter(e => e.id !== edgeId);
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Checks if a connection would create a cycle
 */
export const wouldCreateCycle = (
  edges: CanvasEdge[],
  source: string,
  target: string
): boolean => {
  // Check if target can reach source (would create cycle)
  const visited = new Set<string>();
  const queue = [target];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const outgoing = edges
      .filter(e => e.source === current)
      .map(e => e.target);
    queue.push(...outgoing);
  }

  return false;
};

/**
 * Validates canvas data structure
 */
export const validateCanvasData = (
  data: CanvasData
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const nodeIds = new Set(data.nodes.map(n => n.id));

  // Check for duplicate node IDs
  if (nodeIds.size !== data.nodes.length) {
    errors.push('Duplicate node IDs found');
  }

  // Check edge references
  for (const edge of data.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} references non-existent source node ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references non-existent target node ${edge.target}`);
    }
  }

  // Check for self-referencing edges
  const selfEdges = data.edges.filter(e => e.source === e.target);
  if (selfEdges.length > 0) {
    errors.push(`${selfEdges.length} self-referencing edge(s) found`);
  }

  return { valid: errors.length === 0, errors };
};

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serializes canvas data to JSON string
 */
export const serializeCanvasData = (data: CanvasData): string => {
  return JSON.stringify(data, null, 2);
};

/**
 * Deserializes canvas data from JSON string
 */
export const deserializeCanvasData = (json: string): CanvasData => {
  const data = JSON.parse(json);
  return {
    nodes: data.nodes || [],
    edges: data.edges || [],
  };
};

// ============================================================================
// Selection Helpers
// ============================================================================

/**
 * Gets selected nodes
 */
export const getSelectedNodes = (nodes: CanvasNode[]): CanvasNode[] => {
  return nodes.filter(n => n.selected);
};

/**
 * Selects nodes by IDs
 */
export const selectNodes = (
  nodes: CanvasNode[],
  nodeIds: string[]
): CanvasNode[] => {
  const idSet = new Set(nodeIds);
  return nodes.map(node => ({
    ...node,
    selected: idSet.has(node.id),
  }));
};

/**
 * Clears all selections
 */
export const clearSelection = (nodes: CanvasNode[]): CanvasNode[] => {
  return nodes.map(node => ({
    ...node,
    selected: false,
  }));
};
