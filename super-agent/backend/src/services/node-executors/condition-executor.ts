/**
 * Condition Node Executor
 *
 * Evaluates conditions and activates the matching output branch.
 *
 * Requirement 3.3: WHEN executing a condition node, THE Node_Executor SHALL
 * evaluate the condition and activate only the matching output branch.
 */

import { BaseNodeExecutor } from './base-executor.js';
import type {
  NodeExecutionParams,
  NodeExecutionResult,
  ConditionRule,
  ConditionOperator,
} from './types.js';
import type { CanvasNodeType } from '../../types/workflow-execution.js';

/**
 * Condition node metadata structure
 */
interface ConditionNodeMeta {
  /** Condition rules */
  rules?: ConditionRule[];
  /** Logic operator between rules */
  logic?: 'and' | 'or';
  /** Simple condition string (legacy support) */
  condition?: string;
  /** True branch node ID */
  trueBranch?: string;
  /** False branch node ID */
  falseBranch?: string;
}

/**
 * Condition node executor
 *
 * Evaluates conditions using rules or simple expressions.
 * Supports multiple operators and logical combinations.
 */
export class ConditionNodeExecutor extends BaseNodeExecutor {
  readonly supportedTypes: CanvasNodeType[] = ['condition'];

  async execute(params: NodeExecutionParams): Promise<NodeExecutionResult> {
    const { node, context } = params;
    const metadata = this.getMetadata<ConditionNodeMeta>(params);

    let result: boolean;

    // Evaluate using rules if available, otherwise use simple condition
    if (metadata?.rules && metadata.rules.length > 0) {
      result = this.evaluateRules(metadata.rules, metadata.logic || 'and', context);
    } else if (metadata?.condition) {
      result = this.evaluateSimpleCondition(metadata.condition, context);
    } else {
      // Default to true if no condition specified
      result = true;
    }

    // Determine active branch
    const activeBranch = result ? metadata?.trueBranch : metadata?.falseBranch;

    return {
      success: true,
      output: {
        type: 'condition',
        title: node.data.title,
        branch: result ? 'true' : 'false',
        result,
        activeBranch,
        evaluatedCondition: metadata?.condition || JSON.stringify(metadata?.rules),
        timestamp: new Date().toISOString(),
      },
      activeBranch,
    };
  }

  /**
   * Evaluate condition rules
   */
  private evaluateRules(
    rules: ConditionRule[],
    logic: 'and' | 'or',
    context: NodeExecutionParams['context']
  ): boolean {
    const results = rules.map((rule) => this.evaluateRule(rule, context));

    if (logic === 'and') {
      return results.every((r) => r);
    } else {
      return results.some((r) => r);
    }
  }

  /**
   * Evaluate a single condition rule
   */
  private evaluateRule(
    rule: ConditionRule,
    context: NodeExecutionParams['context']
  ): boolean {
    // Get the field value - could be a reference or direct value
    let fieldValue: unknown;

    if (rule.field.startsWith('@{') || rule.field.includes('.')) {
      // Reference to node output
      const reference = rule.field.replace(/^@\{|\}$/g, '');
      fieldValue = this.resolveReference(reference, context);
    } else if (rule.field.startsWith('{{')) {
      // Variable reference
      const varName = rule.field.replace(/^\{\{|\}\}$/g, '').trim();
      fieldValue = context.variables.get(varName);
    } else {
      // Try as node output reference first, then as variable
      fieldValue = this.resolveReference(rule.field, context);
      if (fieldValue === undefined) {
        fieldValue = context.variables.get(rule.field);
      }
    }

    return this.evaluateOperator(rule.operator, fieldValue, rule.value, rule.customExpression);
  }

  /**
   * Evaluate an operator against field and expected values
   */
  private evaluateOperator(
    operator: ConditionOperator,
    fieldValue: unknown,
    expectedValue: unknown,
    customExpression?: string
  ): boolean {
    switch (operator) {
      case 'equals':
        return this.deepEquals(fieldValue, expectedValue);

      case 'not_equals':
        return !this.deepEquals(fieldValue, expectedValue);

      case 'contains':
        if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
          return fieldValue.includes(expectedValue);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.some((item) => this.deepEquals(item, expectedValue));
        }
        return false;

      case 'not_contains':
        if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
          return !fieldValue.includes(expectedValue);
        }
        if (Array.isArray(fieldValue)) {
          return !fieldValue.some((item) => this.deepEquals(item, expectedValue));
        }
        return true;

      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue);

      case 'less_than':
        return Number(fieldValue) < Number(expectedValue);

      case 'is_empty':
        return this.isEmpty(fieldValue);

      case 'is_not_empty':
        return !this.isEmpty(fieldValue);

      case 'custom':
        return this.evaluateCustomExpression(customExpression, fieldValue);

      default:
        console.warn(`Unknown operator: ${operator}, defaulting to true`);
        return true;
    }
  }

  /**
   * Deep equality check
   */
  private deepEquals(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object' && a !== null && b !== null) {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    // String comparison (case-insensitive for strings)
    if (typeof a === 'string' && typeof b === 'string') {
      return a.toLowerCase() === b.toLowerCase();
    }
    return false;
  }

  /**
   * Check if a value is empty
   */
  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * Evaluate a custom expression
   * Supports simple JavaScript-like expressions
   */
  private evaluateCustomExpression(
    expression: string | undefined,
    fieldValue: unknown
  ): boolean {
    if (!expression) return true;

    try {
      // Simple expression evaluation - supports basic comparisons
      // Replace 'value' placeholder with actual value
      const valueStr = JSON.stringify(fieldValue);
      const evalExpr = expression.replace(/\bvalue\b/g, valueStr);

      // Only allow safe expressions (no function calls, etc.)
      if (/[(){}]/.test(evalExpr) && !/^[^()]*$/.test(evalExpr)) {
        console.warn('Complex expressions not supported for security');
        return true;
      }

      // Evaluate simple comparisons
      // eslint-disable-next-line no-eval
      return Boolean(eval(evalExpr));
    } catch (error) {
      console.warn(`Failed to evaluate custom expression: ${expression}`, error);
      return true;
    }
  }

  /**
   * Evaluate a simple condition string
   * Supports:
   * - 'true' / 'false' literals
   * - @{nodeId.output} references
   * - {{variableName}} references
   */
  private evaluateSimpleCondition(
    condition: string,
    context: NodeExecutionParams['context']
  ): boolean {
    const trimmed = condition.trim().toLowerCase();

    // Boolean literals
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Node output reference: @{nodeId.output}
    const nodeRefMatch = condition.match(/@\{([^}]+)\}/);
    if (nodeRefMatch && nodeRefMatch[1]) {
      const reference = nodeRefMatch[1];
      const value = this.resolveReference(reference, context);
      return this.isTruthy(value);
    }

    // Variable reference: {{variableName}}
    const varRefMatch = condition.match(/\{\{([^}]+)\}\}/);
    if (varRefMatch && varRefMatch[1]) {
      const varName = varRefMatch[1].trim();
      const value = context.variables.get(varName);
      return this.isTruthy(value);
    }

    // Try as a direct variable name
    const directValue = context.variables.get(condition.trim());
    if (directValue !== undefined) {
      return this.isTruthy(directValue);
    }

    // Default to true for unknown conditions
    console.warn(`Unknown condition format: ${condition}, defaulting to true`);
    return true;
  }

  /**
   * Check if a value is truthy
   */
  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.trim() !== '' && value.toLowerCase() !== 'false';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
  }
}
