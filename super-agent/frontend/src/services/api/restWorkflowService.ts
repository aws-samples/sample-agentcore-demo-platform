/**
 * REST Workflow Service
 * 
 * Implements the workflow service interface using the REST API backend.
 * Replaces Supabase direct access with HTTP calls to super-agent-backend.
 */

import { restClient } from './restClient';
import type { Workflow, WorkflowCategory, WorkflowNode, Connection, NodeType } from '@/types';
import { ServiceError } from '@/utils/errorHandling';

/**
 * API response type for workflows (snake_case from backend)
 */
interface ApiWorkflow {
  id: string;
  organization_id: string;
  business_scope_id: string | null;
  name: string;
  version: string;
  is_official: boolean;
  parent_version: string | null;
  nodes: unknown[];
  connections: unknown[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Maps API workflow response to application Workflow type
 */
function mapApiWorkflowToWorkflow(apiWorkflow: ApiWorkflow): Workflow {
  return {
    id: apiWorkflow.id,
    name: apiWorkflow.name,
    category: 'hr' as WorkflowCategory, // Default category for backward compatibility
    businessScopeId: apiWorkflow.business_scope_id || undefined,
    version: apiWorkflow.version,
    isOfficial: apiWorkflow.is_official,
    parentVersion: apiWorkflow.parent_version || undefined,
    nodes: parseNodes(apiWorkflow.nodes),
    connections: parseConnections(apiWorkflow.connections),
    createdAt: new Date(apiWorkflow.created_at),
    updatedAt: new Date(apiWorkflow.updated_at),
    createdBy: apiWorkflow.created_by || 'unknown',
  };
}

/**
 * Maps application Workflow to API request format
 */
function mapWorkflowToApiRequest(
  workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>
): Record<string, unknown> {
  return {
    name: workflow.name,
    version: workflow.version,
    business_scope_id: workflow.businessScopeId || null,
    is_official: workflow.isOfficial,
    parent_version: workflow.parentVersion || null,
    nodes: workflow.nodes,
    connections: workflow.connections,
    created_by: workflow.createdBy || null,
  };
}

function parseNodes(nodes: unknown): WorkflowNode[] {
  if (Array.isArray(nodes)) {
    return nodes.map((n, index) => ({
      id: typeof n.id === 'string' ? n.id : `node-${index}`,
      type: isValidNodeType(n.type) ? n.type : 'action',
      label: typeof n.label === 'string' ? n.label : 'Unknown',
      description: typeof n.description === 'string' ? n.description : '',
      position: parsePosition(n.position),
      icon: typeof n.icon === 'string' ? n.icon : 'cog',
      agentId: typeof n.agentId === 'string' ? n.agentId : undefined,
      actionType: typeof n.actionType === 'string' ? n.actionType : undefined,
      metadata: typeof n.metadata === 'object' && n.metadata !== null ? n.metadata : undefined,
    }));
  }
  return [];
}

function parsePosition(position: unknown): { x: number; y: number } {
  if (typeof position === 'object' && position !== null) {
    const p = position as Record<string, unknown>;
    return {
      x: typeof p.x === 'number' ? p.x : 0,
      y: typeof p.y === 'number' ? p.y : 0,
    };
  }
  return { x: 0, y: 0 };
}

function parseConnections(connections: unknown): Connection[] {
  if (Array.isArray(connections)) {
    return connections.map((c, index) => ({
      id: typeof c.id === 'string' ? c.id : `conn-${index}`,
      from: typeof c.from === 'string' ? c.from : '',
      to: typeof c.to === 'string' ? c.to : '',
      sourceHandle: typeof c.sourceHandle === 'string' ? c.sourceHandle : undefined,
      targetHandle: typeof c.targetHandle === 'string' ? c.targetHandle : undefined,
      animated: typeof c.animated === 'boolean' ? c.animated : undefined,
    }));
  }
  return [];
}

const VALID_NODE_TYPES = new Set([
  'trigger', 'agent', 'human', 'action', 'condition', 'end',
  'document', 'codeArtifact', 'resource', 'loop', 'parallel', 'start',
  'group', 'memo', 'humanApproval',
]);

function isValidNodeType(value: unknown): value is NodeType {
  return typeof value === 'string' && VALID_NODE_TYPES.has(value);
}

/**
 * REST implementation of the Workflow Service
 */
export const RestWorkflowService = {
  /**
   * Retrieves all workflows from the API
   */
  async getWorkflows(options?: { includeAll?: boolean }): Promise<Workflow[]> {
    try {
      const query = options?.includeAll ? '?includeAll=true' : '';
      const response = await restClient.get<{
        data: ApiWorkflow[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(`/api/workflows${query}`);
      return response.data.map(mapApiWorkflowToWorkflow);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to fetch workflows', 'UNKNOWN');
    }
  },

  /**
   * Retrieves a single workflow by ID
   */
  async getWorkflowById(id: string): Promise<Workflow> {
    try {
      const response = await restClient.get<ApiWorkflow>(`/api/workflows/${id}`);
      return mapApiWorkflowToWorkflow(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch workflow with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Creates a new workflow
   */
  async createWorkflow(
    data: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Workflow> {
    try {
      if (!data.name || data.name.trim() === '') {
        throw new ServiceError('Workflow name is required', 'VALIDATION_ERROR');
      }
      if (!data.version || data.version.trim() === '') {
        throw new ServiceError('Workflow version is required', 'VALIDATION_ERROR');
      }

      const requestData = mapWorkflowToApiRequest(data);
      const response = await restClient.post<ApiWorkflow>('/api/workflows', requestData);
      return mapApiWorkflowToWorkflow(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to create workflow', 'UNKNOWN');
    }
  },

  /**
   * Updates a workflow (creates a new version)
   */
  async updateWorkflow(
    id: string,
    data: Partial<Omit<Workflow, 'id' | 'createdAt'>>
  ): Promise<Workflow> {
    try {
      if (data.name !== undefined && data.name.trim() === '') {
        throw new ServiceError('Workflow name cannot be empty', 'VALIDATION_ERROR');
      }

      const requestData: Record<string, unknown> = {};
      if (data.name !== undefined) requestData.name = data.name;
      if (data.version !== undefined) requestData.version = data.version;
      if (data.isOfficial !== undefined) requestData.is_official = data.isOfficial;
      if (data.parentVersion !== undefined) requestData.parent_version = data.parentVersion;
      if (data.nodes !== undefined) requestData.nodes = data.nodes;
      if (data.connections !== undefined) requestData.connections = data.connections;

      console.log('🔄 REST updateWorkflow request:', { id, requestData });
      const response = await restClient.put<ApiWorkflow>(`/api/workflows/${id}`, requestData);
      console.log('🔄 REST updateWorkflow response:', { 
        id: response.id, 
        nodes: response.nodes?.length,
        connections: response.connections?.length,
        response 
      });
      return mapApiWorkflowToWorkflow(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to update workflow with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Deletes a workflow
   */
  async deleteWorkflow(id: string): Promise<void> {
    try {
      await restClient.delete(`/api/workflows/${id}`);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to delete workflow with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Retrieves workflows filtered by business scope
   */
  async getWorkflowsByBusinessScope(businessScopeId: string): Promise<Workflow[]> {
    try {
      const response = await restClient.get<{
        data: ApiWorkflow[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(
        `/api/workflows?business_scope_id=${encodeURIComponent(businessScopeId)}`
      );
      return response.data.map(mapApiWorkflowToWorkflow);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch workflows for business scope "${businessScopeId}"`, 'UNKNOWN');
    }
  },

  /**
   * Retrieves workflows filtered by category (backward compatibility)
   */
  async getWorkflowsByCategory(category: WorkflowCategory): Promise<Workflow[]> {
    const workflows = await this.getWorkflows();
    return workflows.filter(w => w.category === category);
  },

  /**
   * Retrieves all versions of a workflow by name
   */
  async getWorkflowVersions(name: string): Promise<Workflow[]> {
    try {
      const response = await restClient.get<{
        data: ApiWorkflow[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>(
        `/api/workflows?name=${encodeURIComponent(name)}&includeAll=true`
      );
      return response.data.map(mapApiWorkflowToWorkflow);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch versions for workflow "${name}"`, 'UNKNOWN');
    }
  },

  /**
   * Promotes a draft workflow version to official
   */
  async promoteToOfficial(id: string): Promise<Workflow> {
    try {
      const response = await restClient.post<ApiWorkflow>(`/api/workflows/${id}/promote`);
      return mapApiWorkflowToWorkflow(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to promote workflow "${id}" to official`, 'UNKNOWN');
    }
  },

  /**
   * Imports a workflow from JSON/YAML
   */
  async importWorkflow(data: { content: string; format: 'json' | 'yaml' }): Promise<Workflow> {
    try {
      const response = await restClient.post<ApiWorkflow>('/api/workflows/import', data);
      return mapApiWorkflowToWorkflow(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to import workflow', 'UNKNOWN');
    }
  },

  /**
   * Subscribes to real-time workflow changes (no-op for REST)
   */
  subscribeToChanges(callback: (payload: { eventType: string; new?: Workflow; old?: Workflow }) => void) {
    console.warn('REST API does not support real-time subscriptions. Consider using polling.');
    return () => {};
  },
};

export default RestWorkflowService;
