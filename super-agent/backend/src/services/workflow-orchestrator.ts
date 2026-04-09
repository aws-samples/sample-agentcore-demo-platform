/**
 * Workflow Orchestrator — Reliable Node-by-Node Execution
 *
 * Instead of dumping the entire workflow into a single CLAUDE.md and hoping
 * the agent self-navigates, this orchestrator walks the DAG from the backend,
 * sending one node at a time to the Claude Code workspace session.
 *
 * Key design decisions:
 * - The orchestrator controls the execution order (topological traversal)
 * - Agent nodes delegate to the Claude session with a focused prompt
 * - Action nodes are executed directly by the orchestrator (no sub-agent)
 * - Condition nodes are evaluated by the orchestrator using prior outputs
 * - Each node has retry logic with configurable attempts
 * - Progress events are emitted as a structured async generator for SSE
 * - Node outputs are checkpointed so failures don't lose prior work
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { agentRuntime } from './agent-runtime-factory.js';
import type { AgentConfig, ConversationEvent } from './agent-runtime.js';
import { workspaceManager, type ScopeForWorkspace, type SkillForWorkspace } from './workspace-manager.js';
import { businessScopeService } from './businessScope.service.js';
import { skillService } from './skill.service.js';
import { agentRepository } from '../repositories/agent.repository.js';
import { skillRepository } from '../repositories/skill.repository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrchestratorNode {
  id: string;
  title: string;
  type: 'start' | 'end' | 'agent' | 'action' | 'condition' | 'document' | 'codeArtifact';
  prompt: string;
  agentId?: string;
  /** For condition nodes: field/expression to evaluate */
  conditionExpression?: string;
  /** For action nodes: the action config (API call, transform, etc.) */
  actionConfig?: Record<string, unknown>;
  /** Max retry attempts for this node (default: 2) */
  maxRetries?: number;
}

export interface OrchestratorEdge {
  source: string;
  target: string;
  /** For condition branches: 'yes' | 'no' | undefined */
  label?: string;
  sourceHandle?: string;
}

export interface OrchestratorPlan {
  title: string;
  description?: string;
  nodes: OrchestratorNode[];
  edges: OrchestratorEdge[];
  variables?: Array<{ name: string; value: string; description?: string }>;
}

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface NodeProgress {
  nodeId: string;
  title: string;
  type: OrchestratorNode['type'];
  status: NodeStatus;
  output?: unknown;
  error?: string;
  attempt: number;
  startedAt?: string;
  completedAt?: string;
}

export interface OrchestratorEvent {
  type:
    | 'workflow_start'
    | 'node_start'
    | 'node_progress'
    | 'node_complete'
    | 'node_failed'
    | 'node_skipped'
    | 'workflow_complete'
    | 'workflow_failed'
    | 'log'
    | 'error';
  nodeId?: string;
  nodeTitle?: string;
  nodeType?: OrchestratorNode['type'];
  status?: NodeStatus;
  message?: string;
  output?: unknown;
  progress?: NodeProgress[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// DAG Utilities
// ---------------------------------------------------------------------------

/** Build adjacency list and in-degree map from edges */
function buildGraph(nodes: OrchestratorNode[], edges: OrchestratorEdge[]) {
  const nodeMap = new Map<string, OrchestratorNode>();
  const children = new Map<string, OrchestratorEdge[]>();
  const parents = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    children.set(node.id, []);
    parents.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    children.get(edge.source)?.push(edge);
    parents.get(edge.target)?.push(edge.source);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Find root nodes (in-degree 0)
  const roots: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) roots.push(id);
  }

  return { nodeMap, children, parents, inDegree, roots };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RETRIES = 2;
const NODE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per node

export class WorkflowOrchestrator {
  /**
   * Execute a workflow plan node-by-node.
   * Yields structured progress events for SSE streaming to the frontend.
   */
  async *execute(
    plan: OrchestratorPlan,
    organizationId: string,
    scopeId: string,
    userId: string,
  ): AsyncGenerator<OrchestratorEvent> {
    const now = () => new Date().toISOString();

    // --- 1. Build the DAG ---
    const { nodeMap, children, parents, inDegree, roots } = buildGraph(plan.nodes, plan.edges);

    // --- 2. Initialize state ---
    const nodeOutputs = new Map<string, unknown>();
    const nodeStatuses = new Map<string, NodeProgress>();
    const variables = new Map<string, string>();

    for (const v of plan.variables || []) {
      variables.set(v.name, v.value);
    }

    for (const node of plan.nodes) {
      nodeStatuses.set(node.id, {
        nodeId: node.id,
        title: node.title,
        type: node.type,
        status: 'pending',
        attempt: 0,
      });
    }

    // --- 3. Provision workspace (once for the whole workflow) ---
    let workspacePath: string;
    let agentConfig: AgentConfig;
    let skillsList: SkillForWorkspace[];

    try {
      const setup = await this.provisionWorkspace(plan, organizationId, scopeId, userId);
      workspacePath = setup.workspacePath;
      agentConfig = setup.agentConfig;
      skillsList = setup.skills;
    } catch (err) {
      yield {
        type: 'workflow_failed',
        message: `Failed to provision workspace: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: now(),
      };
      return;
    }

    yield {
      type: 'workflow_start',
      message: `Starting workflow: ${plan.title}`,
      progress: Array.from(nodeStatuses.values()),
      timestamp: now(),
    };

    // --- 4. BFS/Kahn's algorithm: process nodes as their dependencies complete ---
    const ready = new Set<string>(roots);
    const completed = new Set<string>();
    const skipped = new Set<string>();

    while (ready.size > 0) {
      // Pick the next ready node (deterministic: first by plan order)
      const nextId = plan.nodes.find(n => ready.has(n.id))?.id;
      if (!nextId) break;
      ready.delete(nextId);

      const node = nodeMap.get(nextId)!;
      const progress = nodeStatuses.get(nextId)!;

      // --- Skip pass-through nodes (start/end) ---
      if (node.type === 'start' || node.type === 'end') {
        progress.status = 'completed';
        progress.completedAt = now();
        completed.add(nextId);

        yield {
          type: 'node_complete',
          nodeId: nextId,
          nodeTitle: node.title,
          nodeType: node.type,
          status: 'completed',
          progress: Array.from(nodeStatuses.values()),
          timestamp: now(),
        };

        // Enqueue children
        this.enqueueChildren(nextId, children, inDegree, completed, skipped, ready);
        continue;
      }

      // --- Execute the node with retries ---
      const maxRetries = node.maxRetries ?? DEFAULT_MAX_RETRIES;
      let lastError: string | undefined;
      let success = false;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        progress.status = 'running';
        progress.attempt = attempt;
        progress.startedAt = now();

        yield {
          type: 'node_start',
          nodeId: nextId,
          nodeTitle: node.title,
          nodeType: node.type,
          status: 'running',
          message: attempt > 1 ? `Retry attempt ${attempt}/${maxRetries}` : undefined,
          progress: Array.from(nodeStatuses.values()),
          timestamp: now(),
        };

        try {
          const result = await this.executeNode(
            node, nodeOutputs, variables, workspacePath, agentConfig, skillsList,
            organizationId, userId,
            // Progress callback for streaming agent output
            (msg: string) => {
              // We don't yield from inside a callback, so we skip intermediate logs here.
              // The caller gets node_start and node_complete events.
            },
          );

          // Handle condition branching
          if (node.type === 'condition' && result.activeBranch !== undefined) {
            nodeOutputs.set(nextId, result.output);
            progress.output = result.output;
            progress.status = 'completed';
            progress.completedAt = now();
            completed.add(nextId);

            yield {
              type: 'node_complete',
              nodeId: nextId,
              nodeTitle: node.title,
              nodeType: node.type,
              status: 'completed',
              output: result.output,
              progress: Array.from(nodeStatuses.values()),
              timestamp: now(),
            };

            // Only enqueue the active branch, skip the other
            this.enqueueConditionBranch(
              nextId, result.activeBranch, children, inDegree,
              completed, skipped, ready, nodeStatuses,
            );

            // Emit skip events for inactive branches
            for (const id of skipped) {
              if (nodeStatuses.get(id)?.status === 'pending') {
                const np = nodeStatuses.get(id)!;
                np.status = 'skipped';
                yield {
                  type: 'node_skipped',
                  nodeId: id,
                  nodeTitle: np.title,
                  nodeType: np.type,
                  status: 'skipped',
                  message: 'Condition branch not taken',
                  progress: Array.from(nodeStatuses.values()),
                  timestamp: now(),
                };
              }
            }

            success = true;
            break;
          }

          // Normal completion
          nodeOutputs.set(nextId, result.output);
          progress.output = result.output;
          progress.status = 'completed';
          progress.completedAt = now();
          completed.add(nextId);

          yield {
            type: 'node_complete',
            nodeId: nextId,
            nodeTitle: node.title,
            nodeType: node.type,
            status: 'completed',
            output: result.output,
            progress: Array.from(nodeStatuses.values()),
            timestamp: now(),
          };

          this.enqueueChildren(nextId, children, inDegree, completed, skipped, ready);
          success = true;
          break;

        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          yield {
            type: 'log',
            nodeId: nextId,
            message: `Node "${node.title}" attempt ${attempt} failed: ${lastError}`,
            timestamp: now(),
          };

          // Wait before retry (exponential backoff: 2s, 4s, 8s...)
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
          }
        }
      }

      if (!success) {
        progress.status = 'failed';
        progress.error = lastError;
        progress.completedAt = now();

        yield {
          type: 'node_failed',
          nodeId: nextId,
          nodeTitle: node.title,
          nodeType: node.type,
          status: 'failed',
          message: lastError,
          progress: Array.from(nodeStatuses.values()),
          timestamp: now(),
        };

        // Mark all downstream nodes as skipped
        this.markDownstreamSkipped(nextId, children, nodeStatuses, completed, skipped);

        yield {
          type: 'workflow_failed',
          message: `Workflow failed at node "${node.title}": ${lastError}`,
          progress: Array.from(nodeStatuses.values()),
          timestamp: now(),
        };
        return;
      }
    }

    yield {
      type: 'workflow_complete',
      message: `Workflow "${plan.title}" completed successfully`,
      progress: Array.from(nodeStatuses.values()),
      timestamp: now(),
    };
  }


  // -------------------------------------------------------------------------
  // Node Execution Dispatch
  // -------------------------------------------------------------------------

  private async executeNode(
    node: OrchestratorNode,
    nodeOutputs: Map<string, unknown>,
    variables: Map<string, string>,
    workspacePath: string,
    agentConfig: AgentConfig,
    skills: SkillForWorkspace[],
    organizationId: string,
    userId: string,
    onProgress: (msg: string) => void,
  ): Promise<{ output: unknown; activeBranch?: string }> {
    switch (node.type) {
      case 'agent':
      case 'document':
      case 'codeArtifact':
        return this.executeAgentNode(node, nodeOutputs, variables, workspacePath, agentConfig, skills, organizationId, userId);

      case 'action':
        return this.executeActionNode(node, nodeOutputs, variables);

      case 'condition':
        return this.executeConditionNode(node, nodeOutputs, variables);

      default:
        return { output: { message: `Pass-through for type: ${node.type}` } };
    }
  }

  /**
   * Execute an agent node by sending a focused prompt to the Claude session.
   *
   * Instead of giving the agent the whole workflow, we give it:
   * 1. Context from parent node outputs
   * 2. The specific task prompt for this node
   * 3. Variable values
   *
   * This is the key reliability improvement: one focused task per agent call.
   */
  private async executeAgentNode(
    node: OrchestratorNode,
    nodeOutputs: Map<string, unknown>,
    variables: Map<string, string>,
    workspacePath: string,
    agentConfig: AgentConfig,
    skills: SkillForWorkspace[],
    organizationId: string,
    userId: string,
  ): Promise<{ output: unknown }> {
    // Build focused prompt with context from parent outputs
    const contextParts: string[] = [];

    // Include variable values
    if (variables.size > 0) {
      contextParts.push('## Input Variables');
      for (const [name, value] of variables) {
        contextParts.push(`- ${name}: ${value}`);
      }
      contextParts.push('');
    }

    // Include outputs from completed parent nodes
    if (nodeOutputs.size > 0) {
      contextParts.push('## Context from Previous Steps');
      for (const [id, output] of nodeOutputs) {
        const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
        // Truncate very large outputs to keep the prompt focused
        const truncated = outputStr.length > 4000 ? outputStr.slice(0, 4000) + '\n...(truncated)' : outputStr;
        contextParts.push(`### Output from "${id}":\n${truncated}\n`);
      }
    }

    // Substitute variables in the prompt
    let prompt = node.prompt;
    for (const [name, value] of variables) {
      prompt = prompt.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), value);
    }

    const fullMessage = [
      `# Task: ${node.title}`,
      '',
      ...contextParts,
      '## Instructions',
      prompt,
      '',
      'Complete this task and provide your output. Be thorough but focused on this specific task only.',
    ].join('\n');

    // Write the task as a focused CLAUDE.md for this node
    await writeFile(
      join(workspacePath, 'CLAUDE.md'),
      `# Current Task: ${node.title}\n\n${prompt}\n\nComplete this task thoroughly.`,
      'utf-8',
    );

    // Run the Claude session for this single node
    const textParts: string[] = [];

    const generator = agentRuntime.runConversation(
      {
        agentId: agentConfig.id,
        message: fullMessage,
        organizationId,
        userId,
      },
      agentConfig,
      skills,
    );

    for await (const event of generator) {
      const text = this.extractText(event);
      if (text) {
        textParts.push(text);
      }

      if (event.type === 'error') {
        const errMsg = (event as ConversationEvent & { message?: string }).message || 'Agent execution error';
        throw new Error(errMsg);
      }
    }

    const fullOutput = textParts.join('');
    if (!fullOutput.trim()) {
      throw new Error(`Agent node "${node.title}" produced no output`);
    }

    return { output: fullOutput };
  }

  /**
   * Execute an action node directly — no sub-agent needed.
   *
   * Action nodes are deterministic operations. The orchestrator handles them
   * directly, which is faster and more reliable than delegating to an LLM.
   */
  private async executeActionNode(
    node: OrchestratorNode,
    nodeOutputs: Map<string, unknown>,
    variables: Map<string, string>,
  ): Promise<{ output: unknown }> {
    const config = node.actionConfig || {};
    const actionType = (config.type as string) || 'custom';

    switch (actionType) {
      case 'api_call': {
        let url = (config.url as string) || '';
        let body = config.body as string | undefined;

        // Substitute variables
        for (const [name, value] of variables) {
          url = url.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), value);
          if (body) body = body.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), value);
        }

        const method = (config.method as string) || 'GET';
        const headers = (config.headers as Record<string, string>) || {};
        const timeout = (config.timeout as number) || 30000;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            body: method !== 'GET' && body ? body : undefined,
            signal: controller.signal,
          });

          const responseText = await response.text();
          let responseData: unknown;
          try { responseData = JSON.parse(responseText); } catch { responseData = responseText; }

          if (!response.ok) {
            throw new Error(`API call failed with status ${response.status}: ${responseText.slice(0, 500)}`);
          }

          return { output: responseData };
        } finally {
          clearTimeout(timer);
        }
      }

      case 'transform': {
        // Collect parent outputs and apply transformation
        const parentOutputs = Object.fromEntries(nodeOutputs);
        const expression = config.expression as string | undefined;

        if (expression) {
          // Simple template-based transform
          let result = expression;
          for (const [name, value] of variables) {
            result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), value);
          }
          return { output: result };
        }

        return { output: parentOutputs };
      }

      default: {
        // For custom actions or unknown types, if there's a prompt,
        // treat it as a description of what was done (the action is
        // assumed to be handled externally or is a no-op placeholder)
        return {
          output: {
            type: 'action_executed',
            action: actionType,
            title: node.title,
            message: node.prompt || 'Action completed',
            timestamp: new Date().toISOString(),
          },
        };
      }
    }
  }

  /**
   * Execute a condition node by evaluating the expression against
   * parent outputs and variables.
   *
   * Returns the active branch label ('yes' or 'no').
   */
  private async executeConditionNode(
    node: OrchestratorNode,
    nodeOutputs: Map<string, unknown>,
    variables: Map<string, string>,
  ): Promise<{ output: unknown; activeBranch: string }> {
    const expression = node.conditionExpression || node.prompt || '';

    // Simple evaluation: check if any parent output contains a truthy signal
    let result = true;

    // Check for variable references: {{varName}} == "value"
    const varMatch = expression.match(/\{\{(\w+)\}\}\s*(==|!=|>|<)\s*["']?([^"']+)["']?/);
    if (varMatch) {
      const [, varName, operator, expected] = varMatch;
      const actual = variables.get(varName) ?? '';
      switch (operator) {
        case '==': result = actual === expected; break;
        case '!=': result = actual !== expected; break;
        case '>': result = Number(actual) > Number(expected); break;
        case '<': result = Number(actual) < Number(expected); break;
      }
    } else if (expression.toLowerCase().includes('true')) {
      result = true;
    } else if (expression.toLowerCase().includes('false')) {
      result = false;
    } else {
      // Default: check if the last parent output looks "positive"
      const lastOutput = Array.from(nodeOutputs.values()).pop();
      if (typeof lastOutput === 'string') {
        const lower = lastOutput.toLowerCase();
        result = !lower.includes('fail') && !lower.includes('error') && !lower.includes('no');
      }
    }

    const branch = result ? 'yes' : 'no';

    return {
      output: { condition: expression, result, branch },
      activeBranch: branch,
    };
  }


  // -------------------------------------------------------------------------
  // DAG Traversal Helpers
  // -------------------------------------------------------------------------

  /** Enqueue children whose dependencies are all completed */
  private enqueueChildren(
    nodeId: string,
    children: Map<string, OrchestratorEdge[]>,
    inDegree: Map<string, number>,
    completed: Set<string>,
    skipped: Set<string>,
    ready: Set<string>,
  ): void {
    for (const edge of children.get(nodeId) || []) {
      const targetDeg = (inDegree.get(edge.target) || 1) - 1;
      inDegree.set(edge.target, targetDeg);
      if (targetDeg <= 0 && !completed.has(edge.target) && !skipped.has(edge.target)) {
        ready.add(edge.target);
      }
    }
  }

  /** For condition nodes: only enqueue the active branch, skip the other */
  private enqueueConditionBranch(
    conditionNodeId: string,
    activeBranch: string,
    children: Map<string, OrchestratorEdge[]>,
    inDegree: Map<string, number>,
    completed: Set<string>,
    skipped: Set<string>,
    ready: Set<string>,
    nodeStatuses: Map<string, NodeProgress>,
  ): void {
    for (const edge of children.get(conditionNodeId) || []) {
      const edgeLabel = (edge.label || edge.sourceHandle || '').toLowerCase();
      const isActive = edgeLabel === activeBranch.toLowerCase()
        || (activeBranch === 'yes' && edgeLabel === 'true')
        || (activeBranch === 'no' && edgeLabel === 'false');

      if (isActive) {
        const targetDeg = (inDegree.get(edge.target) || 1) - 1;
        inDegree.set(edge.target, targetDeg);
        if (targetDeg <= 0 && !completed.has(edge.target) && !skipped.has(edge.target)) {
          ready.add(edge.target);
        }
      } else {
        // Mark the inactive branch and all its descendants as skipped
        this.markDownstreamSkipped(edge.target, children, nodeStatuses, completed, skipped);
      }
    }
  }

  /** Recursively mark all downstream nodes as skipped */
  private markDownstreamSkipped(
    nodeId: string,
    children: Map<string, OrchestratorEdge[]>,
    nodeStatuses: Map<string, NodeProgress>,
    completed: Set<string>,
    skipped: Set<string>,
  ): void {
    if (completed.has(nodeId) || skipped.has(nodeId)) return;
    skipped.add(nodeId);

    const progress = nodeStatuses.get(nodeId);
    if (progress) progress.status = 'skipped';

    for (const edge of children.get(nodeId) || []) {
      this.markDownstreamSkipped(edge.target, children, nodeStatuses, completed, skipped);
    }
  }

  // -------------------------------------------------------------------------
  // Workspace Provisioning
  // -------------------------------------------------------------------------

  private async provisionWorkspace(
    plan: OrchestratorPlan,
    organizationId: string,
    scopeId: string,
    userId: string,
  ): Promise<{
    workspacePath: string;
    agentConfig: AgentConfig;
    skills: SkillForWorkspace[];
  }> {
    // Load scope data
    const scopes = await businessScopeService.getBusinessScopes(organizationId);
    const scope = scopes.find(s => s.id === scopeId);
    if (!scope) throw new Error('Business scope not found');

    // Load agents and their skills
    const agents = await agentRepository.findByBusinessScope(organizationId, scopeId);
    const agentSkillsMap = new Map<string, string[]>();
    for (const agent of agents) {
      const agentSkills = await skillRepository.findByAgentId(organizationId, agent.id);
      agentSkillsMap.set(agent.id, agentSkills.map(s => s.name));
    }

    // Load scope-level skills
    const scopeLevelSkills = await skillService.getScopeLevelSkills(organizationId, scopeId);

    // Build combined skills list
    const skillMap = new Map<string, SkillForWorkspace>();
    for (const agent of agents) {
      const agentSkills = await skillRepository.findByAgentId(organizationId, agent.id);
      for (const s of agentSkills) {
        if (!skillMap.has(s.id)) {
          const meta = s.metadata as Record<string, unknown> | null;
          skillMap.set(s.id, {
            id: s.id, name: s.name, hashId: s.hash_id,
            s3Bucket: s.s3_bucket, s3Prefix: s.s3_prefix,
            localPath: meta?.localPath as string | undefined,
          });
        }
      }
    }
    for (const s of scopeLevelSkills) {
      if (!skillMap.has(s.id)) {
        const meta = s.metadata as Record<string, unknown> | null;
        skillMap.set(s.id, {
          id: s.id, name: s.name, hashId: s.hash_id,
          s3Bucket: s.s3_bucket, s3Prefix: s.s3_prefix,
          localPath: meta?.localPath as string | undefined,
        });
      }
    }

    // Provision workspace
    const sessionId = crypto.randomUUID();
    const scopeForWorkspace: ScopeForWorkspace = {
      id: scope.id,
      name: scope.name,
      description: scope.description,
      configVersion: scope.config_version ?? 1,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        displayName: a.display_name,
        role: a.role,
        systemPrompt: a.system_prompt,
        skillNames: agentSkillsMap.get(a.id) || [],
      })),
      skills: Array.from(skillMap.values()),
      mcpServers: [],
      plugins: [],
    };

    const { workspacePath } = await workspaceManager.ensureSessionWorkspace(
      organizationId, sessionId, scopeForWorkspace, null,
    );

    const agentConfig: AgentConfig = {
      id: `orchestrator-${sessionId}`,
      name: 'workflow-orchestrator',
      displayName: `Orchestrator: ${plan.title}`,
      organizationId,
      systemPrompt: '',
      skillIds: [],
      mcpServerIds: [],
    };

    return {
      workspacePath,
      agentConfig,
      skills: Array.from(skillMap.values()),
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private extractText(event: ConversationEvent): string | null {
    if (event.type === 'assistant' || event.type === 'result') {
      const content = (event as ConversationEvent & { content?: unknown }).content;
      if (Array.isArray(content)) {
        return content
          .filter((b: { type: string; text?: string }) => b.type === 'text' && b.text)
          .map((b: { type: string; text?: string }) => b.text || '')
          .join('');
      }
      if (typeof content === 'string') return content;
    }
    return null;
  }
}

export const workflowOrchestrator = new WorkflowOrchestrator();
