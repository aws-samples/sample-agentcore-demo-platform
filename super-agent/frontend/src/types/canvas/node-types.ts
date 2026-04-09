/**
 * Canvas Node Types - Core type definitions for workflow canvas nodes
 * 
 * Adapted from Refly's openapi-schema and canvas-common packages.
 * These types are compatible with @xyflow/react.
 */

import type { Node, XYPosition } from '@xyflow/react';

// ============================================================================
// Canvas Node Types
// ============================================================================

/**
 * All supported canvas node types.
 * Maps to your platform's concepts:
 * - agent: Your Agent concept (executes AI tasks)
 * - document: Rich text output
 * - codeArtifact: Code generation with preview
 * - humanApproval: Human-in-the-loop approval
 * - start: Workflow entry point
 * - trigger: Event-based triggers
 * - action: Generic actions (API calls, etc.)
 * - end: Workflow termination
 */
export type CanvasNodeType =
  | 'agent'           // Your Agent - executes AI tasks
  | 'document'        // Rich text document output
  | 'codeArtifact'    // Code with preview
  | 'resource'        // External resource (file, URL)
  | 'humanApproval'   // Human-in-the-loop
  | 'start'           // Workflow entry point
  | 'trigger'         // Event triggers
  | 'action'          // Generic actions
  | 'condition'       // Conditional branching
  | 'loop'            // Loop/iteration
  | 'parallel'        // Parallel execution
  | 'end'             // Workflow termination
  | 'group'           // Group container
  | 'memo';           // Notes/comments

/**
 * Action execution status
 */
export type ActionStatus = 
  | 'init'       // Not started
  | 'waiting'    // Waiting for dependencies
  | 'executing'  // Currently running
  | 'finish'     // Completed successfully
  | 'failed';    // Failed with error

/**
 * Code artifact types
 */
export type CodeArtifactType = 
  | 'html'
  | 'react'
  | 'vue'
  | 'python'
  | 'typescript'
  | 'javascript';

// ============================================================================
// Position Types
// ============================================================================

export type { XYPosition };

export interface CanvasPosition {
  x: number;
  y: number;
}

// ============================================================================
// Node Data Types
// ============================================================================

/**
 * Base data structure for all canvas nodes
 */
export interface CanvasNodeData<T = Record<string, unknown>> extends Record<string, unknown> {
  /** Display title */
  title: string;
  /** Unique entity identifier */
  entityId: string;
  /** Creation timestamp */
  createdAt?: string;
  /** Content preview text */
  contentPreview?: string;
  /** Reasoning/thinking content (for AI nodes) */
  reasoningContent?: string;
  /** Type-specific metadata */
  metadata?: T;
  /** Target handle ID for connections */
  targetHandle?: string;
  /** Source handle ID for connections */
  sourceHandle?: string;
}

/**
 * Canvas node - extends xyflow Node with our data structure
 */
export type CanvasNode<T = Record<string, unknown>> = Node<CanvasNodeData<T>, CanvasNodeType> & {
  className?: string;
  style?: React.CSSProperties;
  position: XYPosition;
};

/**
 * Canvas edge - connection between nodes
 */
export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  sourceHandle?: string;
  targetHandle?: string;
  animated?: boolean;
  label?: string;
  data?: Record<string, unknown>;
}

/**
 * Filter for finding specific nodes
 */
export interface CanvasNodeFilter {
  type: CanvasNodeType;
  entityId: string;
  handleType?: 'source' | 'target';
}

// ============================================================================
// Canvas Data Structure
// ============================================================================

/**
 * Complete canvas state
 */
export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

/**
 * Canvas state with title
 */
export interface CanvasState extends CanvasData {
  title: string;
}

// ============================================================================
// Re-export xyflow types for convenience
// ============================================================================

export type { Node, Edge } from '@xyflow/react';
