/**
 * Workflow Plan Conversion
 * 
 * Converts between WorkflowPlan and CanvasData formats.
 */

import type { WorkflowPlan, WorkflowTask, TaskType } from '@/types/workflow-plan';
import type { CanvasData, CanvasNode, CanvasEdge, CanvasNodeType } from '@/types/canvas';
import { generateId } from '@/lib/canvas/utils';

// ============================================================================
// Constants
// ============================================================================

const NODE_WIDTH = 360;
const NODE_HEIGHT = 180;
const HORIZONTAL_GAP = 140;
const VERTICAL_GAP = 20;

// ============================================================================
// Type Mapping
// ============================================================================

const taskTypeToNodeType: Record<TaskType, CanvasNodeType> = {
  agent: 'agent',
  action: 'action',
  condition: 'condition',
  document: 'document',
  codeArtifact: 'codeArtifact',
};

const nodeTypeToTaskType: Record<string, TaskType> = {
  agent: 'agent',
  action: 'action',
  condition: 'condition',
  document: 'document',
  codeArtifact: 'codeArtifact',
  start: 'action',
  trigger: 'action',
  end: 'action',
};

// ============================================================================
// Layout Calculation
// ============================================================================

/**
 * Calculate node positions using topological sort and level assignment
 */
function calculateLayout(tasks: WorkflowTask[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  
  if (tasks.length === 0) return positions;

  // Build dependency graph
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  
  for (const task of tasks) {
    inDegree.set(task.id, 0);
    children.set(task.id, []);
  }
  
  for (const task of tasks) {
    for (const depId of task.dependentTasks || []) {
      if (taskMap.has(depId)) {
        inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
        children.get(depId)?.push(task.id);
      }
    }
  }

  // Assign levels using BFS (topological sort)
  const levels = new Map<string, number>();
  const queue: string[] = [];
  
  // Start with nodes that have no dependencies
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
      levels.set(id, 0);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current) || 0;
    
    for (const childId of children.get(current) || []) {
      const newDegree = (inDegree.get(childId) || 0) - 1;
      inDegree.set(childId, newDegree);
      
      // Update level to be max of all parent levels + 1
      const existingLevel = levels.get(childId) || 0;
      levels.set(childId, Math.max(existingLevel, currentLevel + 1));
      
      if (newDegree === 0) {
        queue.push(childId);
      }
    }
  }

  // Group nodes by level
  const levelGroups = new Map<number, string[]>();
  for (const [id, level] of levels) {
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(id);
  }

  // Calculate positions — center all nodes at x=0 for single-column layouts
  const maxLevel = Math.max(...levels.values(), 0);
  
  for (let level = 0; level <= maxLevel; level++) {
    const nodesAtLevel = levelGroups.get(level) || [];
    const totalWidth = nodesAtLevel.length * NODE_WIDTH + (nodesAtLevel.length - 1) * HORIZONTAL_GAP;
    const startX = -totalWidth / 2;
    
    nodesAtLevel.forEach((id, index) => {
      positions.set(id, {
        x: startX + index * (NODE_WIDTH + HORIZONTAL_GAP),
        y: level * (NODE_HEIGHT + VERTICAL_GAP),
      });
    });
  }

  return positions;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert a WorkflowPlan to CanvasData
 */
export function workflowPlanToCanvasData(plan: WorkflowPlan): CanvasData {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  
  // Calculate layout positions
  const positions = calculateLayout(plan.tasks);
  
  // Track task ID to node ID mapping
  const taskIdToNodeId = new Map<string, string>();

  // Create nodes for each task
  for (const task of plan.tasks) {
    const nodeId = `node_${generateId()}`;
    taskIdToNodeId.set(task.id, nodeId);
    
    const position = positions.get(task.id) || { x: 0, y: 0 };
    const nodeType = taskTypeToNodeType[task.type] || 'action';
    
    const node: CanvasNode = {
      id: nodeId,
      type: nodeType,
      position,
      data: {
        title: task.title,
        entityId: nodeId,
        contentPreview: task.prompt,
        metadata: {
          taskId: task.id,
          prompt: task.prompt,
          agentId: task.agentId,
          config: task.config,
        },
      },
    };
    
    nodes.push(node);
  }

  // Create edges based on dependencies
  // For condition nodes, we need to assign sourceHandle: 'true' and 'false'
  // Track how many edges have been created from each condition node
  const conditionHandleIndex = new Map<string, number>();
  
  // Build a set of condition task IDs for quick lookup
  const conditionTaskIds = new Set(
    plan.tasks.filter(t => t.type === 'condition').map(t => t.id)
  );

  for (const task of plan.tasks) {
    const targetNodeId = taskIdToNodeId.get(task.id);
    if (!targetNodeId) continue;
    
    for (const depTaskId of task.dependentTasks || []) {
      const sourceNodeId = taskIdToNodeId.get(depTaskId);
      if (!sourceNodeId) continue;
      
      // Determine sourceHandle for condition nodes
      let sourceHandle: string | undefined;
      if (conditionTaskIds.has(depTaskId)) {
        const idx = conditionHandleIndex.get(depTaskId) ?? 0;
        sourceHandle = idx === 0 ? 'true' : 'false';
        conditionHandleIndex.set(depTaskId, idx + 1);
      }

      const edge: CanvasEdge = {
        id: `edge_${sourceNodeId}_${sourceHandle ?? 'default'}_${targetNodeId}`,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle,
        type: 'custom',
      };
      
      edges.push(edge);
    }
  }

  // Add start node if there are tasks with no dependencies
  const rootTasks = plan.tasks.filter(t => !t.dependentTasks || t.dependentTasks.length === 0);
  if (rootTasks.length > 0 && plan.tasks.length > 0) {
    const startNodeId = `node_${generateId()}`;
    const minY = Math.min(...nodes.map(n => n.position.y));
    
    // Align x with the average x of root task nodes
    const rootNodeIds = rootTasks.map(t => taskIdToNodeId.get(t.id)).filter(Boolean) as string[];
    const rootNodes = nodes.filter(n => rootNodeIds.includes(n.id));
    const avgX = rootNodes.length > 0
      ? rootNodes.reduce((sum, n) => sum + n.position.x, 0) / rootNodes.length
      : 0;
    
    const startNode: CanvasNode = {
      id: startNodeId,
      type: 'start',
      position: { x: avgX, y: minY - NODE_HEIGHT - VERTICAL_GAP },
      data: {
        title: 'Start',
        entityId: startNodeId,
        metadata: {
          inputVariables: plan.variables,
        },
      },
    };
    
    nodes.unshift(startNode);
    
    // Connect start to all root tasks
    for (const task of rootTasks) {
      const targetNodeId = taskIdToNodeId.get(task.id);
      if (targetNodeId) {
        edges.push({
          id: `edge_${startNodeId}_${targetNodeId}`,
          source: startNodeId,
          target: targetNodeId,
          type: 'custom',
        });
      }
    }
  }

  // Add end node if there are leaf tasks
  const leafTasks = plan.tasks.filter(task => {
    return !plan.tasks.some(t => t.dependentTasks?.includes(task.id));
  });
  
  if (leafTasks.length > 0 && plan.tasks.length > 0) {
    const endNodeId = `node_${generateId()}`;
    const maxY = Math.max(...nodes.map(n => n.position.y));
    
    // Align x with the average x of leaf task nodes
    const leafNodeIds = leafTasks.map(t => taskIdToNodeId.get(t.id)).filter(Boolean) as string[];
    const leafNodes = nodes.filter(n => leafNodeIds.includes(n.id));
    const avgX = leafNodes.length > 0
      ? leafNodes.reduce((sum, n) => sum + n.position.x, 0) / leafNodes.length
      : 0;
    
    const endNode: CanvasNode = {
      id: endNodeId,
      type: 'end',
      position: { x: avgX, y: maxY + NODE_HEIGHT + VERTICAL_GAP },
      data: {
        title: 'End',
        entityId: endNodeId,
      },
    };
    
    nodes.push(endNode);
    
    // Connect all leaf tasks to end
    for (const task of leafTasks) {
      const sourceNodeId = taskIdToNodeId.get(task.id);
      if (sourceNodeId) {
        edges.push({
          id: `edge_${sourceNodeId}_${endNodeId}`,
          source: sourceNodeId,
          target: endNodeId,
          type: 'custom',
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Convert CanvasData back to a WorkflowPlan
 */
export function canvasDataToWorkflowPlan(
  canvasData: CanvasData,
  title: string = 'Untitled Workflow'
): WorkflowPlan {
  const tasks: WorkflowTask[] = [];
  
  // Build node ID to task mapping
  const nodeIdToTaskId = new Map<string, string>();
  
  // Filter out start/end nodes and convert to tasks
  const taskNodes = canvasData.nodes.filter(
    n => n.type !== 'start' && n.type !== 'end' && n.type !== 'trigger'
  );
  
  for (const node of taskNodes) {
    const taskId = (node.data.metadata as any)?.taskId || `task_${node.id}`;
    nodeIdToTaskId.set(node.id, taskId);
  }

  // Build dependency map from edges
  const dependencies = new Map<string, string[]>();
  for (const edge of canvasData.edges) {
    const sourceNode = canvasData.nodes.find(n => n.id === edge.source);
    const targetNode = canvasData.nodes.find(n => n.id === edge.target);
    
    // Skip edges from/to start/end nodes
    if (!sourceNode || !targetNode) continue;
    if (sourceNode.type === 'start' || sourceNode.type === 'trigger') continue;
    if (targetNode.type === 'end') continue;
    
    const sourceTaskId = nodeIdToTaskId.get(edge.source);
    const targetTaskId = nodeIdToTaskId.get(edge.target);
    
    if (sourceTaskId && targetTaskId) {
      if (!dependencies.has(targetTaskId)) {
        dependencies.set(targetTaskId, []);
      }
      dependencies.get(targetTaskId)!.push(sourceTaskId);
    }
  }

  // Create tasks
  for (const node of taskNodes) {
    const taskId = nodeIdToTaskId.get(node.id)!;
    const metadata = node.data.metadata as any;
    
    const task: WorkflowTask = {
      id: taskId,
      title: node.data.title,
      type: nodeTypeToTaskType[node.type as string] || 'action',
      prompt: metadata?.prompt || node.data.contentPreview || '',
      dependentTasks: dependencies.get(taskId) || [],
      agentId: metadata?.agentId,
      config: metadata?.config,
    };
    
    tasks.push(task);
  }

  // Extract variables from start node
  const startNode = canvasData.nodes.find(n => n.type === 'start');
  const variables = (startNode?.data.metadata as any)?.inputVariables || [];

  return {
    title,
    tasks,
    variables,
  };
}
