/**
 * Workflow Generator Service
 *
 * Uses the Claude Agent SDK (same as Chat Mode and Scope Generator)
 * to generate workflow plans from natural language descriptions.
 */

import { agentRuntime } from './agent-runtime-factory.js';
import type { AgentConfig, ConversationEvent } from './agent-runtime.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratedWorkflowTask {
  id: string;
  title: string;
  type: 'agent' | 'action' | 'condition' | 'document' | 'codeArtifact';
  prompt: string;
  dependentTasks?: string[];
  agentId?: string;
  requiredIntegrations?: string[];
  config?: Record<string, unknown>;
}

export interface GeneratedWorkflowVariable {
  variableId: string;
  variableType: 'string' | 'resource';
  name: string;
  description: string;
  required: boolean;
  value?: Array<{ type: string; text?: string }>;
}

export interface GeneratedWorkflowPlan {
  title: string;
  description?: string;
  tasks: GeneratedWorkflowTask[];
  variables?: GeneratedWorkflowVariable[];
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const WORKFLOW_GENERATOR_SYSTEM_PROMPT = `You are a workflow architect for an AI agent platform. Your job is to help users design structured workflow plans through conversation.

## Your Approach

1. FIRST, analyze the user's request. If it's vague or missing critical details, ask 2-4 targeted clarifying questions. Focus on:
   - What specific systems/tools/APIs are involved? (e.g. "Which CRM?" not just "a system")
   - What are the key decision criteria or thresholds? (e.g. "What deal size triggers management approval?")
   - What are the expected inputs and outputs?
   - Are there specific compliance or business rules to follow?

2. ONLY generate the workflow JSON when you have enough specifics to write actionable, concrete task prompts. If the user answers your questions, generate the workflow. If the user's initial request is already very detailed and specific, you may skip clarification and generate directly.

3. When you DO generate, respond with ONLY a valid JSON object — no markdown, no code fences, no explanation text. Just the raw JSON.

## JSON Schema (use ONLY when generating)

{
  "title": "string (concise workflow title, 3-8 words)",
  "description": "string (1-2 sentences summarizing the workflow)",
  "tasks": [
    {
      "id": "string (e.g. task-1, task-2)",
      "title": "string (short display name for the node)",
      "type": "string (one of the task types below)",
      "prompt": "string (detailed, specific execution instructions — name real systems, concrete thresholds, exact fields)",
      "dependentTasks": ["array of task IDs that must complete before this one"],
      "agentId": "string (optional, only if an available agent is assigned)",
      "requiredIntegrations": ["array of external services this task needs, e.g. 'SendGrid', 'GitHub API', 'Slack', 'SMTP'. Only include if the task makes external API calls or uses third-party services. Omit for pure AI reasoning tasks."]
    }
  ],
  "variables": [
    {
      "variableId": "string (e.g. var-1)",
      "variableType": "string|resource",
      "name": "string (camelCase variable name)",
      "description": "string (what this variable represents)",
      "required": true,
      "value": [{ "type": "text", "text": "optional default value" }]
    }
  ]
}

## Task Types — use ONLY these types

### agent
An AI agent that processes information, reasons, and generates output. Use this for any step that requires intelligence: analysis, summarization, writing, decision-making, translation, classification, etc.
This is the most common type. When in doubt, use "agent".

### action
A deterministic operation described in natural language: API calls, data transformation, database queries, file operations, sending emails/notifications, webhooks. Use this for steps that don't require AI reasoning. The description should clearly state what action to perform — Claude will figure out how to execute it using available skills and tools.

### condition
A branching point that evaluates criteria and routes the workflow down different paths. Use this WHENEVER the workflow needs to take different actions based on a previous step's output or a decision point. Common patterns:
- Approval/rejection decisions (e.g. "if approved, proceed; if rejected, notify")
- Threshold checks (e.g. "if score > 80, auto-approve; otherwise, escalate")
- Classification routing (e.g. "if sentiment is negative, escalate; otherwise, auto-respond")
- Yes/no decisions, pass/fail checks, any binary or multi-path branching
IMPORTANT: If the user describes "if X then Y, otherwise Z" or "based on the result, do A or B", you MUST use a condition node — do NOT embed the branching logic inside an action or agent node.

### document
Generates a structured document, report, or formatted output. Use this when the primary output of a step is a deliverable document (PDF report, markdown summary, formatted email draft, etc.).

### codeArtifact
Generates or executes code. Use this for steps that produce code snippets, scripts, SQL queries, configuration files, or any programmatic artifact.

## Rules (apply when generating JSON)

1. Use sequential dependencies (dependentTasks) to define execution order. Task B depends on Task A means A runs first.
2. For parallel steps, give them the same dependentTasks (they'll run concurrently).
3. Every workflow should have at least one task with no dependencies (the entry point).
4. Reference variables in prompts using @{var:variableName} syntax.
5. Extract user-configurable inputs as variables (e.g. target audience, data source, language).
6. Task prompts must be detailed, specific, and actionable — name real systems, use concrete values, specify exact fields and formats. NEVER use vague phrases like "submit to the system" or "send to the platform".
7. NEVER reference other tasks by their IDs (e.g. "task-3", "task-6") in any node's prompt text. Instead, always refer to other steps by their descriptive title (e.g. "the Security Validation step", "the result from the Approval Decision step"). Task IDs are internal identifiers used only in the dependentTasks array — they must never appear in human-readable prompt text. This applies to ALL node types: agent, action, condition, document, and codeArtifact.
8. For condition nodes specifically, describe the evaluation criteria and what true/false means without referencing downstream tasks at all (e.g. "Evaluate whether the approval decision is 'approved'. True = approved, False = rejected or timeout"). The workflow engine handles routing based on the canvas edges.
9. If available agents are listed, assign them to tasks where their role is a strong match. Use the agentId field ONLY when an agent's role clearly fits the task. Do NOT force-assign the same agent to every task — leave agentId empty for tasks where no agent is a good fit.
10. Keep task count reasonable: 3-8 tasks for most workflows. Consolidate related steps into single tasks rather than creating one task per bullet point.
11. Do NOT invent agent IDs. Only use IDs from the provided available agents list.
12. When the user provides a very detailed multi-step description, synthesize it into a concise workflow. Group related steps into logical tasks rather than creating a 1:1 mapping of every sub-step.
13. OUTPUT FORMAT: Your JSON output must be machine-parseable. Do NOT wrap it in markdown code fences. Do NOT add any text before or after the JSON object. Use proper JSON escaping inside string values: use \\n for newlines, \\" for quotes, \\\\ for backslashes. Never put raw line breaks inside a JSON string value. Use numbered lists (1. 2. 3.) separated by \\n instead of visual line breaks.

Remember: Ask clarifying questions first if the request is vague. When generating, output ONLY the raw JSON object — no markdown, no code fences, no explanation.`;


// ---------------------------------------------------------------------------
// Patch generation prompt (for modifying existing workflows)
// ---------------------------------------------------------------------------

const WORKFLOW_PATCH_SYSTEM_PROMPT = `You are a workflow modification assistant. Given a current workflow plan and a modification request, either ask clarifying questions or generate patch operations.

## Your Approach

1. If the modification request is ambiguous (e.g. "add a node" without specifying where or what it does), ask a brief clarifying question.
2. If the request is clear enough to act on, respond with ONLY a valid JSON array of patch operations. No markdown, no code fences, no explanation text. Just the raw JSON array.

## Patch Operations

- updateTitle: Change workflow title
  { "op": "updateTitle", "title": "New Title" }

- createTask: Add a new task
  { "op": "createTask", "task": { "id": "task-new", "title": "New Task", "type": "agent", "prompt": "Instructions", "dependentTasks": [] } }

- updateTask: Modify an existing task
  { "op": "updateTask", "taskId": "task-1", "taskData": { "title": "New Title" } }

- deleteTask: Remove a task
  { "op": "deleteTask", "taskId": "task-1" }

- createVariable: Add a new variable
  { "op": "createVariable", "variable": { "variableId": "var-new", "name": "varName", "variableType": "string", "description": "Description", "required": false, "value": [] } }

- updateVariable: Modify a variable
  { "op": "updateVariable", "variableId": "var-1", "variableData": { "name": "newName" } }

- deleteVariable: Remove a variable
  { "op": "deleteVariable", "variableId": "var-1" }

## Valid Task Types
agent, action, condition, document, codeArtifact

## Rules
1. Return a JSON array of patch operations (even for a single change).
2. Use exact task/variable IDs from the current plan.
3. When deleting a task, also update any tasks that depend on it.
4. When inserting a task between two existing tasks, update dependencies accordingly.
5. Task prompts must be specific and actionable — name real systems, use concrete values.
6. OUTPUT FORMAT: Your JSON output must be machine-parseable. Do NOT wrap it in markdown code fences. Use proper JSON escaping inside string values: use \\n for newlines, \\" for quotes. Never put raw line breaks inside a JSON string value.

Remember: Ask if unclear. When generating patches, output ONLY the raw JSON array — no markdown, no code fences, no explanation.`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Fix unescaped control characters inside JSON string values.
 * Walks character by character tracking in-string state.
 */
function fixUnescapedControlChars(json: string): string {
  const out: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escaped) { out.push(ch); escaped = false; continue; }
    if (ch === '\\' && inString) { out.push(ch); escaped = true; continue; }
    if (ch === '"') { inString = !inString; out.push(ch); continue; }
    if (inString) {
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        if (ch === '\n') { out.push('\\n'); continue; }
        if (ch === '\r') { out.push('\\r'); continue; }
        if (ch === '\t') { out.push('\\t'); continue; }
        if (ch === '\b') { out.push('\\b'); continue; }
        if (ch === '\f') { out.push('\\f'); continue; }
        out.push('\\u' + code.toString(16).padStart(4, '0'));
        continue;
      }
    }
    out.push(ch);
  }
  return out.join('');
}

export class WorkflowGeneratorService {
  /**
   * Generate a workflow plan by streaming Claude's response.
   * Yields ConversationEvents that can be forwarded as SSE.
   * Supports multi-turn conversation via history parameter.
   */
  async *generate(
    description: string,
    availableAgents?: Array<{ id: string; name: string; role: string; skills?: string[] }>,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): AsyncGenerator<ConversationEvent> {
    const agentConfig: AgentConfig = {
      id: 'workflow-generator',
      name: 'workflow-generator',
      displayName: 'Workflow Generator',
      organizationId: 'system',
      systemPrompt: WORKFLOW_GENERATOR_SYSTEM_PROMPT,
      skillIds: [],
      mcpServerIds: [],
    };

    let message = description;

    // Only add agent context on the first message (no history)
    if ((!history || history.length === 0) && availableAgents && availableAgents.length > 0) {
      message += '\n\n## Available Agents (only assign if role is a strong match)\n';
      for (const agent of availableAgents) {
        message += `- ${agent.name} (ID: ${agent.id}): ${agent.role}`;
        if (agent.skills && agent.skills.length > 0) {
          message += ` [skills: ${agent.skills.join(', ')}]`;
        }
        message += '\n';
      }
    }

    // Build conversation with history
    if (history && history.length > 0) {
      // Prepend agent context to the first user message in history
      let firstUserMsg = history[0];
      if (firstUserMsg.role === 'user' && availableAgents && availableAgents.length > 0) {
        let agentContext = '\n\n## Available Agents (only assign if role is a strong match)\n';
        for (const agent of availableAgents) {
          agentContext += `- ${agent.name} (ID: ${agent.id}): ${agent.role}`;
          if (agent.skills && agent.skills.length > 0) {
            agentContext += ` [skills: ${agent.skills.join(', ')}]`;
          }
          agentContext += '\n';
        }
        firstUserMsg = { ...firstUserMsg, content: firstUserMsg.content + agentContext };
      }

      // Build the full conversation as a single message with context
      const conversationParts: string[] = [];
      const allMessages = [firstUserMsg, ...history.slice(1)];
      for (const msg of allMessages) {
        conversationParts.push(`[${msg.role.toUpperCase()}]: ${msg.content}`);
      }
      conversationParts.push(`[USER]: ${message}`);
      message = `Here is our conversation so far:\n\n${conversationParts.join('\n\n')}\n\nPlease continue based on the latest message. If you now have enough information, generate the workflow JSON. Otherwise, ask follow-up questions.`;
    }

    yield* agentRuntime.runConversation(
      {
        agentId: 'workflow-generator',
        message,
        organizationId: 'system',
        userId: 'system',
      },
      agentConfig,
      [], // no skills needed for generation
    );
  }

  /**
   * Generate patch operations for modifying an existing workflow.
   * Yields ConversationEvents that can be forwarded as SSE.
   * Supports multi-turn conversation via history parameter.
   */
  async *generatePatches(
    currentPlan: { title: string; tasks: unknown[]; variables?: unknown[] },
    modificationRequest: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): AsyncGenerator<ConversationEvent> {
    const agentConfig: AgentConfig = {
      id: 'workflow-patcher',
      name: 'workflow-patcher',
      displayName: 'Workflow Patcher',
      organizationId: 'system',
      systemPrompt: WORKFLOW_PATCH_SYSTEM_PROMPT,
      skillIds: [],
      mcpServerIds: [],
    };

    let message: string;

    if (history && history.length > 0) {
      const conversationParts: string[] = [];
      for (const msg of history) {
        conversationParts.push(`[${msg.role.toUpperCase()}]: ${msg.content}`);
      }
      conversationParts.push(`[USER]: ${modificationRequest}`);
      message = `Current workflow:\n${JSON.stringify(currentPlan, null, 2)}\n\nConversation:\n${conversationParts.join('\n\n')}\n\nPlease continue based on the latest message. If you have enough information, generate the patch JSON array. Otherwise, ask follow-up questions.`;
    } else {
      message = `Current workflow:\n${JSON.stringify(currentPlan, null, 2)}\n\nModification request: ${modificationRequest}`;
    }

    yield* agentRuntime.runConversation(
      {
        agentId: 'workflow-patcher',
        message,
        organizationId: 'system',
        userId: 'system',
      },
      agentConfig,
      [],
    );
  }

  /**
   * Parse the generated JSON from Claude's response content blocks.
   */
  parseGeneratedPlan(contentBlocks: Array<{ type: string; text?: string }>): GeneratedWorkflowPlan {
    const fullText = contentBlocks
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text!)
      .join('');

    let jsonStr = fullText.trim();

    // Strip markdown code fences if present
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1]!.trim();
    }

    // Find JSON object boundaries
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    // Fix unescaped control characters inside JSON string values.
    // Walk character by character tracking in-string state, since regex-based
    // approaches fail when raw newlines break the pattern.
    jsonStr = fixUnescapedControlChars(jsonStr);

    const parsed = JSON.parse(jsonStr);

    // Validate structure
    if (!parsed.title || !Array.isArray(parsed.tasks)) {
      throw new Error('Invalid workflow plan: missing title or tasks');
    }

    // Validate and normalize task types
    const validTypes = new Set(['agent', 'action', 'condition', 'document', 'codeArtifact']);
    for (const task of parsed.tasks) {
      if (!task.id || !task.title) {
        throw new Error(`Invalid task: missing id or title`);
      }
      if (!validTypes.has(task.type)) {
        // Default unknown types to 'agent'
        task.type = 'agent';
      }
      if (!Array.isArray(task.dependentTasks)) {
        task.dependentTasks = [];
      }
    }

    // Normalize variables
    if (parsed.variables && Array.isArray(parsed.variables)) {
      for (const v of parsed.variables) {
        if (!v.variableType || !['string', 'resource'].includes(v.variableType)) {
          v.variableType = 'string';
        }
        if (!Array.isArray(v.value)) {
          v.value = [];
        }
      }
    } else {
      parsed.variables = [];
    }

    return parsed as GeneratedWorkflowPlan;
  }

  /**
   * Parse patch operations from Claude's response content blocks.
   */
  parsePatches(contentBlocks: Array<{ type: string; text?: string }>): unknown[] {
    const fullText = contentBlocks
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text!)
      .join('');

    let jsonStr = fullText.trim();

    // Strip markdown code fences if present
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1]!.trim();
    }

    // Find JSON array boundaries
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    }

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      throw new Error('Invalid patches: expected a JSON array');
    }

    return parsed;
  }
}

export const workflowGeneratorService = new WorkflowGeneratorService();
