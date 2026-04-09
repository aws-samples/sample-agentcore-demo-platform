/**
 * Agent Runtime Provider — abstraction layer for swappable AI agent backends.
 *
 * Consumers (chat.service, workflow-generator, scope-generator) program against
 * the `AgentRuntime` interface. The active implementation is selected at startup
 * via the `AGENT_RUNTIME` env var:
 *
 *   "claude"   → ClaudeAgentService  (default, existing behavior)
 *   "openclaw" → OpenClawProvider    (OpenClaw k8s operator gateway)
 *
 * AgentCore (Bedrock container isolation) remains a separate concern — it wraps
 * the Claude runtime in a container but still speaks the same ConversationEvent
 * protocol. If you enable AgentCore, the scope-bound flow uses it; system-level
 * agents (workflow-gen, scope-gen) still go through the base runtime.
 */

import type {
  ConversationEvent,
  AgentConfig,
  ContentBlock,
  MCPServerSDKConfig,
} from './claude-agent.service.js';
import type { SkillForWorkspace } from './workspace-manager.js';

// Re-export shared types so consumers can import from this module only
export type { ConversationEvent, AgentConfig, ContentBlock };

// ---------------------------------------------------------------------------
// Runtime-agnostic options (superset of what each provider needs)
// ---------------------------------------------------------------------------

export interface AgentRuntimeOptions {
  agentId: string;
  sessionId?: string;
  /** Provider-specific session ID for resume (Claude session ID, OpenClaw conversation ID, etc.) */
  providerSessionId?: string;
  message: string;
  organizationId: string;
  userId: string;
  /** Pre-provisioned workspace path (local providers only). */
  workspacePath?: string;
  /** Business scope ID (required for AgentCore runtime). */
  scopeId?: string;
}

// ---------------------------------------------------------------------------
// AgentRuntime interface
// ---------------------------------------------------------------------------

export interface AgentRuntime {
  readonly name: string;

  /**
   * Stream a conversation turn. Yields ConversationEvents compatible with
   * the existing SSE protocol so chat.service doesn't need to change its
   * event handling.
   */
  runConversation(
    options: AgentRuntimeOptions,
    agentConfig: AgentConfig,
    skills: SkillForWorkspace[],
    pluginPaths?: string[],
    mcpServers?: Record<string, MCPServerSDKConfig>,
  ): AsyncGenerator<ConversationEvent>;

  /** Disconnect / abort a running session. */
  disconnectSession(sessionId: string): Promise<void>;

  /** Disconnect all active sessions (graceful shutdown). */
  disconnectAll(): Promise<number>;

  /** Number of currently active sessions. */
  readonly activeSessionCount: number;

  /** Check if a session is currently tracked. */
  hasSession(sessionId: string): boolean;
}
