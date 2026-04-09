/**
 * Agent Node Executor
 *
 * Executes agent nodes using the Claude Agent SDK (same as chat mode).
 * Falls back to direct Bedrock API when workspace context is unavailable.
 *
 * Requirement 3.1: WHEN executing an agent node, THE Node_Executor SHALL invoke
 * the configured AI agent with the node's prompt and context.
 */

import { BaseNodeExecutor } from './base-executor.js';
import type { NodeExecutionParams, NodeExecutionResult } from './types.js';
import type { CanvasNodeType } from '../../types/workflow-execution.js';
import { aiService } from '../ai.service.js';
import { WorkspaceManager, type SkillForWorkspace } from '../workspace-manager.js';
import { skillService } from '../skill.service.js';
import type {
  AgentRuntime,
} from '../agent-runtime.js';
import type {
  AgentConfig,
} from '../claude-agent.service.js';
import { agentStatusService } from '../agent-status.service.js';

/**
 * Agent node metadata structure
 */
interface AgentNodeMeta {
  /** Reference to the agent definition */
  agentId?: string;
  /** Agent configuration snapshot */
  agent?: {
    id: string;
    name: string;
    role?: string;
    avatar?: string;
    systemPrompt?: string;
  };
  /** Query/prompt for this execution */
  query?: string;
  /** Result ID from execution */
  resultId?: string;
  /** Execution version */
  version?: number;
  /** Model configuration */
  modelConfig?: {
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
  };
  /** Context items (references to other nodes) */
  contextItems?: Array<{
    type: string;
    entityId: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }>;
  /** Execution status */
  status?: string;
}

/**
 * Agent node executor
 *
 * Uses Claude Agent SDK for execution when an agent has skills/workspace context.
 * Falls back to direct Bedrock API for simple agent nodes without skills.
 */
export class AgentNodeExecutor extends BaseNodeExecutor {
  readonly supportedTypes: CanvasNodeType[] = ['agent'];

  /** Lazy-loaded agent runtime (avoids circular imports) */
  private runtime: AgentRuntime | null = null;
  private workspaceManager: WorkspaceManager | null = null;

  private async getAgentRuntime(): Promise<AgentRuntime> {
    if (!this.runtime) {
      const mod = await import('../agent-runtime-factory.js');
      this.runtime = mod.agentRuntime;
    }
    return this.runtime;
  }

  private getWorkspaceManager(): WorkspaceManager {
    if (!this.workspaceManager) {
      this.workspaceManager = new WorkspaceManager();
    }
    return this.workspaceManager;
  }

  async execute(params: NodeExecutionParams): Promise<NodeExecutionResult> {
    const { node, context } = params;
    const metadata = this.getMetadata<AgentNodeMeta>(params);

    // Get the query/prompt
    let query = metadata?.query || node.data.contentPreview || '';
    query = this.substituteVariables(query, context);

    // Build context from parent node outputs
    const agentContext = this.buildAgentContext(metadata, context);

    // If query is empty but we have context, use that
    if (!query.trim() && agentContext.trim()) {
      query = `Please analyze and respond to the following:\n\n${agentContext}`;
    }

    // Default query if still empty
    if (!query.trim()) {
      const agentName = metadata?.agent?.name || node.data.title || 'Agent';
      const agentRole = metadata?.agent?.role || '';
      query = agentRole
        ? `作为${agentRole}，请介绍你的职责和能力。`
        : `Hello, I am ${agentName}. How can I help you today?`;
    }

    // Prepend parent context to the query if both exist
    if (agentContext.trim() && metadata?.query) {
      query = `Context from previous steps:\n${agentContext}\n\n---\n\nTask:\n${query}`;
    }

    // Determine execution path: Claude Agent SDK or direct Bedrock
    const agentId = metadata?.agentId || metadata?.agent?.id;
    const organizationId = context.organizationId;

    if (agentId && organizationId) {
      return agentStatusService.withBusyStatus(agentId, organizationId, () =>
        this.executeWithClaudeSDK(node, metadata, query, agentId, organizationId, context),
      );
    }

    // Fallback: direct Bedrock API (no skills/workspace)
    return this.executeWithBedrock(node, metadata, query, agentContext);
  }

  /**
   * Execute using Claude Agent SDK with full workspace support.
   * Agent gets access to skills, subagents, and tools.
   */
  private async executeWithClaudeSDK(
    node: NodeExecutionParams['node'],
    metadata: AgentNodeMeta | undefined,
    query: string,
    agentId: string,
    organizationId: string,
    context: NodeExecutionParams['context'],
  ): Promise<NodeExecutionResult> {
    try {
      const runtime = await this.getAgentRuntime();
      const wm = this.getWorkspaceManager();

      // Load agent's skills from DB
      const skills = await this.loadAgentSkills(organizationId, agentId);

      // Provision workspace with skills (workspace is used by Claude SDK internally)
      await wm.ensureWorkspace(agentId, skills);

      // Build agent config
      const agentConfig: AgentConfig = {
        id: agentId,
        name: metadata?.agent?.name || node.data.title || 'workflow-agent',
        displayName: metadata?.agent?.name || node.data.title || 'Workflow Agent',
        systemPrompt: metadata?.agent?.systemPrompt || null,
        organizationId,
        skillIds: skills.map(s => s.id),
        mcpServerIds: [],
      };

      // Collect full response from the async generator
      const textParts: string[] = [];
      const toolUses: Array<{ name: string; input: Record<string, unknown> }> = [];
      let claudeSessionId: string | undefined;

      const conversation = runtime.runConversation(
        {
          agentId,
          message: query,
          organizationId,
          userId: context.userId || 'workflow-system',
        },
        agentConfig,
        skills,
      );

      for await (const event of conversation) {
        if (event.type === 'session_start') {
          claudeSessionId = event.sessionId;
        } else if (event.type === 'assistant' && event.content) {
          for (const block of event.content) {
            if (block.type === 'text' && block.text) {
              textParts.push(block.text);
            } else if (block.type === 'tool_use') {
              toolUses.push({ name: block.name, input: block.input });
            }
          }
        } else if (event.type === 'error') {
          throw new Error(event.message || 'Claude Agent SDK error');
        }
      }

      const response = textParts.join('');

      return this.success({
        type: 'agent',
        title: node.data.title,
        agentId,
        agentName: metadata?.agent?.name || node.data.title,
        query,
        response,
        result: response,
        claudeSessionId,
        toolsUsed: toolUses.length > 0 ? toolUses : undefined,
        executionMode: 'claude-sdk',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Agent node (Claude SDK) failed, falling back to Bedrock: ${errorMessage}`, {
        nodeId: node.id,
        executionId: context.executionId,
      });

      // Fallback to direct Bedrock on SDK failure
      return this.executeWithBedrock(node, metadata, query, '');
    }
  }

  /**
   * Execute using direct Bedrock API (fallback, no skills/workspace).
   */
  private async executeWithBedrock(
    node: NodeExecutionParams['node'],
    metadata: AgentNodeMeta | undefined,
    query: string,
    agentContext: string,
  ): Promise<NodeExecutionResult> {
    const systemPrompt = this.buildSystemPrompt(metadata);

    try {
      const response = await aiService.chatCompletion({
        system_prompt: systemPrompt,
        messages: [
          ...(agentContext
            ? [{ role: 'user' as const, content: `Context:\n${agentContext}` }]
            : []),
          { role: 'user' as const, content: query },
        ],
        max_tokens: metadata?.modelConfig?.maxTokens || 2048,
      });

      return this.success({
        type: 'agent',
        title: node.data.title,
        agentId: metadata?.agentId,
        agentName: metadata?.agent?.name || node.data.title,
        query,
        response,
        result: response,
        executionMode: 'bedrock-direct',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error(`Agent node execution failed: ${errorMessage}`, {
        nodeId: node.id,
      });
      return this.failure(`Agent execution failed: ${errorMessage}`, errorStack);
    }
  }

  /**
   * Load skills for an agent from the database.
   */
  private async loadAgentSkills(organizationId: string, agentId: string): Promise<SkillForWorkspace[]> {
    try {
      const skillEntities = await skillService.getAgentSkills(organizationId, agentId);
      return skillEntities.map(skill => ({
        id: skill.id,
        name: skill.name,
        hashId: skill.hash_id,
        s3Bucket: skill.s3_bucket,
        s3Prefix: skill.s3_prefix,
        localPath: (skill.metadata as Record<string, unknown>)?.localPath as string | undefined,
      }));
    } catch (error) {
      console.error(`Failed to load skills for agent ${agentId}:`, error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * Build system prompt from agent configuration
   */
  private buildSystemPrompt(metadata: AgentNodeMeta | undefined): string {
    const parts: string[] = [];
    if (metadata?.agent?.systemPrompt) parts.push(metadata.agent.systemPrompt);
    if (metadata?.agent?.role) parts.push(`You are acting as: ${metadata.agent.role}`);
    if (metadata?.agent?.name) parts.push(`Your name is: ${metadata.agent.name}`);
    if (parts.length === 0) {
      parts.push('You are a helpful AI assistant. Provide clear, accurate, and helpful responses.');
    }
    return parts.join('\n\n');
  }

  /**
   * Build context from parent node outputs and context items
   */
  private buildAgentContext(
    metadata: AgentNodeMeta | undefined,
    context: NodeExecutionParams['context'],
  ): string {
    const contextParts: string[] = [];

    if (metadata?.contextItems && metadata.contextItems.length > 0) {
      for (const item of metadata.contextItems) {
        const nodeOutput = context.nodeOutputs.get(item.entityId);
        if (nodeOutput) {
          const outputStr = typeof nodeOutput === 'string'
            ? nodeOutput
            : JSON.stringify(nodeOutput, null, 2);
          contextParts.push(`--- ${item.title || item.type} (${item.entityId}) ---\n${outputStr}`);
        }
      }
    }

    if (contextParts.length === 0 && context.nodeOutputs.size > 0) {
      context.nodeOutputs.forEach((output, nodeId) => {
        if (typeof output === 'object' && output !== null && 'passThrough' in output) return;
        const outputStr = typeof output === 'string'
          ? output
          : JSON.stringify(output, null, 2);
        contextParts.push(`--- Node ${nodeId} Output ---\n${outputStr}`);
      });
    }

    return contextParts.join('\n\n');
  }
}
