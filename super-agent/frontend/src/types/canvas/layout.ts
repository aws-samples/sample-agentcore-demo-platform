/**
 * Layout Types - Canvas layout and positioning utilities
 * 
 * Types for auto-layout functionality using dagre algorithm.
 */

import type { Node, Edge, XYPosition } from '@xyflow/react';

// ============================================================================
// Layout Constants
// ============================================================================

/**
 * Default spacing configuration
 */
export const CANVAS_SPACING = {
  /** Horizontal spacing between nodes */
  X: 400,
  /** Vertical spacing between nodes */
  Y: 30,
  /** Initial X position for new nodes */
  INITIAL_X: 100,
  /** Initial Y position for new nodes */
  INITIAL_Y: 300,
} as const;

/**
 * Default node dimensions
 */
export const DEFAULT_NODE_DIMENSIONS = {
  /** Default node width */
  WIDTH: 288,
  /** Default node height */
  HEIGHT: 320,
  /** Minimum node width */
  MIN_WIDTH: 200,
  /** Maximum node width */
  MAX_WIDTH: 600,
} as const;

// ============================================================================
// Layout Options
// ============================================================================

/**
 * Layout direction
 */
export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

/**
 * Options for branch layout
 */
export interface LayoutBranchOptions {
  /** Whether to layout from root nodes */
  fromRoot?: boolean;
  /** Layout direction */
  direction?: LayoutDirection;
  /** Whether to fix node levels */
  fixedNodeLevels?: boolean;
  /** Custom spacing */
  spacing?: {
    x: number;
    y: number;
  };
}

/**
 * Options for auto-layout
 */
export interface AutoLayoutOptions {
  /** Layout direction */
  direction?: LayoutDirection;
  /** Node separation */
  nodeSep?: number;
  /** Rank separation */
  rankSep?: number;
  /** Edge separation */
  edgeSep?: number;
  /** Margin X */
  marginX?: number;
  /** Margin Y */
  marginY?: number;
  /** Align nodes */
  align?: 'UL' | 'UR' | 'DL' | 'DR';
}

// ============================================================================
// Position Update Types
// ============================================================================

/**
 * Position update for a node
 */
export interface NodePositionUpdate {
  nodeId: string;
  position: XYPosition;
}

/**
 * Batch position updates
 */
export type PositionUpdates = Map<string, XYPosition>;

// ============================================================================
// Node Dimension Types
// ============================================================================

/**
 * Node dimensions
 */
export interface NodeDimensions {
  width: number;
  height: number;
}

/**
 * Node with measured dimensions
 */
export interface MeasuredNode extends Node {
  measured?: NodeDimensions;
}

// ============================================================================
// Layout Result Types
// ============================================================================

/**
 * Result of layout calculation
 */
export interface LayoutResult {
  /** Updated nodes with new positions */
  nodes: Node[];
  /** Updated edges (may have new control points) */
  edges: Edge[];
  /** Bounding box of the layout */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// ============================================================================
// Branch Types
// ============================================================================

/**
 * Branch cluster - group of connected nodes
 */
export interface BranchCluster {
  /** Root node IDs */
  rootIds: string[];
  /** All node IDs in the branch */
  nodeIds: string[];
  /** Edges within the branch */
  edgeIds: string[];
}

/**
 * Node level information
 */
export interface NodeLevelInfo {
  nodeId: string;
  level: number;
  parentIds: string[];
  childIds: string[];
}
