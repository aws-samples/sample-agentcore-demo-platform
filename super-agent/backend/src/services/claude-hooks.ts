/**
 * Security hooks for Claude Agent SDK.
 *
 * Provides pre-tool-use hook functions that inspect and optionally block
 * dangerous commands and restrict skill access to allowed skills only.
 *
 * Hook signatures match the real SDK HookCallback type:
 *   (input: HookInput, toolUseID: string | undefined, options: { signal: AbortSignal }) => Promise<HookJSONOutput>
 *
 * Requirements: 6.1, 6.2, 6.3
 */

/**
 * Binary file extensions that should be blocked from the Read tool.
 * Image formats (png, jpg, jpeg) are excluded — the agent may read them.
 */
const BINARY_EXTENSIONS = new Set([
  'gif', 'webp', 'bmp', 'ico', 'svg',
  'mp3', 'mp4', 'wav', 'avi', 'mov', 'mkv', 'flac', 'ogg',
  'zip', 'tar', 'gz', 'bz2', 'rar', '7z',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'exe', 'dll', 'so', 'dylib', 'bin', 'dat',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
]);

/**
 * Pre-tool-use hook that blocks the Read tool from attempting to read
 * binary/image files. The Claude Code SDK's Read tool reads files as text,
 * which corrupts binary data and causes API errors when the garbled content
 * is sent back in the conversation.
 */
export async function binaryFileReadBlocker(
  input: HookInput,
  _toolUseID: string | undefined,
  _options: { signal: AbortSignal },
): Promise<HookDecision> {
  if (input.tool_name !== 'Read') return {};

  const toolInput = input.tool_input as Record<string, unknown> | undefined;
  const filePath = (toolInput?.file_path ?? toolInput?.path) as string | undefined;
  if (typeof filePath !== 'string') return {};

  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext && BINARY_EXTENSIONS.has(ext)) {
    return {
      decision: 'block',
      reason: `Cannot read binary file "${filePath}" as text. Image and binary files are not supported by the Read tool. Inform the user that this file type (.${ext}) cannot be viewed in the chat.`,
    };
  }

  return {};
}

/**
 * A dangerous command pattern with its associated reason for blocking.
 */
export interface DangerousPattern {
  pattern: RegExp;
  reason: string;
}

/**
 * Dangerous command patterns to block in Bash tool invocations.
 */
export const DANGEROUS_PATTERNS: DangerousPattern[] = [
  { pattern: /rm\s+(-[rfRf]+\s+)?\//, reason: 'Recursive deletion from root' },
  { pattern: /dd\s+if=\/dev\/(zero|random|urandom)/, reason: 'Disk overwrite command' },
  { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, reason: 'Fork bomb' },
  { pattern: /curl\s+.*\|\s*(bash|sh)/, reason: 'Piping remote script to shell' },
  { pattern: /wget\s+.*\|\s*(bash|sh)/, reason: 'Piping remote script to shell' },
];

/**
 * Patterns that indicate path traversal or access outside the workspace.
 */
export const PATH_ESCAPE_PATTERNS: DangerousPattern[] = [
  { pattern: /(?:^|\s|\/)\.\.(\/|$|\s)/, reason: 'Path traversal via ".." is not allowed' },
  { pattern: /(?:^|\s)\/(?:Users|home|etc|var|tmp|opt|usr|root|proc|sys|dev|boot|mnt|media)\b/, reason: 'Absolute path outside workspace is not allowed' },
];

/**
 * Hook output matching the SDK's SyncHookJSONOutput type.
 * decision: 'approve' | 'block'
 */
export interface HookDecision {
  decision?: 'approve' | 'block';
  reason?: string;
}

/**
 * Hook input matching the SDK's PreToolUseHookInput type.
 */
export interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
  hook_event_name: string;
  tool_name?: string;
  tool_input?: unknown;
  [key: string]: unknown;
}

/**
 * Type for a PreToolUse hook function matching the real SDK HookCallback.
 */
export type PreToolUseHook = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal },
) => Promise<HookDecision>;

/**
 * Pre-tool-use hook that inspects Bash tool input against dangerous
 * command patterns and returns a block decision with reason if a match
 * is found.
 *
 * The SDK passes tool input in input.tool_input (not as the first arg directly).
 *
 * Requirements: 6.1, 6.2
 */
export async function dangerousCommandBlocker(
  input: HookInput,
  _toolUseID: string | undefined,
  _options: { signal: AbortSignal },
): Promise<HookDecision> {
  const toolInput = input.tool_input as Record<string, unknown> | undefined;
  const command = toolInput?.command;

  // Check Bash commands against dangerous patterns and path escape patterns
  if (typeof command === 'string') {
    for (const { pattern, reason } of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        return { decision: 'block', reason };
      }
    }
    for (const { pattern, reason } of PATH_ESCAPE_PATTERNS) {
      if (pattern.test(command)) {
        return { decision: 'block', reason };
      }
    }
  }

  // Check file_path arguments (Read, Write, Edit tools) for path traversal.
  // Allow absolute paths that fall inside the workspace cwd.
  const filePath = toolInput?.file_path ?? toolInput?.path;
  if (typeof filePath === 'string') {
    const cwd = input.cwd;
    const isInsideWorkspace = cwd && filePath.startsWith(cwd);
    if (!isInsideWorkspace) {
      for (const { pattern, reason } of PATH_ESCAPE_PATTERNS) {
        if (pattern.test(filePath)) {
          return { decision: 'block', reason };
        }
      }
    }
  }

  return {};
}

/**
 * Factory function that creates a PreToolUse hook restricting Skill tool
 * access to only the skills in the provided allowed list.
 *
 * Requirements: 6.3
 */
export function createSkillAccessChecker(allowedSkillNames: string[]): PreToolUseHook {
  const allowedSet = new Set(allowedSkillNames);

  return async (
    input: HookInput,
    _toolUseID: string | undefined,
    _options: { signal: AbortSignal },
  ): Promise<HookDecision> => {
    const toolInput = input.tool_input as Record<string, unknown> | undefined;
    const skillName = toolInput?.skill_name;

    if (typeof skillName !== 'string') {
      return {};
    }

    if (!allowedSet.has(skillName)) {
      return {
        decision: 'block',
        reason: `Skill '${skillName}' is not in the allowed skill list`,
      };
    }

    return {};
  };
}
