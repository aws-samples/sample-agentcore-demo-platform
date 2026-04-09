/**
 * Workflow Service
 * Business logic layer for Workflow management.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { workflowRepository, type WorkflowEntity } from '../repositories/workflow.repository.js';
import { AppError } from '../middleware/errorHandler.js';
import { aiService } from './ai.service.js';
import type {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ImportWorkflowInput,
  WorkflowFilter,
} from '../schemas/workflow.schema.js';

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Workflow Service class providing business logic for workflow operations.
 */
export class WorkflowService {
  /**
   * Get all workflows for an organization with optional filters.
   * Requirements: 6.1
   *
   * @param organizationId - The organization ID
   * @param filters - Optional filters (business_scope_id, is_official, name)
   * @param pagination - Optional pagination options
   * @returns Paginated list of workflows
   */
  async getWorkflows(
    organizationId: string,
    filters?: WorkflowFilter,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<WorkflowEntity>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const workflows = await workflowRepository.findAllWithFilters(organizationId, filters, {
      skip,
      take: limit,
    });

    // Build where clause for count
    const whereClause: Partial<WorkflowEntity> = {};
    if (filters?.business_scope_id) {
      whereClause.business_scope_id = filters.business_scope_id;
    }
    if (filters?.is_official !== undefined) {
      whereClause.is_official = filters.is_official;
    }

    const total = await workflowRepository.count(organizationId, whereClause);

    return {
      data: workflows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single workflow by ID.
   * Requirements: 6.2
   *
   * @param id - The workflow ID
   * @param organizationId - The organization ID
   * @returns The workflow if found
   * @throws AppError.notFound if workflow doesn't exist
   */
  async getWorkflowById(id: string, organizationId: string): Promise<WorkflowEntity> {
    const workflow = await workflowRepository.findByIdWithBusinessScope(id, organizationId);

    if (!workflow) {
      throw AppError.notFound(`Workflow with ID ${id} not found`);
    }

    return workflow;
  }

  /**
   * Create a new workflow.
   * Requirements: 6.3
   *
   * @param data - The workflow data
   * @param organizationId - The organization ID
   * @param userId - The user ID creating the workflow
   * @returns The created workflow
   * @throws AppError.validation if name is empty or invalid
   * @throws AppError.validation if data is invalid
   */
  async createWorkflow(
    data: CreateWorkflowInput,
    organizationId: string,
    userId?: string
  ): Promise<WorkflowEntity> {
    // Validate required fields
    if (!data.name || data.name.trim() === '') {
      throw AppError.validation('Workflow name is required');
    }

    if (!data.version || data.version.trim() === '') {
      throw AppError.validation('Workflow version is required');
    }

    // Create the workflow
    const workflow = await workflowRepository.createWithUser(
      {
        name: data.name.trim(),
        version: data.version.trim(),
        business_scope_id: data.business_scope_id ?? null,
        is_official: data.is_official ?? false,
        parent_version: data.parent_version ?? null,
        nodes: data.nodes ?? [],
        connections: data.connections ?? [],
      },
      organizationId,
      userId
    );

    return workflow;
  }

  /**
   * Update an existing workflow.
   * Requirements: 6.4
   *
   * @param id - The workflow ID
   * @param data - The update data
   * @param organizationId - The organization ID
   * @returns The updated workflow
   * @throws AppError.notFound if workflow doesn't exist
   * @throws AppError.validation if data is invalid
   * @throws AppError.conflict if name+version combination already exists
   */
  async updateWorkflow(
    id: string,
    data: UpdateWorkflowInput,
    organizationId: string
  ): Promise<WorkflowEntity> {
    // Verify workflow exists
    const existingWorkflow = await workflowRepository.findById(id, organizationId);
    if (!existingWorkflow) {
      throw AppError.notFound(`Workflow with ID ${id} not found`);
    }

    // Validate name if provided
    if (data.name !== undefined && (!data.name || data.name.trim() === '')) {
      throw AppError.validation('Workflow name cannot be empty');
    }

    // Validate version if provided
    if (data.version !== undefined && (!data.version || data.version.trim() === '')) {
      throw AppError.validation('Workflow version cannot be empty');
    }

    // Check for duplicate name+version (excluding current workflow)
    const newName = data.name?.trim() ?? existingWorkflow.name;
    const newVersion = data.version?.trim() ?? existingWorkflow.version;

    if (newName !== existingWorkflow.name || newVersion !== existingWorkflow.version) {
      const workflowWithNameVersion = await workflowRepository.findByNameAndVersion(
        organizationId,
        newName,
        newVersion
      );
      if (workflowWithNameVersion && workflowWithNameVersion.id !== id) {
        throw AppError.conflict(
          `Workflow with name "${newName}" and version "${newVersion}" already exists`
        );
      }
    }

    // Build update object with only provided fields
    const updateData: Partial<WorkflowEntity> = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.version !== undefined) updateData.version = data.version.trim();
    if (data.business_scope_id !== undefined) updateData.business_scope_id = data.business_scope_id;
    if (data.is_official !== undefined) updateData.is_official = data.is_official;
    if (data.parent_version !== undefined) updateData.parent_version = data.parent_version;
    if (data.nodes !== undefined) updateData.nodes = data.nodes;
    if (data.connections !== undefined) updateData.connections = data.connections;

    const updatedWorkflow = await workflowRepository.update(id, organizationId, updateData);

    if (!updatedWorkflow) {
      throw AppError.notFound(`Workflow with ID ${id} not found`);
    }

    return updatedWorkflow;
  }

  /**
   * Delete a workflow (soft-delete).
   * Requirements: 6.5
   *
   * @param id - The workflow ID
   * @param organizationId - The organization ID
   * @returns True if deleted successfully
   * @throws AppError.notFound if workflow doesn't exist
   */
  async deleteWorkflow(id: string, organizationId: string): Promise<boolean> {
    const deleted = await workflowRepository.delete(id, organizationId);

    if (!deleted) {
      throw AppError.notFound(`Workflow with ID ${id} not found`);
    }

    return true;
  }

  /**
   * Import a workflow from JSON/YAML data.
   * Requirements: 6.6
   *
   * @param data - The imported workflow data
   * @param organizationId - The organization ID
   * @param userId - The user ID importing the workflow
   * @returns The created workflow
   * @throws AppError.validation if data is invalid
   * @throws AppError.conflict if workflow with same name+version exists
   */
  async importWorkflow(
    data: ImportWorkflowInput,
    organizationId: string,
    userId?: string
  ): Promise<WorkflowEntity> {
    // Validate required fields
    if (!data.name || data.name.trim() === '') {
      throw AppError.validation('Workflow name is required');
    }

    if (!data.version || data.version.trim() === '') {
      throw AppError.validation('Workflow version is required');
    }

    if (!Array.isArray(data.nodes)) {
      throw AppError.validation('Workflow nodes must be an array');
    }

    if (!Array.isArray(data.connections)) {
      throw AppError.validation('Workflow connections must be an array');
    }

    // Check for duplicate name+version within organization
    const existingWorkflow = await workflowRepository.findByNameAndVersion(
      organizationId,
      data.name,
      data.version
    );
    if (existingWorkflow) {
      throw AppError.conflict(
        `Workflow with name "${data.name}" and version "${data.version}" already exists`
      );
    }

    // Create the workflow from imported data
    const workflow = await workflowRepository.createWithUser(
      {
        name: data.name.trim(),
        version: data.version.trim(),
        business_scope_id: data.business_scope_id ?? null,
        is_official: false, // Imported workflows are not official by default
        parent_version: null,
        nodes: data.nodes,
        connections: data.connections,
      },
      organizationId,
      userId
    );

    return workflow;
  }

  /**
   * Get workflows by business scope.
   *
   * @param organizationId - The organization ID
   * @param businessScopeId - The business scope ID
   * @returns List of workflows in the business scope
   */
  async getWorkflowsByBusinessScope(
    organizationId: string,
    businessScopeId: string
  ): Promise<WorkflowEntity[]> {
    return workflowRepository.findByBusinessScope(organizationId, businessScopeId);
  }

  /**
   * Get official workflows.
   *
   * @param organizationId - The organization ID
   * @returns List of official workflows
   */
  async getOfficialWorkflows(organizationId: string): Promise<WorkflowEntity[]> {
    return workflowRepository.findOfficialWorkflows(organizationId);
  }

  /**
   * Generate a workflow plan from natural language description using AI.
   *
   * @param description - Natural language description of the workflow
   * @param availableAgents - Optional list of available agents to reference
   * @returns Generated workflow plan
   */
  async generateWorkflowPlan(
    description: string,
    availableAgents?: Array<{ id: string; name: string; role: string }>
  ): Promise<GeneratedWorkflowPlan> {
    const systemPrompt = WORKFLOW_GENERATION_SYSTEM_PROMPT;
    
    let userPrompt = `Generate a workflow plan for the following request:\n\n${description}`;
    
    if (availableAgents && availableAgents.length > 0) {
      userPrompt += '\n\n## Available Agents\n';
      for (const agent of availableAgents) {
        userPrompt += `- ${agent.name} (ID: ${agent.id}): ${agent.role}\n`;
      }
    }

    try {
      const response = await aiService.chatCompletion({
        system_prompt: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 4096,
      });

      // Parse the JSON response
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const plan = JSON.parse(jsonStr) as GeneratedWorkflowPlan;
      
      // Validate required fields
      if (!plan.title || !Array.isArray(plan.tasks)) {
        throw new Error('Invalid workflow plan structure');
      }

      return plan;
    } catch (error) {
      console.error('Error generating workflow plan:', error);
      throw AppError.internal(
        `Failed to generate workflow plan: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Apply natural language modifications to a workflow using AI.
   *
   * @param workflowId - The workflow ID to modify
   * @param instruction - Natural language modification instruction
   * @param organizationId - The organization ID
   * @returns Patch operations to apply
   */
  async generateWorkflowPatches(
    workflowId: string,
    instruction: string,
    organizationId: string
  ): Promise<WorkflowPatch[]> {
    // Get the current workflow
    const workflow = await this.getWorkflowById(workflowId, organizationId);
    
    const systemPrompt = PATCH_GENERATION_SYSTEM_PROMPT;
    
    const userPrompt = `Current workflow: ${JSON.stringify({
      title: workflow.name,
      tasks: workflow.nodes,
    }, null, 2)}

Modification request: ${instruction}

Generate the patch operations needed to apply this modification.`;

    try {
      const response = await aiService.chatCompletion({
        system_prompt: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 2048,
      });

      // Parse the JSON response
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      const patches = JSON.parse(jsonStr) as WorkflowPatch[];
      
      if (!Array.isArray(patches)) {
        throw new Error('Invalid patches structure');
      }

      return patches;
    } catch (error) {
      console.error('Error generating workflow patches:', error);
      throw AppError.internal(
        `Failed to generate workflow patches: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate patches from a workflow plan and modification request using AI.
   * This method works directly with the plan without needing a workflow ID.
   *
   * @param currentPlan - The current workflow plan
   * @param modificationRequest - Natural language modification request
   * @returns Patch operations to apply
   */
  async generatePatchesFromPlan(
    currentPlan: {
      title: string;
      description?: string;
      tasks: Array<{
        id: string;
        title: string;
        type: string;
        prompt?: string;
        dependentTasks?: string[];
        agentId?: string;
      }>;
      variables: Array<{
        variableId: string;
        variableType: string;
        name: string;
        description?: string;
        required?: boolean;
        value?: unknown[];
      }>;
    },
    modificationRequest: string
  ): Promise<WorkflowPatch[]> {
    const systemPrompt = PATCH_GENERATION_SYSTEM_PROMPT;
    
    const userPrompt = `Current workflow plan:
${JSON.stringify(currentPlan, null, 2)}

Modification request: ${modificationRequest}

Generate the patch operations needed to apply this modification. Consider:
- Task titles and IDs in the current plan
- Dependencies between tasks
- The user's intent (add before/after, rename, delete, etc.)

Return a JSON array of patch operations.`;

    console.log('🤖 Generating patches for modification:', modificationRequest);
    console.log('📋 Current plan:', JSON.stringify(currentPlan, null, 2));

    try {
      const response = await aiService.chatCompletion({
        system_prompt: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 2048,
      });

      console.log('🤖 LLM raw response:', response);

      // Parse the JSON response
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      console.log('🤖 Parsed JSON string:', jsonStr);

      const patches = JSON.parse(jsonStr) as WorkflowPatch[];
      
      console.log('🤖 Parsed patches:', JSON.stringify(patches, null, 2));

      if (!Array.isArray(patches)) {
        throw new Error('Invalid patches structure');
      }

      return patches;
    } catch (error) {
      console.error('Error generating patches from plan:', error);
      throw AppError.internal(
        `Failed to generate patches: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// ============================================================================
// Workflow Generation Types and Prompts
// ============================================================================

/**
 * Generated workflow task
 */
export interface GeneratedWorkflowTask {
  id: string;
  title: string;
  type: 'agent' | 'action' | 'condition' | 'document' | 'codeArtifact';
  prompt: string;
  dependentTasks?: string[];
  agentId?: string;
  config?: Record<string, unknown>;
}

/**
 * Generated workflow variable
 */
export interface GeneratedWorkflowVariable {
  variableId: string;
  variableType: 'string' | 'resource';
  name: string;
  description: string;
  required: boolean;
  value?: Array<{ type: 'text' | 'resource'; text?: string }>;
}

/**
 * Generated workflow plan from AI
 */
export interface GeneratedWorkflowPlan {
  title: string;
  description?: string;
  tasks: GeneratedWorkflowTask[];
  variables?: GeneratedWorkflowVariable[];
}

/**
 * Workflow patch operation
 */
export interface WorkflowPatch {
  op: 'updateTitle' | 'createTask' | 'updateTask' | 'deleteTask' | 'createVariable' | 'updateVariable' | 'deleteVariable' | 'reorderTasks';
  title?: string;
  taskId?: string;
  task?: GeneratedWorkflowTask;
  taskData?: Partial<GeneratedWorkflowTask>;
  variableId?: string;
  variable?: GeneratedWorkflowVariable;
  variableData?: Partial<GeneratedWorkflowVariable>;
  taskOrder?: string[];
}

/**
 * System prompt for workflow generation
 */
const WORKFLOW_GENERATION_SYSTEM_PROMPT = `You are a workflow design assistant. Your job is to convert natural language descriptions into structured workflow plans.

## Output Format

You must respond with a valid JSON object following this exact structure:

{
  "title": "Workflow Title",
  "description": "Brief description of what this workflow does",
  "tasks": [
    {
      "id": "task-1",
      "title": "Task Display Name",
      "type": "agent|action|humanApproval|condition|document|codeArtifact",
      "prompt": "Detailed instructions for this task. Use @{var:variableName} to reference variables.",
      "dependentTasks": ["task-id-of-dependency"],
      "agentId": "optional-agent-id"
    }
  ],
  "variables": [
    {
      "variableId": "var-1",
      "variableType": "string|resource",
      "name": "variableName",
      "description": "What this variable represents",
      "required": true,
      "value": [{ "type": "text", "text": "default value" }]
    }
  ]
}

## Task Types

- **agent**: AI agent that processes information and generates output
- **action**: Generic action like API calls, data transformation
- **humanApproval**: Requires human review before proceeding
- **condition**: Conditional branching based on criteria
- **document**: Generates a document or report
- **codeArtifact**: Generates code or technical artifacts

## Variable Types

- **string**: Text input from user
- **resource**: File upload (document, image, audio, video)

## Guidelines

1. **Extract Variables**: Identify user-configurable parameters and create variables for them
2. **Linear Flow**: Prefer sequential task dependencies unless parallelism is needed
3. **Clear Prompts**: Each task prompt should be detailed and actionable
4. **Sensible Defaults**: Provide default values for variables when possible
5. **Task IDs**: Use simple IDs like "task-1", "task-2", etc.
6. **Variable References**: Use @{var:variableName} syntax in prompts to reference variables

Return ONLY valid JSON, no markdown code blocks, no explanation.`;

/**
 * System prompt for patch generation
 */
const PATCH_GENERATION_SYSTEM_PROMPT = `You are a workflow modification assistant. Given a current workflow plan and a modification request, generate the appropriate patch operations.

## Patch Operations

- **updateTitle**: Change workflow title
  { "op": "updateTitle", "title": "New Title" }

- **createTask**: Add a new task
  { "op": "createTask", "task": { "id": "task-new", "title": "New Task", "type": "agent", "prompt": "Task description", "dependentTasks": [] } }

- **updateTask**: Modify an existing task (e.g., rename)
  { "op": "updateTask", "taskId": "task-1", "taskData": { "title": "New Title" } }

- **deleteTask**: Remove a task
  { "op": "deleteTask", "taskId": "task-1" }

- **createVariable**: Add a new variable
  { "op": "createVariable", "variable": { "variableId": "var-new", "name": "varName", "variableType": "string", "description": "Description", "required": false, "value": [] } }

- **updateVariable**: Modify an existing variable
  { "op": "updateVariable", "variableId": "var-1", "variableData": { "name": "newName" } }

- **deleteVariable**: Remove a variable
  { "op": "deleteVariable", "variableId": "var-1" }

## Task Types
- agent: AI agent that processes information
- action: Generic action (API call, etc.)
- humanApproval: Human review step
- condition: Conditional branching
- document: Document generation
- codeArtifact: Code generation

## Response Format

You MUST respond with a JSON array of patch operations. Even for simple operations, return an array.

Examples:
- To delete all tasks: [{ "op": "deleteTask", "taskId": "task-1" }, { "op": "deleteTask", "taskId": "task-2" }]
- To rename a task: [{ "op": "updateTask", "taskId": "task-1", "taskData": { "title": "New Name" } }]
- To add a task before another: [{ "op": "createTask", "task": { "id": "task-new", "title": "New Task", "type": "agent", "prompt": "", "dependentTasks": ["parent-task-id"] } }, { "op": "updateTask", "taskId": "original-task-id", "taskData": { "dependentTasks": ["task-new"] } }]

## Guidelines

1. ALWAYS return a non-empty array if the user wants to make changes
2. Use the exact task IDs from the current plan
3. For "delete all" requests, generate a deleteTask for each task
4. For "rename" requests, use updateTask with the new title
5. For "add before X" requests, create the new task and update X's dependencies

Return ONLY the JSON array, no explanation.`;


// Export singleton instance
export const workflowService = new WorkflowService();
