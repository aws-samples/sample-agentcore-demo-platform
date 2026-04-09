/**
 * Canvas Node Utilities
 * 
 * Helper functions for working with canvas nodes.
 * Adapted from Refly's canvas-common/nodes.ts
 */

import type { Node, Edge } from '@xyflow/react';
import type { 
  CanvasNodeType,
  CanvasNode 
} from '../../types/canvas';
import type {
  AgentNodeMeta,
  DocumentNodeMeta,
  CodeArtifactNodeMeta,
  ResourceNodeMeta,
  StartNodeMeta,
  TriggerNodeMeta,
  ActionNodeMeta,
  ConditionNodeMeta,
  EndNodeMeta,
} from '../../types/canvas/metadata';
import { DEFAULT_NODE_DIMENSIONS } from '../../types/canvas/layout';

/**
 * Generates default metadata for a canvas node based on its type
 */
export const getNodeDefaultMetadata = (nodeType: CanvasNodeType): Record<string, unknown> => {
  if (!nodeType) {
    return {};
  }

  const baseMetadata = {
    sizeMode: 'adaptive' as const,
  };

  switch (nodeType) {
    case 'agent':
      return {
        ...baseMetadata,
        status: 'waiting',
        version: 0,
      } as AgentNodeMeta;

    case 'document':
      return {
        ...baseMetadata,
        status: 'finish',
      } as DocumentNodeMeta;

    case 'codeArtifact':
      return {
        ...baseMetadata,
        status: 'generating',
        language: 'typescript',
        activeTab: 'preview',
      } as CodeArtifactNodeMeta;

    case 'resource':
      return {
        ...baseMetadata,
        resourceType: 'weblink',
      } as ResourceNodeMeta;

    case 'humanApproval':
      return {
        ...baseMetadata,
        status: 'pending',
      };

    case 'start':
      return {
        ...baseMetadata,
        inputVariables: [],
      } as StartNodeMeta;

    case 'trigger':
      return {
        ...baseMetadata,
        triggerType: 'manual',
      } as TriggerNodeMeta;

    case 'action':
      return {
        ...baseMetadata,
        actionType: 'api_call',
        status: 'init',
      } as ActionNodeMeta;

    case 'condition':
      return {
        ...baseMetadata,
        rules: [],
        logic: 'and',
      } as ConditionNodeMeta;

    case 'end':
      return {
        ...baseMetadata,
        status: 'success',
      } as EndNodeMeta;

    default:
      return baseMetadata;
  }
};

/**
 * Gets the measured height of a canvas node
 */
export const getNodeHeight = (node: Node): number => {
  return node.measured?.height ?? DEFAULT_NODE_DIMENSIONS.HEIGHT;
};

/**
 * Gets the measured width of a canvas node
 */
export const getNodeWidth = (node: Node): number => {
  return node.measured?.width ?? DEFAULT_NODE_DIMENSIONS.WIDTH;
};

/**
 * Calculates the hierarchical level of a node from the root nodes
 */
export const getNodeLevel = (
  nodeId: string,
  _nodes: Node[],
  edges: Edge[],
  rootNodes: Node[],
): number => {
  const visited = new Set<string>();
  const queue: Array<{ id: string; level: number }> = rootNodes.map((node) => ({
    id: node.id,
    level: 0,
  }));

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    
    const { id, level } = item;

    if (id === nodeId) return level;
    if (visited.has(id) || !id) continue;
    visited.add(id);

    const nextIds = edges
      .filter((edge) => edge.source === id)
      .map((edge) => ({ id: edge.target, level: level + 1 }));

    queue.push(...nextIds);
  }

  return -1;
};

/**
 * Identifies root nodes in a canvas graph (nodes with no incoming edges)
 */
export const getRootNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  return nodes.filter((node) => !edges.some((edge) => edge.target === node.id));
};

/**
 * Gets all leaf nodes (nodes with no outgoing edges)
 */
export const getLeafNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  return nodes.filter((node) => !edges.some((edge) => edge.source === node.id));
};

/**
 * Gets direct parent nodes of a given node
 */
export const getParentNodes = (nodeId: string, nodes: Node[], edges: Edge[]): Node[] => {
  const parentIds = edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edge.source);
  
  return nodes.filter((node) => parentIds.includes(node.id));
};

/**
 * Gets direct child nodes of a given node
 */
export const getChildNodes = (nodeId: string, nodes: Node[], edges: Edge[]): Node[] => {
  const childIds = edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => edge.target);
  
  return nodes.filter((node) => childIds.includes(node.id));
};

/**
 * Checks if a node is an executable type (can be run in workflow)
 */
export const isExecutableNode = (nodeType: CanvasNodeType): boolean => {
  const executableTypes: CanvasNodeType[] = [
    'agent',
    'action',
    'condition',
  ];
  return executableTypes.includes(nodeType);
};

/**
 * Checks if a node is a control flow type
 */
export const isControlFlowNode = (nodeType: CanvasNodeType): boolean => {
  const controlFlowTypes: CanvasNodeType[] = [
    'start',
    'end',
    'condition',
    'loop',
    'parallel',
    'trigger',
  ];
  return controlFlowTypes.includes(nodeType);
};

/**
 * Creates a new canvas node with default values
 */
export const createCanvasNode = (
  type: CanvasNodeType,
  position: { x: number; y: number },
  data?: Partial<CanvasNode['data']>,
): CanvasNode => {
  const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const entityId = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    type,
    position,
    data: {
      title: data?.title ?? getDefaultNodeTitle(type),
      entityId: data?.entityId ?? entityId,
      createdAt: new Date().toISOString(),
      metadata: data?.metadata ?? getNodeDefaultMetadata(type),
      ...data,
    },
  };
};

/**
 * Gets default title for a node type
 */
export const getDefaultNodeTitle = (nodeType: CanvasNodeType): string => {
  const titles: Record<CanvasNodeType, string> = {
    agent: 'New Agent',
    document: 'Document',
    codeArtifact: 'Code',
    resource: 'Resource',
    humanApproval: 'Approval',
    start: 'Start',
    trigger: 'Trigger',
    action: 'Action',
    condition: 'Condition',
    loop: 'Loop',
    parallel: 'Parallel',
    end: 'End',
    group: 'Group',
    memo: 'Note',
  };
  return titles[nodeType] ?? 'Node';
};
