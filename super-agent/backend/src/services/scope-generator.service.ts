/**
 * Scope Generator Service
 *
 * Uses the Claude Agent SDK to generate a business scope + agents
 * from a free-text business description.
 */

import { ClaudeAgentRuntime } from './agent-runtime-claude.js';
import type { AgentConfig, ConversationEvent } from './agent-runtime.js';

// Scope/twin generation always uses local Claude runtime (not AgentCore),
// because the generator needs direct workspace file access.
const generatorRuntime = new ClaudeAgentRuntime();
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratedScope {
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface GeneratedSkill {
  name: string;
  description: string;
  body: string;
}

export interface GeneratedAgent {
  name: string;
  displayName: string;
  role: string;
  systemPrompt: string;
  skills: GeneratedSkill[];
}

export interface GeneratedScopeConfig {
  scope: GeneratedScope;
  agents: GeneratedAgent[];
}

// ---------------------------------------------------------------------------
// System prompt for scope generation
// ---------------------------------------------------------------------------

const SCOPE_GENERATOR_SYSTEM_PROMPT = `You are a business scope architect for an AI agent platform. Your job is to analyze a business description and generate a structured scope configuration with specialized AI agents, each equipped with domain-specific skills.

CRITICAL: After generating the configuration, you MUST write the final JSON to a file called "scope-config.json" in the current working directory. Use your file writing tools to create this file. The file must contain ONLY valid JSON with no markdown or extra text.

The JSON must follow this exact schema:
{
  "scope": {
    "name": "string (short, 2-4 words)",
    "description": "string (1-2 sentences describing the scope)",
    "icon": "string (single emoji that represents the business)",
    "color": "string (hex color code like #3B82F6)"
  },
  "agents": [
    {
      "name": "string (kebab-case identifier, e.g. customer-support)",
      "displayName": "string (human-readable name)",
      "role": "string (brief role description, 5-10 words)",
      "systemPrompt": "string (detailed system prompt for the agent, 2-4 paragraphs)",
      "skills": [
        {
          "name": "string (kebab-case skill name, e.g. ticket-triage)",
          "description": "string (1-2 sentences: what the skill does and when to use it)",
          "body": "string (markdown instructions for the agent when using this skill, 5-20 lines)"
        }
      ]
    }
  ]
}

Guidelines:
- Generate 1-4 agents depending on business complexity. Prefer fewer agents — consolidate related responsibilities into a single agent rather than creating many narrow ones. In real organizations, one person often wears multiple hats, so each agent should reflect a realistic role that covers several related duties. Only create a separate agent when responsibilities are truly distinct and would conflict if combined.
- Each agent should have a distinct, non-overlapping responsibility
- Agent names should be kebab-case (e.g. "hr-assistant", "sales-ops")
- System prompts should be detailed and specific to the agent's role
- System prompts should define the agent's personality, expertise, constraints, and output format
- Choose an icon emoji that best represents the overall business
- Choose a color that feels appropriate for the business domain
- The scope name should be concise but descriptive

Skill guidelines:
- Generate 1-3 skills per agent based on their core responsibilities
- Each skill should represent a distinct, reusable workflow or domain expertise
- Skill names should be kebab-case and action-oriented (e.g. "analyze-risk", "draft-response")
- The description is the primary trigger — be specific about what the skill does and when to use it
- The body should contain concise, actionable instructions (not verbose explanations)
- Prefer examples and step-by-step procedures over general descriptions
- Skills should encode domain knowledge the agent wouldn't inherently have

Remember: Write the final JSON to "scope-config.json" in the current directory. This is mandatory.`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ScopeGeneratorService {
  /**
   * Generate a scope configuration by streaming Claude's response.
   * Yields ConversationEvents that can be forwarded as SSE.
   *
   * @param businessDescription - The text prompt for the agent.
   * @param sopDocument - Optional SOP document buffer + filename to place in the workspace.
   *                      The agent will be instructed to read and parse it using its tools.
   */
  async *generate(businessDescription: string, sopDocument?: { buffer: Buffer; fileName: string }): AsyncGenerator<ConversationEvent> {
      const agentConfig: AgentConfig = {
        id: 'scope-generator',
        name: 'scope-generator',
        displayName: 'Scope Generator',
        organizationId: 'system',
        systemPrompt: SCOPE_GENERATOR_SYSTEM_PROMPT,
        skillIds: [],
        mcpServerIds: [],
      };

      // Always create a fresh temp workspace (consistent across all strategies)
      const tempWorkspace = await mkdtemp(join(tmpdir(), 'scope-gen-'));
      const configFilePath = join(tempWorkspace, 'scope-config.json');

      let message: string;

      if (sopDocument) {
        // Place the document in the workspace for the agent to read
        const filePath = join(tempWorkspace, sopDocument.fileName);
        await writeFile(filePath, sopDocument.buffer);

        message = [
          `A SOP document has been placed in your working directory as "${sopDocument.fileName}".`,
          `Please read and parse this document first using your file reading tools.`,
          `If it is a PDF, use a shell command like \`pdftotext "${sopDocument.fileName}" - 2>/dev/null || strings "${sopDocument.fileName}"\` to extract text.`,
          `If it is a DOCX file, use \`unzip -p "${sopDocument.fileName}" word/document.xml 2>/dev/null | sed -e 's/<[^>]*>//g'\` to extract text content.`,
          `For plain text or markdown files, read them directly.`,
          ``,
          `Then analyze the extracted content and generate a scope configuration with specialized AI agents.`,
          `Write the final JSON result to "scope-config.json" in the current directory.`,
          ``,
          `Additional context from the user:`,
          businessDescription,
        ].join('\n');
      } else {
        message = `Analyze this business and generate a scope configuration with specialized AI agents. Write the final JSON result to "scope-config.json" in the current directory.\n\n${businessDescription}`;
      }

      try {
        yield* generatorRuntime.runConversation(
          {
            agentId: 'scope-generator',
            sessionId: `scope-gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            message,
            organizationId: 'system',
            userId: 'system',
            workspacePath: tempWorkspace,
          },
          agentConfig,
          [], // no skills needed for generation
        );

        // After conversation ends, read the generated JSON file from workspace
        if (existsSync(configFilePath)) {
          const fileContent = await readFile(configFilePath, 'utf-8');
          yield {
            type: 'scope_config' as ConversationEvent['type'],
            content: fileContent,
          } as unknown as ConversationEvent;
        } else {
          console.warn('[scope-generator] scope-config.json not found in workspace');
        }
      } finally {
        // Clean up temp workspace
        rm(tempWorkspace, { recursive: true, force: true }).catch(() => {});
      }
    }

  /**
   * Generate a Digital Twin configuration by streaming Claude's response.
   * Analyzes uploaded documents to create a persona-specific system prompt and skills.
   */
  async *generateTwin(
    twinInfo: { displayName: string; role: string; description: string },
    documents?: Array<{ buffer: Buffer; fileName: string }>,
  ): AsyncGenerator<ConversationEvent> {
    const TWIN_SYSTEM_PROMPT = `You are a Digital Twin architect. Your ONLY job is to generate a digital twin configuration JSON that is HIGHLY SPECIFIC to the person's role and expertise. You must NEVER ask questions. Work with whatever information is provided.

CRITICAL RULES:
1. NEVER generate generic/general-purpose skills. Every skill MUST be specific to the person's stated role and domain.
2. The system prompt MUST reference the person's specific field, technologies, and expertise areas by name.
3. If the role is "Cloud Solutions Architect", the skills must be about cloud architecture, NOT generic "problem-solving" or "communication".
4. Output the COMPLETE JSON directly in your response wrapped in a json code fence. Do NOT use any file writing tools.
5. NEVER ask questions. Generate immediately.

Output EXACTLY this format (wrapped in \`\`\`json code fence):

\`\`\`json
{
  "scope": {
    "name": "${twinInfo.displayName}",
    "description": "Digital twin of ${twinInfo.displayName} - ${twinInfo.role}",
    "icon": "🤖",
    "color": "#6366f1"
  },
  "systemPrompt": "MUST mention the person's specific role (${twinInfo.role}), their domain expertise, specific technologies/tools they use, and their professional approach. 3-6 paragraphs.",
  "skills": [
    {
      "name": "domain-specific-skill-name",
      "description": "MUST be specific to ${twinInfo.role} domain, NOT generic",
      "body": "markdown instructions with domain-specific methodology, tools, frameworks, and best practices relevant to ${twinInfo.role}"
    }
  ]
}
\`\`\`

QUALITY CHECK — before outputting, verify:
- Does the systemPrompt mention "${twinInfo.role}" and specific technologies?
- Are ALL skills directly relevant to "${twinInfo.role}"?
- Would a "${twinInfo.role}" actually use these skills daily?
- If any skill is generic (like "problem-solving" or "communication"), REPLACE it with a domain-specific one.`;

    const agentConfig: AgentConfig = {
      id: 'twin-generator',
      name: 'twin-generator',
      displayName: 'Digital Twin Generator',
      organizationId: 'system',
      systemPrompt: TWIN_SYSTEM_PROMPT,
      skillIds: [],
      mcpServerIds: [],
    };

    const tempWorkspace = await mkdtemp(join(tmpdir(), 'twin-gen-'));
    const configFilePath = join(tempWorkspace, 'scope-config.json');

    // Place documents in workspace
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        await writeFile(join(tempWorkspace, doc.fileName), doc.buffer);
      }
    }

    const docInstructions = documents && documents.length > 0
      ? [
          `The following documents have been placed in your working directory:`,
          ...documents.map(d => `- "${d.fileName}"`),
          `Please read and analyze these documents to understand the person's expertise.`,
          `If a file is PDF, use: pdftotext "filename" - 2>/dev/null || strings "filename"`,
          `If a file is DOCX, use: unzip -p "filename" word/document.xml 2>/dev/null | sed -e 's/<[^>]*>//g'`,
          `For plain text or markdown files, read them directly.`,
          '',
        ].join('\n')
      : '';

    const message = [
      docInstructions,
      `Generate a digital twin configuration NOW for the following person. Do NOT ask any questions. Output the JSON directly in your response.`,
      '',
      `Name: ${twinInfo.displayName}`,
      `Role: ${twinInfo.role || 'General professional'}`,
      `Description: ${twinInfo.description || 'A professional in their field.'}`,
      '',
      `Based on this information${documents ? ' and the uploaded documents' : ''}, immediately output the complete JSON configuration wrapped in a json code fence.`,
    ].join('\n');

    try {
      // Accumulate all text content for fallback JSON extraction
      const allTextBlocks: string[] = [];

      // Use a unique session ID per generation to avoid AgentCore session reuse
      const uniqueSessionId = `twin-gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      for await (const event of generatorRuntime.runConversation(
        { agentId: 'twin-generator', sessionId: uniqueSessionId, message, organizationId: 'system', userId: 'system', workspacePath: tempWorkspace },
        agentConfig,
        [],
      )) {
        // Collect text blocks for JSON extraction
        if ((event.type === 'assistant' || event.type === 'result') && event.content) {
          for (const block of event.content) {
            if (block.type === 'text' && 'text' in block) {
              allTextBlocks.push((block as { type: 'text'; text: string }).text);
            }
          }
        }
        yield event;
      }

      // Strategy 1: Read scope-config.json from workspace (if agent wrote it)
      if (existsSync(configFilePath)) {
        const fileContent = await readFile(configFilePath, 'utf-8');
        console.log(`[twin-generator] scope-config.json found (${fileContent.length} bytes)`);
        yield { type: 'scope_config' as ConversationEvent['type'], content: fileContent } as unknown as ConversationEvent;
      } else {
        // Strategy 2: Extract JSON from the conversation text
        console.log('[twin-generator] scope-config.json not found, extracting from conversation text...');
        const fullText = allTextBlocks.join('');
        const extracted = this.extractTwinConfigJson(fullText);
        if (extracted) {
          console.log(`[twin-generator] Extracted config from text (${extracted.length} bytes)`);
          yield { type: 'scope_config' as ConversationEvent['type'], content: extracted } as unknown as ConversationEvent;
        } else {
          console.warn('[twin-generator] Could not extract config from conversation text');
        }
      }
    } finally {
      rm(tempWorkspace, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Extract twin config JSON from conversation text.
   * Tries multiple strategies: direct parse, code fence extraction, brace matching.
   */
  private extractTwinConfigJson(text: string): string | null {
    if (!text || text.trim().length < 10) return null;

    console.log(`[twin-generator] Attempting to extract JSON from text (${text.length} chars). First 500 chars: ${text.slice(0, 500)}`);
    console.log(`[twin-generator] Last 500 chars: ${text.slice(-500)}`);

    // Strategy 1: Find JSON in code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        const parsed = JSON.parse(fenceMatch[1]!.trim());
        if (parsed.systemPrompt || parsed.skills) return JSON.stringify(parsed);
      } catch { /* not valid JSON */ }
    }

    // Strategy 2: Find all top-level JSON objects and pick the one with systemPrompt/skills
    let depth = 0;
    let start = -1;
    const candidates: string[] = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (text[i] === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          candidates.push(text.substring(start, i + 1));
          start = -1;
        }
      }
    }

    // Try candidates from largest to smallest
    candidates.sort((a, b) => b.length - a.length);
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed.systemPrompt || parsed.skills || (parsed.scope && parsed.systemPrompt !== undefined)) {
          return candidate;
        }
      } catch { continue; }
    }

    return null;
  }

  /**
   * Parse the generated JSON from Claude's response content blocks.
   */
  parseGeneratedConfig(contentBlocks: Array<{ type: string; text?: string }>): GeneratedScopeConfig {
    // Concatenate all text blocks
    const fullText = contentBlocks
      .filter(b => b.type === 'text' && b.text)
      .map(b => b.text!)
      .join('');

    // Try to extract JSON from the response
    let jsonStr = fullText.trim();

    // Strip markdown code fences if present
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1]!.trim();
    }

    // Try to find JSON object boundaries
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr);

    // Validate structure
    if (!parsed.scope || !parsed.agents || !Array.isArray(parsed.agents)) {
      throw new Error('Invalid generated config: missing scope or agents');
    }

    return parsed as GeneratedScopeConfig;
  }
}

export const scopeGeneratorService = new ScopeGeneratorService();
