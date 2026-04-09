/**
 * Property-based tests for Validation Error Handling
 *
 * Feature: unified-ecs-backend
 * Property 4: Validation Error Handling
 * Validates: Requirements 4.6, 5.7
 *
 * For any invalid input data (empty required fields, invalid formats),
 * the API should return a 400 Bad Request response with appropriate error details.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createAgentSchema } from '../../src/schemas/agent.schema.js';
import { createTaskSchema } from '../../src/schemas/task.schema.js';

describe('Validation Error Handling Properties', () => {
  /**
   * Feature: unified-ecs-backend, Property 4: Validation Error Handling
   * Validates: Requirements 4.6
   *
   * For any empty or whitespace-only agent name,
   * validation should fail with an appropriate error.
   */
  it('should reject empty or whitespace-only agent names', () => {
    // Generator for invalid agent names (empty or whitespace-only)
    const whitespaceChars = [' ', '\t', '\n', '\r'];
    const invalidNameArbitrary = fc.oneof(
      fc.constant(''),
      fc
        .array(fc.constantFrom(...whitespaceChars), { minLength: 1, maxLength: 50 })
        .map((arr) => arr.join(''))
    );

    fc.assert(
      fc.property(invalidNameArbitrary, (invalidName) => {
        const input = {
          name: invalidName,
          display_name: 'Valid Display Name',
        };

        const result = createAgentSchema.safeParse(input);

        // Validation should fail
        expect(result.success).toBe(false);

        if (!result.success) {
          // Should have error details
          expect(result.error.issues.length).toBeGreaterThan(0);
          // Error should be related to the name field
          const nameErrors = result.error.issues.filter((issue) => issue.path.includes('name'));
          expect(nameErrors.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 4: Validation Error Handling
   * Validates: Requirements 4.6
   *
   * For any empty or whitespace-only display name,
   * validation should fail with an appropriate error.
   */
  it('should reject empty or whitespace-only agent display names', () => {
    const whitespaceChars = [' ', '\t', '\n', '\r'];
    const invalidDisplayNameArbitrary = fc.oneof(
      fc.constant(''),
      fc
        .array(fc.constantFrom(...whitespaceChars), { minLength: 1, maxLength: 50 })
        .map((arr) => arr.join(''))
    );

    fc.assert(
      fc.property(invalidDisplayNameArbitrary, (invalidDisplayName) => {
        const input = {
          name: 'valid-agent-name',
          display_name: invalidDisplayName,
        };

        const result = createAgentSchema.safeParse(input);

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
          const displayNameErrors = result.error.issues.filter((issue) =>
            issue.path.includes('display_name')
          );
          expect(displayNameErrors.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 4: Validation Error Handling
   * Validates: Requirements 5.7
   *
   * For any empty or whitespace-only task description,
   * validation should fail with an appropriate error.
   */
  it('should reject empty or whitespace-only task descriptions', () => {
    const whitespaceChars = [' ', '\t', '\n', '\r'];
    const invalidDescriptionArbitrary = fc.oneof(
      fc.constant(''),
      fc
        .array(fc.constantFrom(...whitespaceChars), { minLength: 1, maxLength: 50 })
        .map((arr) => arr.join(''))
    );

    fc.assert(
      fc.property(invalidDescriptionArbitrary, (invalidDescription) => {
        const input = {
          description: invalidDescription,
        };

        const result = createTaskSchema.safeParse(input);

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
          const descriptionErrors = result.error.issues.filter((issue) =>
            issue.path.includes('description')
          );
          expect(descriptionErrors.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 4: Validation Error Handling
   * Validates: Requirements 4.6
   *
   * For any agent name exceeding the maximum length,
   * validation should fail with an appropriate error.
   */
  it('should reject agent names exceeding maximum length', () => {
    // Generate strings longer than 255 characters
    const tooLongNameArbitrary = fc.string({ minLength: 256, maxLength: 500 });

    fc.assert(
      fc.property(tooLongNameArbitrary, (tooLongName) => {
        const input = {
          name: tooLongName,
          display_name: 'Valid Display Name',
        };

        const result = createAgentSchema.safeParse(input);

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
          const nameErrors = result.error.issues.filter((issue) => issue.path.includes('name'));
          expect(nameErrors.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 4: Validation Error Handling
   * Validates: Requirements 4.6
   *
   * For any invalid UUID format in business_scope_id,
   * validation should fail with an appropriate error.
   */
  it('should reject invalid UUID formats for business_scope_id', () => {
    // Generate strings that are not valid UUIDs
    const invalidUuidArbitrary = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter((s) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s));

    fc.assert(
      fc.property(invalidUuidArbitrary, (invalidUuid) => {
        const input = {
          name: 'valid-agent-name',
          display_name: 'Valid Display Name',
          business_scope_id: invalidUuid,
        };

        const result = createAgentSchema.safeParse(input);

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
          const uuidErrors = result.error.issues.filter((issue) =>
            issue.path.includes('business_scope_id')
          );
          expect(uuidErrors.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 4: Validation Error Handling
   * Validates: Requirements 4.6
   *
   * For any invalid URL format in avatar field,
   * validation should fail with an appropriate error.
   */
  it('should reject invalid URL formats for agent avatar', () => {
    // Generate strings that are not valid URLs
    const invalidUrlArbitrary = fc
      .string({ minLength: 1, maxLength: 100 })
      .filter((s) => {
        try {
          new URL(s);
          return false; // Valid URL, filter it out
        } catch {
          return true; // Invalid URL, keep it
        }
      });

    fc.assert(
      fc.property(invalidUrlArbitrary, (invalidUrl) => {
        const input = {
          name: 'valid-agent-name',
          display_name: 'Valid Display Name',
          avatar: invalidUrl,
        };

        const result = createAgentSchema.safeParse(input);

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
          const avatarErrors = result.error.issues.filter((issue) =>
            issue.path.includes('avatar')
          );
          expect(avatarErrors.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 4: Validation Error Handling
   * Validates: Requirements 4.6
   *
   * For any invalid agent status value,
   * validation should fail with an appropriate error.
   */
  it('should reject invalid agent status values', () => {
    const validStatuses = ['active', 'idle', 'busy', 'offline'];
    const invalidStatusArbitrary = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => !validStatuses.includes(s));

    fc.assert(
      fc.property(invalidStatusArbitrary, (invalidStatus) => {
        const input = {
          name: 'valid-agent-name',
          display_name: 'Valid Display Name',
          status: invalidStatus,
        };

        const result = createAgentSchema.safeParse(input);

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
          const statusErrors = result.error.issues.filter((issue) =>
            issue.path.includes('status')
          );
          expect(statusErrors.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 4: Validation Error Handling
   * Validates: Requirements 5.7
   *
   * For any invalid task status value,
   * validation should fail with an appropriate error.
   */
  it('should reject invalid task status values', () => {
    const validStatuses = ['complete', 'running', 'failed'];
    const invalidStatusArbitrary = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => !validStatuses.includes(s));

    fc.assert(
      fc.property(invalidStatusArbitrary, (invalidStatus) => {
        const input = {
          description: 'Valid task description',
          status: invalidStatus,
        };

        const result = createTaskSchema.safeParse(input);

        expect(result.success).toBe(false);

        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(0);
          const statusErrors = result.error.issues.filter((issue) =>
            issue.path.includes('status')
          );
          expect(statusErrors.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 4: Validation Error Handling
   * Validates: Requirements 4.6, 5.7
   *
   * For any valid input data, validation should succeed.
   * This is the inverse property to ensure our validation isn't too strict.
   */
  it('should accept valid agent input data', () => {
    const validAgentArbitrary = fc.record({
      name: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
      display_name: fc.string({ minLength: 1, maxLength: 255 }).filter((s) => s.trim().length > 0),
      status: fc.constantFrom('active', 'idle', 'busy', 'offline'),
    });

    fc.assert(
      fc.property(validAgentArbitrary, (validAgent) => {
        const result = createAgentSchema.safeParse(validAgent);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: unified-ecs-backend, Property 4: Validation Error Handling
   * Validates: Requirements 5.7
   *
   * For any valid task input data, validation should succeed.
   */
  it('should accept valid task input data', () => {
    const validTaskArbitrary = fc.record({
      description: fc
        .string({ minLength: 1, maxLength: 10000 })
        .filter((s) => s.trim().length > 0),
      status: fc.constantFrom('complete', 'running', 'failed'),
    });

    fc.assert(
      fc.property(validTaskArbitrary, (validTask) => {
        const result = createTaskSchema.safeParse(validTask);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
