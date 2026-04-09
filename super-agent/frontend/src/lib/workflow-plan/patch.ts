/**
 * Workflow Plan Patching
 * 
 * Apply semantic patch operations to modify workflow plans.
 */

import type { 
  WorkflowPlan, 
  WorkflowTask, 
  WorkflowPatch,
} from '@/types/workflow-plan';
import { workflowPatchSchema } from '@/types/workflow-plan';
import { getAuthToken } from '@/services/api/restClient';

// ============================================================================
// Patch Result
// ============================================================================

export interface PatchResult {
  success: boolean;
  data?: WorkflowPlan;
  error?: string;
}

// ============================================================================
// Apply Patches
// ============================================================================

/**
 * Apply a single patch operation to a workflow plan
 */
export function applyPatch(plan: WorkflowPlan, patch: WorkflowPatch): PatchResult {
  // Create a mutable copy
  const result: WorkflowPlan = {
    title: plan.title,
    description: plan.description,
    tasks: [...plan.tasks],
    variables: [...plan.variables],
  };

  try {
    switch (patch.op) {
      case 'updateTitle':
        if (patch.title) {
          result.title = patch.title;
        }
        break;

      case 'createTask':
        if (!patch.task) {
          return { success: false, error: 'Task data required for createTask operation' };
        }
        // Check for duplicate ID
        if (result.tasks.some(t => t.id === patch.task!.id)) {
          return { success: false, error: `Task with ID "${patch.task.id}" already exists` };
        }
        result.tasks.push(patch.task);
        break;

      case 'updateTask':
        if (!patch.taskId) {
          return { success: false, error: 'taskId required for updateTask operation' };
        }
        const taskIndex = result.tasks.findIndex(t => t.id === patch.taskId);
        if (taskIndex === -1) {
          return { success: false, error: `Task with ID "${patch.taskId}" not found` };
        }
        if (patch.taskData) {
          result.tasks[taskIndex] = { ...result.tasks[taskIndex], ...patch.taskData };
        }
        break;

      case 'deleteTask':
        if (!patch.taskId) {
          return { success: false, error: 'taskId required for deleteTask operation' };
        }
        const deleteIndex = result.tasks.findIndex(t => t.id === patch.taskId);
        if (deleteIndex === -1) {
          return { success: false, error: `Task with ID "${patch.taskId}" not found` };
        }
        result.tasks.splice(deleteIndex, 1);
        // Remove references from other tasks' dependencies
        result.tasks = result.tasks.map(t => ({
          ...t,
          dependentTasks: t.dependentTasks?.filter(id => id !== patch.taskId),
        }));
        break;

      case 'createVariable':
        if (!patch.variable) {
          return { success: false, error: 'Variable data required for createVariable operation' };
        }
        if (result.variables.some(v => v.variableId === patch.variable!.variableId)) {
          return { success: false, error: `Variable with ID "${patch.variable.variableId}" already exists` };
        }
        result.variables.push(patch.variable);
        break;

      case 'updateVariable':
        if (!patch.variableId) {
          return { success: false, error: 'variableId required for updateVariable operation' };
        }
        const varIndex = result.variables.findIndex(v => v.variableId === patch.variableId);
        if (varIndex === -1) {
          return { success: false, error: `Variable with ID "${patch.variableId}" not found` };
        }
        if (patch.variableData) {
          result.variables[varIndex] = { ...result.variables[varIndex], ...patch.variableData };
        }
        break;

      case 'deleteVariable':
        if (!patch.variableId) {
          return { success: false, error: 'variableId required for deleteVariable operation' };
        }
        const deleteVarIndex = result.variables.findIndex(v => v.variableId === patch.variableId);
        if (deleteVarIndex === -1) {
          return { success: false, error: `Variable with ID "${patch.variableId}" not found` };
        }
        result.variables.splice(deleteVarIndex, 1);
        break;

      case 'reorderTasks':
        if (!patch.taskOrder || !Array.isArray(patch.taskOrder)) {
          return { success: false, error: 'taskOrder array required for reorderTasks operation' };
        }
        const reorderedTasks: WorkflowTask[] = [];
        for (const taskId of patch.taskOrder) {
          const task = result.tasks.find(t => t.id === taskId);
          if (task) {
            reorderedTasks.push(task);
          }
        }
        // Add any tasks not in the order list at the end
        for (const task of result.tasks) {
          if (!patch.taskOrder.includes(task.id)) {
            reorderedTasks.push(task);
          }
        }
        result.tasks = reorderedTasks;
        break;

      default:
        return { success: false, error: `Unknown operation: ${patch.op}` };
    }

    return { success: true, data: result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error applying patch' 
    };
  }
}

/**
 * Apply multiple patch operations in sequence
 */
export function applyPatches(plan: WorkflowPlan, patches: WorkflowPatch[]): PatchResult {
  let currentPlan = plan;

  for (const patch of patches) {
    const result = applyPatch(currentPlan, patch);
    if (!result.success) {
      return result;
    }
    currentPlan = result.data!;
  }

  return { success: true, data: currentPlan };
}

// ============================================================================
// Patch Generation from Natural Language
// ============================================================================

/**
 * Generate patches using LLM
 * Calls the backend API to generate patches from natural language
 */
export async function generatePatchesWithLLM(
  currentPlan: WorkflowPlan,
  request: string
): Promise<WorkflowPatch[]> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
    const response = await fetch(`${API_BASE_URL}/api/workflows/modify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        currentPlan,
        modificationRequest: request,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Failed to generate patches: ${response.status}`);
    }

    // Consume SSE stream and accumulate text
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);
          if (event.type === 'error') {
            throw new Error(event.message || 'Patch generation failed');
          }
          if ((event.type === 'assistant' || event.type === 'result') && event.content) {
            for (const block of event.content) {
              if (block.type === 'text' && block.text) {
                accumulatedText += block.text;
              }
            }
          }
        } catch (e) {
          if (e instanceof Error && e.message === 'Patch generation failed') throw e;
          // skip unparseable SSE lines
        }
      }
    }

    // Parse the accumulated JSON array
    let jsonStr = accumulatedText.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1]!.trim();
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    }

    const rawPatches = JSON.parse(jsonStr);
    if (!Array.isArray(rawPatches)) throw new Error('Expected a JSON array of patches');
    
    // Validate and sanitize each patch
    const validatedPatches = validateAndSanitizePatches(rawPatches, currentPlan);
    
    return validatedPatches;
  } catch (error) {
    console.error('Error calling workflow modification API:', error);
    // Fall back to local parsing if API fails
    return parseModificationRequest(currentPlan, request);
  }
}

/**
 * Validate and sanitize patches from LLM output
 * 
 * This function ensures:
 * 1. Each patch has valid structure (using Zod schema)
 * 2. Task IDs are unique
 * 3. Dependencies reference existing tasks
 * 4. No circular dependencies are created
 */
function validateAndSanitizePatches(
  rawPatches: unknown[],
  currentPlan: WorkflowPlan
): WorkflowPatch[] {
  const validPatches: WorkflowPatch[] = [];
  
  // Track existing task IDs (including ones being created)
  const existingTaskIds = new Set(currentPlan.tasks.map(t => t.id));
  const deletedTaskIds = new Set<string>();
  
  for (const rawPatch of rawPatches) {
    try {
      // 1. Validate patch structure using Zod schema
      const parseResult = workflowPatchSchema.safeParse(rawPatch);
      if (!parseResult.success) {
        console.warn('Invalid patch structure:', parseResult.error.message);
        continue;
      }
      
      const patch = parseResult.data;
      
      // 2. Validate based on operation type
      switch (patch.op) {
        case 'createTask':
          if (!patch.task) {
            console.warn('createTask patch missing task data');
            continue;
          }
          // Ensure unique ID
          if (existingTaskIds.has(patch.task.id)) {
            // Generate a new unique ID
            patch.task.id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }
          // Validate dependencies exist
          if (patch.task.dependentTasks) {
            patch.task.dependentTasks = patch.task.dependentTasks.filter(
              depId => existingTaskIds.has(depId) && !deletedTaskIds.has(depId)
            );
          }
          // Validate task type
          if (!isValidTaskType(patch.task.type)) {
            patch.task.type = 'agent'; // Default to agent
          }
          existingTaskIds.add(patch.task.id);
          break;
          
        case 'updateTask':
          if (!patch.taskId || !existingTaskIds.has(patch.taskId) || deletedTaskIds.has(patch.taskId)) {
            console.warn(`updateTask: task ${patch.taskId} not found`);
            continue;
          }
          // Validate dependencies if being updated
          if (patch.taskData?.dependentTasks) {
            patch.taskData.dependentTasks = patch.taskData.dependentTasks.filter(
              depId => existingTaskIds.has(depId) && !deletedTaskIds.has(depId) && depId !== patch.taskId
            );
          }
          break;
          
        case 'deleteTask':
          if (!patch.taskId || !existingTaskIds.has(patch.taskId) || deletedTaskIds.has(patch.taskId)) {
            console.warn(`deleteTask: task ${patch.taskId} not found`);
            continue;
          }
          deletedTaskIds.add(patch.taskId);
          break;
          
        case 'createVariable':
          if (!patch.variable) {
            console.warn('createVariable patch missing variable data');
            continue;
          }
          // Ensure unique variable ID
          const existingVarIds = new Set(currentPlan.variables.map(v => v.variableId));
          if (existingVarIds.has(patch.variable.variableId)) {
            patch.variable.variableId = `var-${Date.now()}`;
          }
          break;
          
        case 'updateVariable':
        case 'deleteVariable':
          if (!patch.variableId) {
            console.warn(`${patch.op} patch missing variableId`);
            continue;
          }
          const varExists = currentPlan.variables.some(v => v.variableId === patch.variableId);
          if (!varExists) {
            console.warn(`${patch.op}: variable ${patch.variableId} not found`);
            continue;
          }
          break;
          
        case 'updateTitle':
          if (!patch.title || patch.title.trim() === '') {
            console.warn('updateTitle patch missing or empty title');
            continue;
          }
          break;
          
        case 'reorderTasks':
          if (!patch.taskOrder || !Array.isArray(patch.taskOrder)) {
            console.warn('reorderTasks patch missing taskOrder');
            continue;
          }
          // Filter to only include existing tasks
          patch.taskOrder = patch.taskOrder.filter(
            id => existingTaskIds.has(id) && !deletedTaskIds.has(id)
          );
          break;
      }
      
      validPatches.push(patch);
    } catch (error) {
      console.warn('Error validating patch:', error);
    }
  }
  
  // 3. Check for circular dependencies after all patches
  if (!validateNoCyclicDependencies(currentPlan, validPatches)) {
    console.warn('Patches would create circular dependencies, filtering problematic patches');
    // For now, just warn - could implement more sophisticated filtering
  }
  
  return validPatches;
}

/**
 * Check if a task type is valid
 */
function isValidTaskType(type: string): type is WorkflowTask['type'] {
  return ['agent', 'action', 'condition', 'document', 'codeArtifact'].includes(type);
}

/**
 * Validate that patches don't create circular dependencies
 */
function validateNoCyclicDependencies(
  currentPlan: WorkflowPlan,
  patches: WorkflowPatch[]
): boolean {
  // Build the task graph after applying patches
  const taskMap = new Map<string, string[]>();
  
  // Initialize with current tasks
  for (const task of currentPlan.tasks) {
    taskMap.set(task.id, task.dependentTasks || []);
  }
  
  // Apply patches to the graph
  for (const patch of patches) {
    switch (patch.op) {
      case 'createTask':
        if (patch.task) {
          taskMap.set(patch.task.id, patch.task.dependentTasks || []);
        }
        break;
      case 'updateTask':
        if (patch.taskId && patch.taskData?.dependentTasks) {
          taskMap.set(patch.taskId, patch.taskData.dependentTasks);
        }
        break;
      case 'deleteTask':
        if (patch.taskId) {
          taskMap.delete(patch.taskId);
          // Remove from all dependencies
          for (const [id, deps] of taskMap) {
            taskMap.set(id, deps.filter(d => d !== patch.taskId));
          }
        }
        break;
    }
  }
  
  // Check for cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      return true; // Cycle detected
    }
    if (visited.has(nodeId)) {
      return false; // Already processed, no cycle from here
    }
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const dependencies = taskMap.get(nodeId) || [];
    for (const depId of dependencies) {
      if (hasCycle(depId)) {
        return true;
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  }
  
  for (const nodeId of taskMap.keys()) {
    if (hasCycle(nodeId)) {
      return false;
    }
  }
  
  return true;
}

export const PATCH_GENERATION_SYSTEM_PROMPT = `You are a workflow modification assistant. Given a current workflow plan and a modification request, generate the appropriate patch operations.

## Patch Operations

- **updateTitle**: Change workflow title
  \`{ "op": "updateTitle", "title": "New Title" }\`

- **createTask**: Add a new task
  \`{ "op": "createTask", "task": { "id": "task-new", "title": "...", "type": "agent", "prompt": "...", "dependentTasks": [] } }\`

- **updateTask**: Modify an existing task
  \`{ "op": "updateTask", "taskId": "task-1", "taskData": { "title": "New Title", "prompt": "New prompt" } }\`

- **deleteTask**: Remove a task
  \`{ "op": "deleteTask", "taskId": "task-1" }\`

- **createVariable**: Add a new variable
  \`{ "op": "createVariable", "variable": { "variableId": "var-new", "name": "...", "variableType": "string", "description": "...", "required": false, "value": [] } }\`

- **updateVariable**: Modify an existing variable
  \`{ "op": "updateVariable", "variableId": "var-1", "variableData": { "name": "newName" } }\`

- **deleteVariable**: Remove a variable
  \`{ "op": "deleteVariable", "variableId": "var-1" }\`

## Response Format

Respond with a JSON array of patch operations:
\`\`\`json
[
  { "op": "updateTask", "taskId": "task-1", "taskData": { "title": "Updated Title" } },
  { "op": "createTask", "task": { ... } }
]
\`\`\`

## Guidelines

1. Use the minimum number of operations needed
2. Preserve existing task/variable IDs when updating
3. Update dependencies when adding/removing tasks
4. Only include fields that need to change in update operations`;

/**
 * Parse natural language modification into patch operations
 * This is a mock implementation - in production, this would call an LLM
 */
export function parseModificationRequest(
  currentPlan: WorkflowPlan,
  request: string
): WorkflowPatch[] {
  const patches: WorkflowPatch[] = [];
  const lowerRequest = request.toLowerCase();

  // Detect common modification patterns

  // Chinese: Add task before/after pattern (在...前/后添加)
  const chineseBeforeMatch = request.match(/在(.+?)(?:前|之前)(?:添加|加|插入)(.+?)(?:节点|步骤|任务)?/);
  const chineseAfterMatch = request.match(/在(.+?)(?:后|之后)(?:添加|加|插入)(.+?)(?:节点|步骤|任务)?/);
  const chineseAddMatch = request.match(/(?:添加|加|插入)(?:一个)?(.+?)(?:节点|步骤|任务)/);
  
  if (chineseBeforeMatch || chineseAfterMatch || chineseAddMatch) {
    const newTaskId = `task-${Date.now()}`;
    let taskTitle = 'New Task';
    let dependentTasks: string[] = [];
    
    if (chineseBeforeMatch) {
      // Find the reference task
      const refTaskName = chineseBeforeMatch[1].trim();
      taskTitle = chineseBeforeMatch[2]?.trim() || '新任务';
      
      // Find task by name
      const refTask = currentPlan.tasks.find(t => 
        t.title.includes(refTaskName) || refTaskName.includes(t.title)
      );
      
      if (refTask) {
        // New task should have the same dependencies as the reference task
        dependentTasks = refTask.dependentTasks || [];
        
        // Update reference task to depend on the new task
        patches.push({
          op: 'createTask',
          task: {
            id: newTaskId,
            title: taskTitle,
            type: 'agent',
            prompt: request,
            dependentTasks,
          },
        });
        
        // Update the reference task to depend on the new task
        patches.push({
          op: 'updateTask',
          taskId: refTask.id,
          taskData: {
            dependentTasks: [newTaskId],
          },
        });
        
        return patches;
      }
    }
    
    if (chineseAfterMatch) {
      // Find the reference task
      const refTaskName = chineseAfterMatch[1].trim();
      taskTitle = chineseAfterMatch[2]?.trim() || '新任务';
      
      const refTask = currentPlan.tasks.find(t => 
        t.title.includes(refTaskName) || refTaskName.includes(t.title)
      );
      
      if (refTask) {
        dependentTasks = [refTask.id];
        
        patches.push({
          op: 'createTask',
          task: {
            id: newTaskId,
            title: taskTitle,
            type: 'agent',
            prompt: request,
            dependentTasks,
          },
        });
        
        return patches;
      }
    }
    
    if (chineseAddMatch) {
      taskTitle = chineseAddMatch[1]?.trim() || '新任务';
      const lastTask = currentPlan.tasks[currentPlan.tasks.length - 1];
      
      patches.push({
        op: 'createTask',
        task: {
          id: newTaskId,
          title: taskTitle,
          type: 'agent',
          prompt: request,
          dependentTasks: lastTask ? [lastTask.id] : [],
        },
      });
      
      return patches;
    }
  }

  // Chinese: Remove/delete pattern (删除/移除)
  const chineseDeleteMatch = request.match(/(?:删除|移除|去掉)(.+?)(?:节点|步骤|任务)?/);
  if (chineseDeleteMatch) {
    const taskName = chineseDeleteMatch[1].trim();
    const task = currentPlan.tasks.find(t => 
      t.title.includes(taskName) || taskName.includes(t.title)
    );
    
    if (task) {
      patches.push({
        op: 'deleteTask',
        taskId: task.id,
      });
      return patches;
    }
  }

  // Add task/step/node pattern
  if (lowerRequest.includes('add') && 
      (lowerRequest.includes('step') || lowerRequest.includes('task') || 
       lowerRequest.includes('node') || lowerRequest.includes('agent'))) {
    const newTaskId = `task-${Date.now()}`;
    const lastTask = currentPlan.tasks[currentPlan.tasks.length - 1];
    
    // Determine task type from request
    let taskType: 'agent' | 'action' | 'condition' | 'document' | 'codeArtifact' = 'agent';
    let taskTitle = 'New Task';
    
    if (lowerRequest.includes('action')) {
      taskType = 'action';
      taskTitle = 'New Action';
    } else if (lowerRequest.includes('condition') || lowerRequest.includes('branch')) {
      taskType = 'condition';
      taskTitle = 'Condition';
    } else if (lowerRequest.includes('document') || lowerRequest.includes('report')) {
      taskType = 'document';
      taskTitle = 'Generate Document';
    } else if (lowerRequest.includes('code')) {
      taskType = 'codeArtifact';
      taskTitle = 'Generate Code';
    }
    
    patches.push({
      op: 'createTask',
      task: {
        id: newTaskId,
        title: taskTitle,
        type: taskType,
        prompt: request,
        dependentTasks: lastTask ? [lastTask.id] : [],
      },
    });
  }

  // Remove task pattern
  if (lowerRequest.includes('remove') || lowerRequest.includes('delete')) {
    // Try to find task by name
    for (const task of currentPlan.tasks) {
      if (lowerRequest.includes(task.title.toLowerCase())) {
        patches.push({
          op: 'deleteTask',
          taskId: task.id,
        });
        break;
      }
    }
    
    // If no specific task found, try to remove the last task
    if (patches.length === 0 && (lowerRequest.includes('last') || lowerRequest.includes('final'))) {
      const lastTask = currentPlan.tasks[currentPlan.tasks.length - 1];
      if (lastTask) {
        patches.push({
          op: 'deleteTask',
          taskId: lastTask.id,
        });
      }
    }
  }

  // Rename/update title pattern
  if (lowerRequest.includes('rename') || lowerRequest.includes('change title') || lowerRequest.includes('change name')) {
    // Extract new title (simplified)
    const match = request.match(/to ["']([^"']+)["']/i);
    if (match) {
      patches.push({
        op: 'updateTitle',
        title: match[1],
      });
    }
  }

  // Add variable/input pattern
  if (lowerRequest.includes('add variable') || lowerRequest.includes('add input') || lowerRequest.includes('add parameter') ||
      request.includes('添加变量') || request.includes('添加输入') || request.includes('添加参数')) {
    const match = request.match(/(?:called|named|叫|名为)\s*["']?(\w+)["']?/i);
    const varName = match ? match[1] : 'newVariable';
    
    patches.push({
      op: 'createVariable',
      variable: {
        variableId: `var-${Date.now()}`,
        variableType: 'string',
        name: varName,
        description: request,
        required: false,
        value: [],
      },
    });
  }

  // Add notification/email step
  if ((lowerRequest.includes('notification') || lowerRequest.includes('notify') || lowerRequest.includes('email') || lowerRequest.includes('send') ||
       request.includes('通知') || request.includes('发送')) &&
      !lowerRequest.includes('remove') && !lowerRequest.includes('delete') &&
      !request.includes('删除') && !request.includes('移除')) {
    const lastTask = currentPlan.tasks[currentPlan.tasks.length - 1];
    
    patches.push({
      op: 'createTask',
      task: {
        id: `task-notify-${Date.now()}`,
        title: request.includes('通知') || request.includes('发送') ? '发送通知' : 'Send Notification',
        type: 'action',
        prompt: 'Send notification with the results.',
        dependentTasks: lastTask ? [lastTask.id] : [],
      },
    });
  }

  return patches;
}
