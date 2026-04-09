/**
 * Workflow Progress MCP Server
 *
 * In-process MCP server that provides tools for Claude to report workflow
 * step progress. Uses the SDK's createSdkMcpServer() so it runs in the
 * same Node process — no subprocess overhead.
 *
 * Tools:
 *   - workflow_step_start(taskId)    → signals a step is beginning
 *   - workflow_step_complete(taskId) → signals a step finished successfully
 *   - workflow_step_failed(taskId, reason?) → signals a step failed
 *
 * Each tool call pushes a WorkflowProgressEvent into a callback provided
 * by the executor, which yields it as an SSE event to the frontend.
 */

import type { WorkflowProgressEvent } from './workflow-executor-v2.js';

// We dynamically import the SDK to match the pattern used in claude-agent.service.ts
let sdkModule: {
  createSdkMcpServer: typeof import('@anthropic-ai/claude-agent-sdk').createSdkMcpServer;
  tool: typeof import('@anthropic-ai/claude-agent-sdk').tool;
} | null = null;

async function loadSdk() {
  if (!sdkModule) {
    const mod = await import('@anthropic-ai/claude-agent-sdk');
    sdkModule = { createSdkMcpServer: mod.createSdkMcpServer, tool: mod.tool };
  }
  return sdkModule;
}

/**
 * Node title map for enriching events with human-readable titles.
 */
export type NodeTitleMap = Map<string, string>;

/**
 * Callback invoked when Claude calls a progress tool.
 */
export type ProgressCallback = (event: WorkflowProgressEvent) => void;

/**
 * Create an in-process MCP server with workflow progress reporting tools.
 *
 * @param nodeTitleMap - Map of taskId → human-readable title
 * @param onProgress  - Callback fired for each progress event
 * @returns SDK MCP server config ready to pass into query() options.mcpServers
 */
export async function createWorkflowProgressServer(
  nodeTitleMap: NodeTitleMap,
  onProgress: ProgressCallback,
) {
  const { createSdkMcpServer, tool } = await loadSdk();
  // Import zod v4 to match the SDK's peer dependency
  const { z } = await import('zod/v4');

  const server = createSdkMcpServer({
    name: 'workflow-progress',
    version: '1.0.0',
    tools: [
      tool(
        'workflow_step_start',
        'Signal that you are starting a workflow step. Call this BEFORE beginning work on each step.',
        { taskId: z.string().describe('The task ID from the execution plan (e.g. "task-abc123")') },
        async (args) => {
          const title = nodeTitleMap.get(args.taskId);
          onProgress({ type: 'step_start', taskId: args.taskId, taskTitle: title });
          return { content: [{ type: 'text' as const, text: `Step "${title || args.taskId}" marked as started.` }] };
        },
      ),
      tool(
        'workflow_step_complete',
        'Signal that you have completed a workflow step successfully. Call this AFTER finishing work on each step.',
        {
          taskId: z.string().describe('The task ID from the execution plan'),
          summary: z.string().optional().describe('Brief summary of what was accomplished'),
        },
        async (args) => {
          const title = nodeTitleMap.get(args.taskId);
          onProgress({ type: 'step_complete', taskId: args.taskId, taskTitle: title, message: args.summary });
          return { content: [{ type: 'text' as const, text: `Step "${title || args.taskId}" marked as complete.` }] };
        },
      ),
      tool(
        'workflow_step_failed',
        'Signal that a workflow step has failed. Call this if a step cannot be completed.',
        {
          taskId: z.string().describe('The task ID from the execution plan'),
          reason: z.string().optional().describe('Why the step failed'),
        },
        async (args) => {
          const title = nodeTitleMap.get(args.taskId);
          onProgress({ type: 'step_failed', taskId: args.taskId, taskTitle: title, message: args.reason });
          return { content: [{ type: 'text' as const, text: `Step "${title || args.taskId}" marked as failed.` }] };
        },
      ),
    ],
  });

  return server;
}
