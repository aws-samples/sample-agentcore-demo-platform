/**
 * Workflow Execution Logic
 * 
 * Core workflow preparation and execution utilities.
 * Adapted from Refly's canvas-common/workflow.ts
 */

import type { 
  CanvasNode, 
  CanvasEdge, 
  CanvasNodeType,
  CanvasNodeFilter,
  CanvasData,
  ActionStatus 
} from '../../types/canvas';
import type { 
  WorkflowNode,
  WorkflowNodeExecution,
  PrepareNodeExecutionsParams,
  PrepareNodeExecutionsResult,
} from '../../types/canvas/workflow';
import type { 
  WorkflowVariableDefinition,
  AgentNodeMeta,
  ContextItem 
} from '../../types/canvas/metadata';

// ============================================================================
// Node Relationship Building
// ============================================================================

interface NodeRelationships {
  nodeMap: Map<string, CanvasNode>;
  parentMap: Map<string, string[]>;
  childMap: Map<string, string[]>;
}

/**
 * Builds parent/child relationship maps from nodes and edges
 */
const buildNodeRelationships = (
  nodes: CanvasNode[], 
  edges: CanvasEdge[]
): NodeRelationships => {
  const nodeMap = new Map<string, CanvasNode>();
  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string[]>();

  // Initialize maps
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    parentMap.set(node.id, []);
    childMap.set(node.id, []);
  }

  // Build relationships from edges
  for (const edge of edges || []) {
    const sourceId = edge.source;
    const targetId = edge.target;

    if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
      // Add target as child of source
      const sourceChildren = childMap.get(sourceId) || [];
      sourceChildren.push(targetId);
      childMap.set(sourceId, sourceChildren);

      // Add source as parent of target
      const targetParents = parentMap.get(targetId) || [];
      targetParents.push(sourceId);
      parentMap.set(targetId, targetParents);
    }
  }

  return { nodeMap, parentMap, childMap };
};

/**
 * Finds all nodes in the subtree starting from given start nodes
 */
const findSubtreeNodes = (
  startNodeIds: string[], 
  childMap: Map<string, string[]>
): Set<string> => {
  const subtreeNodes = new Set<string>();
  const queue = [...startNodeIds];

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    if (!subtreeNodes.has(currentNodeId)) {
      subtreeNodes.add(currentNodeId);
      const children = childMap.get(currentNodeId) || [];
      queue.push(...children);
    }
  }

  return subtreeNodes;
};

// ============================================================================
// Variable Processing
// ============================================================================

/**
 * Updates context items from workflow variables
 */
export const updateContextItemsFromVariables = (
  contextItems: ContextItem[],
  variables: WorkflowVariableDefinition[],
): ContextItem[] => {
  const enhancedContextItems = [...contextItems];

  for (const variable of variables) {
    if (variable.variableType === 'resource') {
      for (const value of variable.value) {
        if (value.type === 'resource' && value.resource?.entityId) {
          const existingItemIndex = enhancedContextItems.findIndex(
            (item) => item.entityId === value.resource?.entityId && item.type === 'resource',
          );

          if (existingItemIndex >= 0) {
            enhancedContextItems[existingItemIndex].title = value.resource.name;
          }
        }
      }
    }
  }

  return enhancedContextItems;
};

/**
 * Processes query string with variable substitution
 */
export const processQueryWithVariables = (
  query: string,
  variables: WorkflowVariableDefinition[],
): { processedQuery: string; originalQuery: string } => {
  let processedQuery = query;

  for (const variable of variables) {
    const pattern = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
    
    if (variable.variableType === 'string' || variable.variableType === 'option') {
      const textValue = variable.value.find(v => v.type === 'text')?.text ?? '';
      processedQuery = processedQuery.replace(pattern, textValue);
    } else if (variable.variableType === 'resource') {
      const resourceNames = variable.value
        .filter(v => v.type === 'resource' && v.resource)
        .map(v => v.resource!.name)
        .join(', ');
      processedQuery = processedQuery.replace(pattern, resourceNames);
    }
  }

  return { processedQuery, originalQuery: query };
};

// ============================================================================
// Workflow Preparation
// ============================================================================

/**
 * Executable node types that should be initialized
 */
const EXECUTABLE_NODE_TYPES: CanvasNodeType[] = [
  'agent',
  'document',
  'codeArtifact',
  'action',
];

/**
 * Prepares node executions for a workflow execution
 */
export const prepareNodeExecutions = (
  params: PrepareNodeExecutionsParams
): PrepareNodeExecutionsResult => {
  const { 
    canvasData, 
    variables, 
  } = params;
  const { nodes, edges } = canvasData;

  // Process nodes with variable substitution
  const processedNodes = nodes.map((node) => {
    if (node.type === 'agent') {
      const metadata = node.data?.metadata as AgentNodeMeta;
      const originalQuery = metadata?.query ?? node.data?.title ?? '';
      const { processedQuery } = processQueryWithVariables(originalQuery, variables);
      
      return {
        ...node,
        data: {
          ...node.data,
          metadata: {
            ...metadata,
            query: processedQuery,
          },
        },
      };
    }
    return node;
  });

  const { nodeMap, parentMap, childMap } = buildNodeRelationships(processedNodes, edges);

  // Find start nodes (nodes with no parents or self-referencing)
  let startNodes = params.startNodes?.map((sid) => nodeMap.get(sid)?.id ?? sid) ?? [];
  
  if (startNodes.length === 0) {
    for (const [nodeId, parents] of parentMap) {
      if (parents.length === 0 || parents.indexOf(nodeId) >= 0) {
        startNodes.push(nodeId);
      }
    }
  }

  if (startNodes.length === 0) {
    return { nodeExecutions: [], startNodes: [] };
  }

  // Determine which nodes should be in 'init' status
  const subtreeNodes = findSubtreeNodes(startNodes, childMap);

  // Create node execution records
  const nodeExecutions: WorkflowNode[] = [];
  
  for (const node of processedNodes) {
    const parents = parentMap.get(node.id) || [];
    const children = childMap.get(node.id) || [];

    // Set status based on whether the node is in the subtree and is executable
    const isInSubtree = subtreeNodes.has(node.id);
    const isExecutable = EXECUTABLE_NODE_TYPES.includes(node.type as CanvasNodeType);
    const status: ActionStatus = isInSubtree && isExecutable ? 'init' : 'finish';

    // Build connection filters based on parent entity IDs
    const connectTo: CanvasNodeFilter[] = parents
      .map((pid) => {
        const parentNode = nodeMap.get(pid);
        return {
          type: parentNode?.type as CanvasNodeType,
          entityId: parentNode?.data?.entityId ?? '',
          handleType: 'source' as const,
        };
      })
      .filter((f) => f.type && f.entityId);

    const nodeExecution: WorkflowNode = {
      nodeId: node.id,
      nodeType: node.type as CanvasNodeType,
      node,
      entityId: node.data?.entityId ?? '',
      title: node.data?.title ?? '',
      status,
      connectTo,
      parentNodeIds: [...new Set(parents)],
      childNodeIds: [...new Set(children)],
    };

    // Add agent-specific fields
    if (node.type === 'agent') {
      const metadata = node.data?.metadata as AgentNodeMeta;
      const originalQuery = metadata?.query ?? '';
      
      nodeExecution.originalQuery = originalQuery;
      nodeExecution.processedQuery = originalQuery;
    }

    nodeExecutions.push(nodeExecution);
  }

  return { nodeExecutions, startNodes };
};

// ============================================================================
// Topological Sort
// ============================================================================

/**
 * Sorts node executions by execution order using topological sort
 * Parents always come before their children
 */
export const sortNodeExecutionsByExecutionOrder = <T extends WorkflowNodeExecution>(
  nodeExecutions: T[],
): T[] => {
  const nodeMap = new Map(nodeExecutions.map((n) => [n.nodeId, n]));
  const visited = new Set<string>();
  const result: T[] = [];

  const visit = (nodeExecution: T) => {
    if (visited.has(nodeExecution.nodeId)) return;
    visited.add(nodeExecution.nodeId);

    // Visit parents first
    const parentNodeIds = JSON.parse(nodeExecution.parentNodeIds || '[]') as string[];
    const parentNodes = parentNodeIds
      .map((parentId) => nodeMap.get(parentId))
      .filter((node): node is T => node !== undefined)
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId));

    for (const parentNode of parentNodes) {
      visit(parentNode);
    }

    result.push(nodeExecution);
  };

  // Sort nodes by ID for consistent ordering
  const sortedNodeExecutions = [...nodeExecutions].sort((a, b) => 
    a.nodeId.localeCompare(b.nodeId)
  );

  for (const nodeExecution of sortedNodeExecutions) {
    visit(nodeExecution);
  }

  return result;
};

// ============================================================================
// Workflow Validation
// ============================================================================

/**
 * Validates a workflow for execution
 */
export const validateWorkflow = (
  canvasData: CanvasData
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const { nodes, edges } = canvasData;

  // Check for empty workflow
  if (nodes.length === 0) {
    errors.push('Workflow has no nodes');
    return { valid: false, errors };
  }

  // Check for start node
  const startNodes = nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    // Check for nodes with no incoming edges as implicit start
    const { parentMap } = buildNodeRelationships(nodes, edges);
    const rootNodes = nodes.filter(n => (parentMap.get(n.id) || []).length === 0);
    if (rootNodes.length === 0) {
      errors.push('Workflow has no start node or entry point');
    }
  }

  // Check for disconnected nodes
  const connectedNodeIds = new Set<string>();
  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }
  
  const disconnectedNodes = nodes.filter(
    n => !connectedNodeIds.has(n.id) && nodes.length > 1
  );
  if (disconnectedNodes.length > 0) {
    errors.push(`${disconnectedNodes.length} disconnected node(s) found`);
  }

  // Check for cycles (simple detection)
  const hasCycle = detectCycle(nodes, edges);
  if (hasCycle) {
    errors.push('Workflow contains a cycle');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Simple cycle detection using DFS
 */
const detectCycle = (nodes: CanvasNode[], edges: CanvasEdge[]): boolean => {
  const { childMap } = buildNodeRelationships(nodes, edges);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const children = childMap.get(nodeId) || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        if (dfs(childId)) return true;
      } else if (recursionStack.has(childId)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
};
