/**
 * Claude Agent Runtime — wraps the existing ClaudeAgentService behind the
 * AgentRuntime interface. This is a thin adapter; all real logic stays in
 * claude-agent.service.ts.
 */

import type { AgentRuntime, AgentRuntimeOptions } from './agent-runtime.js';
import type { ConversationEvent, AgentConfig, MCPServerSDKConfig } from './claude-agent.service.js';
import { claudeAgentService } from './claude-agent.service.js';
import type { SkillForWorkspace } from './workspace-manager.js';

export class ClaudeAgentRuntime implements AgentRuntime {
  readonly name = 'claude';

  async *runConversation(
    options: AgentRuntimeOptions,
    agentConfig: AgentConfig,
    skills: SkillForWorkspace[],
    pluginPaths?: string[],
    mcpServers?: Record<string, MCPServerSDKConfig>,
  ): AsyncGenerator<ConversationEvent> {
    yield* claudeAgentService.runConversation(
      {
        agentId: options.agentId,
        sessionId: options.sessionId,
        claudeSessionId: options.providerSessionId,
        message: options.message,
        organizationId: options.organizationId,
        userId: options.userId,
        workspacePath: options.workspacePath,
      },
      agentConfig,
      skills,
      pluginPaths,
      mcpServers,
    );
  }

  async disconnectSession(sessionId: string): Promise<void> {
    return claudeAgentService.disconnectSession(sessionId);
  }

  async disconnectAll(): Promise<number> {
    return claudeAgentService.disconnectAll();
  }

  get activeSessionCount(): number {
    return claudeAgentService.activeClientCount;
  }

  hasSession(sessionId: string): boolean {
    return claudeAgentService.hasSession(sessionId);
  }
}
