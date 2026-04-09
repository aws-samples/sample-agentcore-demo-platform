/**
 * Canvas Layout Utilities
 * 
 * Auto-layout functionality using dagre algorithm.
 * Adapted from Refly's canvas-common/layout.ts
 */

import type { Node, Edge, XYPosition } from '@xyflow/react';
import type { 
  LayoutBranchOptions, 
  AutoLayoutOptions,
  PositionUpdates,
  LayoutResult 
} from '../../types/canvas/layout';
import { CANVAS_SPACING, DEFAULT_NODE_DIMENSIONS } from '../../types/canvas/layout';
import { getNodeHeight, getNodeWidth, getNodeLevel, getRootNodes } from './nodes';

// ============================================================================
// Branch Utilities
// ============================================================================

/**
 * Gets all nodes in a branch starting from specific nodes
 */
export const getBranchNodes = (
  startNodeIds: string[],
  nodes: Node[],
  edges: Edge[],
  visited: Set<string> = new Set(),
): Node[] => {
  const branchNodes: Node[] = [];
  const queue = [...startNodeIds];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    const node = nodes.find((n) => n.id === currentId);
    if (node) {
      branchNodes.push(node);
      const outgoingIds = edges
        .filter((e) => e.source === currentId)
        .map((e) => e.target);
      queue.push(...outgoingIds);
    }
  }

  return branchNodes;
};

/**
 * Gets nodes at a specific level in the graph
 */
export const getNodesAtLevel = (
  nodes: Node[],
  edges: Edge[],
  level: number,
  rootNodes: Node[],
): Node[] => {
  const result: Node[] = [];
  const visited = new Set<string>();
  const queue: Array<{ node: Node; level: number }> = rootNodes.map((node) => ({ 
    node, 
    level: 0 
  }));

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item || !item.node || visited.has(item.node.id)) continue;
    
    visited.add(item.node.id);

    if (item.level === level) {
      result.push(item.node);
      continue;
    }

    const nextNodes = edges
      .filter((edge) => edge.source === item.node.id)
      .map((edge) => nodes.find((n) => n.id === edge.target))
      .filter((n): n is Node => n !== undefined)
      .map((node) => ({ node, level: item.level + 1 }));

    queue.push(...nextNodes);
  }

  return result;
};

/**
 * Gets the branch cluster that a node belongs to
 */
export const getBranchCluster = (
  nodeId: string, 
  nodes: Node[], 
  edges: Edge[]
): Node[] => {
  const visited = new Set<string>();
  const cluster = new Set<string>();
  const queue = [nodeId];

  // Traverse upwards to find root
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);
    cluster.add(currentId);

    const parentIds = edges
      .filter((edge) => edge.target === currentId)
      .map((edge) => edge.source);
    queue.push(...parentIds);
  }

  // Traverse downwards from all found nodes
  const downQueue = Array.from(cluster);
  visited.clear();

  while (downQueue.length > 0) {
    const currentId = downQueue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    const childIds = edges
      .filter((edge) => edge.source === currentId)
      .map((edge) => edge.target);
    downQueue.push(...childIds);
    for (const id of childIds) {
      cluster.add(id);
    }
  }

  return nodes.filter((node) => cluster.has(node.id));
};

// ============================================================================
// Layout Algorithms
// ============================================================================

/**
 * Simple auto-layout without dagre dependency
 * Arranges nodes in a left-to-right flow based on their connections
 */
export const autoLayout = (
  nodes: Node[],
  edges: Edge[],
  options: AutoLayoutOptions = {}
): LayoutResult => {
  const {
    direction = 'LR',
    nodeSep = CANVAS_SPACING.Y,
    rankSep = CANVAS_SPACING.X,
    marginX = 50,
    marginY = 50,
  } = options;

  if (nodes.length === 0) {
    return { nodes: [], edges, bounds: { x: 0, y: 0, width: 0, height: 0 } };
  }

  const rootNodes = getRootNodes(nodes, edges);
  const levels = new Map<string, number>();
  const nodesByLevel = new Map<number, Node[]>();

  // Calculate levels using BFS
  const queue: Array<{ id: string; level: number }> = rootNodes.map(n => ({ 
    id: n.id, 
    level: 0 
  }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    levels.set(id, level);
    
    const levelNodes = nodesByLevel.get(level) || [];
    const node = nodes.find(n => n.id === id);
    if (node) {
      levelNodes.push(node);
      nodesByLevel.set(level, levelNodes);
    }

    const childIds = edges
      .filter(e => e.source === id)
      .map(e => e.target);
    
    for (const childId of childIds) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, level: level + 1 });
      }
    }
  }

  // Position nodes by level
  const updatedNodes: Node[] = [];
  let maxX = 0;
  let maxY = 0;

  for (const [level, levelNodes] of nodesByLevel) {
    const x = direction === 'LR' 
      ? marginX + level * rankSep 
      : marginX;
    
    let y = marginY;
    
    for (const node of levelNodes) {
      const nodeWidth = getNodeWidth(node);
      const nodeHeight = getNodeHeight(node);
      
      const position = direction === 'LR'
        ? { x, y }
        : { x: y, y: marginY + level * rankSep };

      updatedNodes.push({
        ...node,
        position,
      });

      y += nodeHeight + nodeSep;
      maxX = Math.max(maxX, position.x + nodeWidth);
      maxY = Math.max(maxY, position.y + nodeHeight);
    }
  }

  // Add any unvisited nodes (disconnected)
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      updatedNodes.push({
        ...node,
        position: { x: maxX + rankSep, y: marginY },
      });
      maxX += getNodeWidth(node) + rankSep;
    }
  }

  return {
    nodes: updatedNodes,
    edges,
    bounds: {
      x: marginX,
      y: marginY,
      width: maxX - marginX,
      height: maxY - marginY,
    },
  };
};

/**
 * Layouts a branch of nodes while preserving root positions
 */
export const layoutBranch = (
  branchNodes: Node[],
  edges: Edge[],
  rootNodes: Node[],
  options: LayoutBranchOptions = {},
): Node[] => {
  const { 
    fromRoot = false,
    spacing = { x: CANVAS_SPACING.X, y: CANVAS_SPACING.Y }
  } = options;

  if (branchNodes.length === 0) return [];

  // Get max level in the branch
  const maxLevel = Math.max(
    ...branchNodes.map((node) => 
      getNodeLevel(node.id, branchNodes, edges, rootNodes)
    ),
  );

  // Group nodes by level
  const nodesByLevel = new Map<number, Node[]>();
  for (const node of branchNodes) {
    const level = getNodeLevel(node.id, branchNodes, edges, rootNodes);
    const levelNodes = nodesByLevel.get(level) || [];
    levelNodes.push(node);
    nodesByLevel.set(level, levelNodes);
  }

  // Position nodes
  return branchNodes.map((node) => {
    const level = getNodeLevel(node.id, branchNodes, edges, rootNodes);
    const isRoot = rootNodes.some((root) => root.id === node.id);
    const shouldPreservePosition = fromRoot ? isRoot : level < maxLevel;

    if (shouldPreservePosition) {
      return node;
    }

    // Calculate position based on parent nodes
    const parentEdges = edges.filter((edge) => edge.target === node.id);
    const parentNodes = parentEdges
      .map((edge) => branchNodes.find((n) => n.id === edge.source))
      .filter((n): n is Node => n !== undefined);

    if (parentNodes.length > 0) {
      const avgParentY = parentNodes.reduce((sum, n) => sum + n.position.y, 0) / parentNodes.length;
      const maxParentX = Math.max(...parentNodes.map(n => n.position.x + getNodeWidth(n)));

      return {
        ...node,
        position: {
          x: maxParentX + spacing.x,
          y: avgParentY,
        },
      };
    }

    return node;
  });
};

// ============================================================================
// Position Calculation
// ============================================================================

/**
 * Calculates position for a new node based on source nodes
 */
export const calculateNewNodePosition = (
  sourceNodes: Node[],
  allNodes: Node[],
  _edges: Edge[],
): XYPosition => {
  if (sourceNodes.length === 0) {
    return { 
      x: CANVAS_SPACING.INITIAL_X, 
      y: CANVAS_SPACING.INITIAL_Y 
    };
  }

  // Find rightmost source node
  const rightmostSource = sourceNodes.reduce((max, node) => 
    node.position.x + getNodeWidth(node) > max.position.x + getNodeWidth(max) ? node : max
  );

  // Calculate average Y of source nodes
  const avgY = sourceNodes.reduce((sum, n) => sum + n.position.y, 0) / sourceNodes.length;

  // Check for existing nodes at the target position
  const targetX = rightmostSource.position.x + getNodeWidth(rightmostSource) + CANVAS_SPACING.X;
  let targetY = avgY;

  // Avoid overlapping with existing nodes
  const existingNodesAtX = allNodes.filter(n => 
    Math.abs(n.position.x - targetX) < DEFAULT_NODE_DIMENSIONS.WIDTH
  );

  if (existingNodesAtX.length > 0) {
    const occupiedYRanges = existingNodesAtX.map(n => ({
      top: n.position.y,
      bottom: n.position.y + getNodeHeight(n),
    }));

    // Find a free Y position
    while (occupiedYRanges.some(range => 
      targetY >= range.top - CANVAS_SPACING.Y && 
      targetY <= range.bottom + CANVAS_SPACING.Y
    )) {
      targetY += DEFAULT_NODE_DIMENSIONS.HEIGHT + CANVAS_SPACING.Y;
    }
  }

  return { x: targetX, y: targetY };
};

/**
 * Gets position updates for branch layout
 */
export const getLayoutBranchPositionUpdates = (
  sourceNodes: Node[],
  allNodes: Node[],
  edges: Edge[],
): PositionUpdates => {
  const updates = new Map<string, XYPosition>();

  if (sourceNodes.length === 0) return updates;

  // Find all nodes connected to source nodes
  const targetNodeIds = new Set<string>();
  const queue = [...sourceNodes.map((n) => n.id)];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    for (const edge of edges) {
      if (edge.source === currentId && !sourceNodes.some((n) => n.id === edge.target)) {
        targetNodeIds.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  // Calculate positions for target nodes
  const targetNodes = allNodes.filter((node) => targetNodeIds.has(node.id));
  
  for (const node of targetNodes) {
    const parentEdges = edges.filter((e) => e.target === node.id);
    const parentNodes = parentEdges
      .map((e) => allNodes.find((n) => n.id === e.source))
      .filter((n): n is Node => n !== undefined);

    if (parentNodes.length > 0) {
      const avgParentY = parentNodes.reduce((sum, n) => sum + n.position.y, 0) / parentNodes.length;
      const maxParentX = Math.max(...parentNodes.map(n => n.position.x + getNodeWidth(n)));

      updates.set(node.id, {
        x: maxParentX + CANVAS_SPACING.X,
        y: avgParentY,
      });
    }
  }

  return updates;
};
