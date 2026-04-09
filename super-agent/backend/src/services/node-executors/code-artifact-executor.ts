/**
 * Code Artifact Node Executor
 *
 * Generates or executes code based on the node configuration.
 *
 * Requirement 3.6: WHEN executing a codeArtifact node, THE Node_Executor SHALL
 * generate or execute code based on the node configuration.
 */

import { BaseNodeExecutor } from './base-executor.js';
import type { NodeExecutionParams, NodeExecutionResult } from './types.js';
import type { CanvasNodeType } from '../../types/workflow-execution.js';
import { aiService } from '../ai.service.js';

/**
 * Code artifact types
 */
type CodeArtifactType =
  | 'html'
  | 'react'
  | 'vue'
  | 'python'
  | 'typescript'
  | 'javascript';

/**
 * Code artifact node metadata structure
 */
interface CodeArtifactNodeMeta {
  /** Generation status */
  status?: 'generating' | 'finish' | 'failed' | 'executing';
  /** Programming language */
  language?: string;
  /** Artifact type */
  type?: CodeArtifactType;
  /** Artifact title */
  title?: string;
  /** Whether to execute the code */
  execute?: boolean;
  /** AI prompt for code generation */
  aiPrompt?: string;
  /** Template code */
  template?: string;
  /** Share ID */
  shareId?: string;
  /** Preview URL */
  previewUrl?: string;
}

/**
 * Code artifact node executor
 *
 * Supports:
 * - AI-powered code generation
 * - Template-based code generation
 * - Code execution (JavaScript/TypeScript only, sandboxed)
 */
export class CodeArtifactNodeExecutor extends BaseNodeExecutor {
  readonly supportedTypes: CanvasNodeType[] = ['codeArtifact'];

  async execute(params: NodeExecutionParams): Promise<NodeExecutionResult> {
    const { node, context } = params;
    const metadata = this.getMetadata<CodeArtifactNodeMeta>(params);

    try {
      let code: string;

      if (metadata?.aiPrompt) {
        // AI-powered code generation
        code = await this.generateWithAI(params, metadata);
      } else if (metadata?.template) {
        // Template-based generation
        code = this.generateFromTemplate(params, metadata);
      } else {
        // Use content preview as code
        code = node.data.contentPreview || '// No code provided';
      }

      // Execute code if requested (only for safe languages)
      let executionResult: unknown = null;
      if (metadata?.execute && this.canExecute(metadata.language)) {
        executionResult = await this.executeCode(code, metadata.language, context);
      }

      return this.success({
        type: 'codeArtifact',
        title: node.data.title,
        language: metadata?.language || 'javascript',
        artifactType: metadata?.type || 'javascript',
        code,
        result: executionResult ?? code,
        executed: metadata?.execute && this.canExecute(metadata.language),
        executionResult,
        lineCount: code.split('\n').length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error(`Code artifact node execution failed: ${errorMessage}`, {
        nodeId: node.id,
        executionId: context.executionId,
        error,
      });

      return this.failure(
        `Code artifact generation failed: ${errorMessage}`,
        errorStack
      );
    }
  }

  /**
   * Generate code using AI
   */
  private async generateWithAI(
    params: NodeExecutionParams,
    metadata: CodeArtifactNodeMeta
  ): Promise<string> {
    const { context } = params;

    // Build prompt with context
    let prompt = this.substituteVariables(metadata.aiPrompt || '', context);

    // Add parent outputs as context
    const parentContext = this.buildParentContext(context);
    if (parentContext) {
      prompt = `Context:\n${parentContext}\n\n${prompt}`;
    }

    // Add language specification
    const language = metadata.language || 'javascript';
    prompt = `Generate ${language} code for the following:\n\n${prompt}\n\nProvide only the code without explanations or markdown code blocks.`;

    // Generate using AI service
    const response = await aiService.chatCompletion({
      system_prompt: `You are an expert ${language} programmer. Generate clean, well-documented, production-ready code. Only output the code itself, no explanations or markdown formatting.`,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
    });

    // Clean up response (remove markdown code blocks if present)
    return this.cleanCodeResponse(response, language);
  }

  /**
   * Generate code from template
   */
  private generateFromTemplate(
    params: NodeExecutionParams,
    metadata: CodeArtifactNodeMeta
  ): string {
    const { context } = params;
    const template = metadata.template || '';

    // Substitute variables in template
    return this.substituteVariables(template, context);
  }

  /**
   * Build context string from parent outputs
   */
  private buildParentContext(context: NodeExecutionParams['context']): string {
    const parts: string[] = [];

    context.nodeOutputs.forEach((output, nodeId) => {
      // Skip pass-through outputs
      if (
        typeof output === 'object' &&
        output !== null &&
        'passThrough' in output
      ) {
        return;
      }

      const outputStr =
        typeof output === 'string'
          ? output
          : JSON.stringify(output, null, 2);

      parts.push(`// From ${nodeId}:\n${outputStr}`);
    });

    return parts.join('\n\n');
  }

  /**
   * Clean up AI response to extract just the code
   */
  private cleanCodeResponse(response: string, language: string): string {
    let code = response.trim();

    // Remove markdown code blocks
    const codeBlockRegex = new RegExp(
      `\`\`\`(?:${language}|js|ts|javascript|typescript)?\\n?([\\s\\S]*?)\`\`\``,
      'i'
    );
    const match = code.match(codeBlockRegex);
    if (match && match[1]) {
      code = match[1].trim();
    }

    // Remove leading/trailing backticks
    code = code.replace(/^`+|`+$/g, '').trim();

    return code;
  }

  /**
   * Check if a language can be executed
   */
  private canExecute(language?: string): boolean {
    const executableLanguages = ['javascript', 'typescript', 'js', 'ts'];
    return executableLanguages.includes(language?.toLowerCase() || '');
  }

  /**
   * Execute code in a sandboxed environment
   *
   * WARNING: This is a simplified implementation.
   * In production, use a proper sandbox like vm2 or isolated-vm.
   */
  private async executeCode(
    code: string,
    language: string | undefined,
    context: NodeExecutionParams['context']
  ): Promise<unknown> {
    // Only execute JavaScript/TypeScript
    if (!this.canExecute(language)) {
      return { error: `Cannot execute ${language} code` };
    }

    try {
      // Build execution context with parent outputs
      const executionContext: Record<string, unknown> = {
        inputs: {},
        variables: {},
      };

      context.nodeOutputs.forEach((value, key) => {
        (executionContext.inputs as Record<string, unknown>)[key] = value;
      });

      context.variables.forEach((value, key) => {
        (executionContext.variables as Record<string, unknown>)[key] = value;
      });

      // Create a sandboxed function
      // Note: In production, use vm2 or isolated-vm for proper sandboxing
      const sandboxedCode = `
        'use strict';
        const inputs = ${JSON.stringify(executionContext.inputs)};
        const variables = ${JSON.stringify(executionContext.variables)};
        const console = { log: (...args) => logs.push(args.join(' ')) };
        const logs = [];
        
        try {
          const result = (function() {
            ${code}
          })();
          return { success: true, result, logs };
        } catch (error) {
          return { success: false, error: error.message, logs };
        }
      `;

      // Execute with timeout
      const timeoutMs = 5000;
      const result = await this.executeWithTimeout(sandboxedCode, timeoutMs);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Code execution failed:', errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * Execute code with a timeout
   */
  private async executeWithTimeout(
    code: string,
    timeoutMs: number
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Code execution timed out'));
      }, timeoutMs);

      try {
        // Note: eval is used here for simplicity
        // In production, use vm2 or isolated-vm
        // eslint-disable-next-line no-eval
        const result = eval(code);
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}
