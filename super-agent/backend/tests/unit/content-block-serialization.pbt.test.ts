/**
 * Property-based tests for Content Block Serialization Round-Trip
 *
 * Feature: claude-agent-sdk-chat
 * Property 6: Content block serialization round-trip
 *
 * For any valid array of ContentBlock objects, serializing to JSON and then
 * deserializing SHALL produce an array equivalent to the original.
 *
 * **Validates: Requirements 3.5**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ContentBlock } from '../../src/services/claude-agent.service.js';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a non-empty alphanumeric-ish string for IDs and names. */
const idArb = fc.stringMatching(/^[a-zA-Z0-9_-]{1,40}$/);

/** Generates a text content block. */
const textBlockArb: fc.Arbitrary<ContentBlock> = fc
  .string({ minLength: 0, maxLength: 500 })
  .map((text) => ({ type: 'text' as const, text }));

/**
 * Generates a JSON-serializable value for tool_use input fields.
 * We restrict to JSON-safe primitives and nested structures to ensure
 * round-trip fidelity through JSON.stringify/JSON.parse.
 */
/**
 * A double arbitrary that excludes -0, NaN, and Infinity since these
 * values are not faithfully representable in JSON:
 * - JSON.stringify(-0) === "0" (loses the sign)
 * - JSON.stringify(NaN) === "null"
 * - JSON.stringify(Infinity) === "null"
 */
const jsonSafeDoubleArb = fc
  .double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })
  .filter((v) => !Object.is(v, -0));

const jsonSafeValueArb: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    { depthSize: 'small' },
    fc.string({ maxLength: 100 }),
    fc.integer({ min: -1_000_000, max: 1_000_000 }),
    jsonSafeDoubleArb,
    fc.boolean(),
    fc.constant(null),
    fc.array(tie('value'), { maxLength: 3 }),
    fc.dictionary(
      fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,15}$/),
      tie('value'),
      { maxKeys: 3 },
    ),
  ),
})).value;

/** Generates a JSON-serializable Record<string, unknown> for tool_use input. */
const jsonSafeRecordArb: fc.Arbitrary<Record<string, unknown>> = fc.dictionary(
  fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,20}$/),
  jsonSafeValueArb,
  { maxKeys: 5 },
);

/** Generates a tool_use content block. */
const toolUseBlockArb: fc.Arbitrary<ContentBlock> = fc.record({
  type: fc.constant('tool_use' as const),
  id: idArb,
  name: fc.constantFrom(
    'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'CustomTool',
  ),
  input: jsonSafeRecordArb,
});

/** Generates a tool_result content block. */
const toolResultBlockArb: fc.Arbitrary<ContentBlock> = fc.record({
  type: fc.constant('tool_result' as const),
  tool_use_id: idArb,
  content: fc.oneof(fc.string({ maxLength: 500 }), fc.constant(null)),
  is_error: fc.boolean(),
});

/** Generates a single ContentBlock of any type. */
const contentBlockArb: fc.Arbitrary<ContentBlock> = fc.oneof(
  textBlockArb,
  toolUseBlockArb,
  toolResultBlockArb,
);

/** Generates an array of ContentBlock objects (0 to 10 blocks). */
const contentBlockArrayArb: fc.Arbitrary<ContentBlock[]> = fc.array(
  contentBlockArb,
  { minLength: 0, maxLength: 10 },
);

// ---------------------------------------------------------------------------
// Property 6: Content block serialization round-trip
// ---------------------------------------------------------------------------

describe('Property 6: Content block serialization round-trip', () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * For any valid array of ContentBlock objects, serializing to JSON and then
   * deserializing SHALL produce an array equivalent to the original.
   *
   * This property is critical because assistant messages are persisted to the
   * chat_messages.content column as JSON-serialized content block arrays.
   */

  it('JSON.parse(JSON.stringify(blocks)) should produce an equivalent array', () => {
    fc.assert(
      fc.property(contentBlockArrayArb, (blocks) => {
        const serialized = JSON.stringify(blocks);
        const deserialized = JSON.parse(serialized) as ContentBlock[];

        expect(deserialized).toEqual(blocks);
      }),
      { numRuns: 200 },
    );
  });

  it('round-trip preserves the length of the content block array', () => {
    fc.assert(
      fc.property(contentBlockArrayArb, (blocks) => {
        const deserialized = JSON.parse(JSON.stringify(blocks)) as ContentBlock[];

        expect(deserialized.length).toBe(blocks.length);
      }),
      { numRuns: 200 },
    );
  });

  it('round-trip preserves the type discriminator of each block', () => {
    fc.assert(
      fc.property(contentBlockArrayArb, (blocks) => {
        const deserialized = JSON.parse(JSON.stringify(blocks)) as ContentBlock[];

        for (let i = 0; i < blocks.length; i++) {
          expect(deserialized[i].type).toBe(blocks[i].type);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('round-trip preserves all fields of text blocks', () => {
    fc.assert(
      fc.property(
        fc.array(textBlockArb, { minLength: 1, maxLength: 10 }),
        (blocks) => {
          const deserialized = JSON.parse(JSON.stringify(blocks)) as ContentBlock[];

          for (let i = 0; i < blocks.length; i++) {
            const original = blocks[i];
            const restored = deserialized[i];
            if (original.type === 'text' && restored.type === 'text') {
              expect(restored.text).toBe(original.text);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('round-trip preserves all fields of tool_use blocks', () => {
    fc.assert(
      fc.property(
        fc.array(toolUseBlockArb, { minLength: 1, maxLength: 10 }),
        (blocks) => {
          const deserialized = JSON.parse(JSON.stringify(blocks)) as ContentBlock[];

          for (let i = 0; i < blocks.length; i++) {
            const original = blocks[i];
            const restored = deserialized[i];
            if (original.type === 'tool_use' && restored.type === 'tool_use') {
              expect(restored.id).toBe(original.id);
              expect(restored.name).toBe(original.name);
              expect(restored.input).toEqual(original.input);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('round-trip preserves all fields of tool_result blocks', () => {
    fc.assert(
      fc.property(
        fc.array(toolResultBlockArb, { minLength: 1, maxLength: 10 }),
        (blocks) => {
          const deserialized = JSON.parse(JSON.stringify(blocks)) as ContentBlock[];

          for (let i = 0; i < blocks.length; i++) {
            const original = blocks[i];
            const restored = deserialized[i];
            if (original.type === 'tool_result' && restored.type === 'tool_result') {
              expect(restored.tool_use_id).toBe(original.tool_use_id);
              expect(restored.content).toBe(original.content);
              expect(restored.is_error).toBe(original.is_error);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('round-trip produces valid JSON (serialized string is parseable)', () => {
    fc.assert(
      fc.property(contentBlockArrayArb, (blocks) => {
        const serialized = JSON.stringify(blocks);

        // Must be a valid JSON string
        expect(typeof serialized).toBe('string');
        expect(() => JSON.parse(serialized)).not.toThrow();
      }),
      { numRuns: 200 },
    );
  });

  it('double round-trip is idempotent (serialize → deserialize → serialize → deserialize)', () => {
    fc.assert(
      fc.property(contentBlockArrayArb, (blocks) => {
        const firstRoundTrip = JSON.parse(JSON.stringify(blocks)) as ContentBlock[];
        const secondRoundTrip = JSON.parse(JSON.stringify(firstRoundTrip)) as ContentBlock[];

        expect(secondRoundTrip).toEqual(firstRoundTrip);
        expect(secondRoundTrip).toEqual(blocks);
      }),
      { numRuns: 200 },
    );
  });
});
