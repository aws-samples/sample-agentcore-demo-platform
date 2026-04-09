/**
 * Property-based tests for SSE Streaming Format
 *
 * Feature: unified-ecs-backend
 * Property 8: SSE Streaming Format
 * Validates: Requirements 8.2, 8.3
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatSSEEvent, type SSEEvent } from '../../src/utils/sse.js';

/**
 * Parse an SSE formatted string back into its components.
 * This is used to verify the round-trip of SSE formatting.
 */
function parseSSEEvent(sseString: string): SSEEvent {
  const lines = sseString.split('\n');
  const result: SSEEvent = { data: '' };
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      result.event = line.substring(7);
    } else if (line.startsWith('id: ')) {
      result.id = line.substring(4);
    } else if (line.startsWith('retry: ')) {
      result.retry = parseInt(line.substring(7), 10);
    } else if (line.startsWith('data: ')) {
      dataLines.push(line.substring(6));
    }
  }

  result.data = dataLines.join('\n');
  return result;
}

/**
 * Verify that an SSE string follows the correct format:
 * - Each field is on its own line
 * - Data lines start with "data: "
 * - Event ends with double newline
 */
function isValidSSEFormat(sseString: string): boolean {
  // Must end with double newline
  if (!sseString.endsWith('\n\n')) {
    return false;
  }

  // Must have at least one data line
  if (!sseString.includes('data: ')) {
    return false;
  }

  // Each line should be a valid SSE field or empty
  const lines = sseString.slice(0, -2).split('\n'); // Remove trailing \n\n
  for (const line of lines) {
    if (line === '') continue;
    const validPrefixes = ['data: ', 'event: ', 'id: ', 'retry: '];
    if (!validPrefixes.some((prefix) => line.startsWith(prefix))) {
      return false;
    }
  }

  return true;
}

// Arbitrary for generating valid event names (alphanumeric and underscore)
const eventNameArbitrary = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')), { minLength: 1, maxLength: 20 })
  .map((chars) => chars.join(''));

// Arbitrary for generating valid IDs (hex characters and dashes)
const idArbitrary = fc
  .array(fc.constantFrom(...'0123456789abcdef-'.split('')), { minLength: 1, maxLength: 36 })
  .map((chars) => chars.join(''));

describe('SSE Streaming Format Properties', () => {
  /**
   * Feature: unified-ecs-backend, Property 8: SSE Streaming Format
   * Validates: Requirements 8.2, 8.3
   *
   * For any chat streaming response, each chunk should follow the SSE format
   * (`data: {content}\n\n`), and the stream should end with a `data: [DONE]\n\n` event.
   */
  describe('SSE Event Formatting', () => {
    it('should produce valid SSE format for any data content', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          (data) => {
            const event: SSEEvent = { data };
            const formatted = formatSSEEvent(event);

            // Verify valid SSE format
            expect(isValidSSEFormat(formatted)).toBe(true);

            // Verify data can be parsed back
            const parsed = parseSSEEvent(formatted);
            expect(parsed.data).toBe(data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve event type through formatting', () => {
      fc.assert(
        fc.property(
          fc.record({
            event: fc.option(eventNameArbitrary, { nil: undefined }),
            data: fc.string({ minLength: 1, maxLength: 500 }),
          }),
          ({ event, data }) => {
            const sseEvent: SSEEvent = { data };
            if (event !== undefined) {
              sseEvent.event = event;
            }

            const formatted = formatSSEEvent(sseEvent);

            // Verify valid SSE format
            expect(isValidSSEFormat(formatted)).toBe(true);

            // Verify event type is preserved
            const parsed = parseSSEEvent(formatted);
            expect(parsed.event).toBe(event);
            expect(parsed.data).toBe(data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve id through formatting', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.option(idArbitrary, { nil: undefined }),
            data: fc.string({ minLength: 1, maxLength: 500 }),
          }),
          ({ id, data }) => {
            const sseEvent: SSEEvent = { data };
            if (id !== undefined) {
              sseEvent.id = id;
            }

            const formatted = formatSSEEvent(sseEvent);

            // Verify valid SSE format
            expect(isValidSSEFormat(formatted)).toBe(true);

            // Verify id is preserved
            const parsed = parseSSEEvent(formatted);
            expect(parsed.id).toBe(id);
            expect(parsed.data).toBe(data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve retry value through formatting', () => {
      fc.assert(
        fc.property(
          fc.record({
            retry: fc.option(fc.integer({ min: 100, max: 30000 }), { nil: undefined }),
            data: fc.string({ minLength: 1, maxLength: 500 }),
          }),
          ({ retry, data }) => {
            const sseEvent: SSEEvent = { data };
            if (retry !== undefined) {
              sseEvent.retry = retry;
            }

            const formatted = formatSSEEvent(sseEvent);

            // Verify valid SSE format
            expect(isValidSSEFormat(formatted)).toBe(true);

            // Verify retry is preserved
            const parsed = parseSSEEvent(formatted);
            expect(parsed.retry).toBe(retry);
            expect(parsed.data).toBe(data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multi-line data correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 5 }),
          (lines) => {
            const multiLineData = lines.join('\n');
            const event: SSEEvent = { data: multiLineData };
            const formatted = formatSSEEvent(event);

            // Verify valid SSE format
            expect(isValidSSEFormat(formatted)).toBe(true);

            // Verify multi-line data is preserved
            const parsed = parseSSEEvent(formatted);
            expect(parsed.data).toBe(multiLineData);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('DONE Event Format', () => {
    /**
     * Requirements 8.3: WHEN the stream completes, THE Chat_API SHALL send a [DONE] event
     */
    it('should format [DONE] event correctly', () => {
      const doneEvent: SSEEvent = { data: '[DONE]' };
      const formatted = formatSSEEvent(doneEvent);

      // Verify it matches the expected format
      expect(formatted).toBe('data: [DONE]\n\n');
      expect(isValidSSEFormat(formatted)).toBe(true);
    });

    it('should produce consistent [DONE] format regardless of other properties', () => {
      // The [DONE] event should always be formatted the same way
      const doneEvent: SSEEvent = { data: '[DONE]' };
      const formatted = formatSSEEvent(doneEvent);

      // Parse and verify
      const parsed = parseSSEEvent(formatted);
      expect(parsed.data).toBe('[DONE]');
    });
  });

  describe('Full SSE Event Round-Trip', () => {
    it('should preserve all fields through format/parse round-trip', () => {
      fc.assert(
        fc.property(
          fc.record({
            event: fc.option(eventNameArbitrary, { nil: undefined }),
            data: fc.string({ minLength: 1, maxLength: 500 }),
            id: fc.option(idArbitrary, { nil: undefined }),
            retry: fc.option(fc.integer({ min: 100, max: 30000 }), { nil: undefined }),
          }),
          ({ event, data, id, retry }) => {
            const sseEvent: SSEEvent = { data };
            if (event !== undefined) sseEvent.event = event;
            if (id !== undefined) sseEvent.id = id;
            if (retry !== undefined) sseEvent.retry = retry;

            const formatted = formatSSEEvent(sseEvent);

            // Verify valid SSE format
            expect(isValidSSEFormat(formatted)).toBe(true);

            // Verify round-trip preserves all fields
            const parsed = parseSSEEvent(formatted);
            expect(parsed.data).toBe(data);
            expect(parsed.event).toBe(event);
            expect(parsed.id).toBe(id);
            expect(parsed.retry).toBe(retry);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('JSON Content Streaming', () => {
    /**
     * Requirements 8.2: WHEN streaming a response, THE Chat_API SHALL send chunks as SSE events
     * with proper formatting
     *
     * This tests that JSON content (typical for chat responses) is properly formatted.
     */
    it('should correctly format JSON content chunks', () => {
      fc.assert(
        fc.property(
          fc.record({
            content: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          (chunk) => {
            const jsonData = JSON.stringify(chunk);
            const event: SSEEvent = { data: jsonData };
            const formatted = formatSSEEvent(event);

            // Verify valid SSE format
            expect(isValidSSEFormat(formatted)).toBe(true);

            // Verify JSON can be recovered
            const parsed = parseSSEEvent(formatted);
            const recoveredChunk = JSON.parse(parsed.data);
            expect(recoveredChunk).toEqual(chunk);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly format session event with JSON data', () => {
      fc.assert(
        fc.property(fc.uuid(), (sessionId) => {
          const sessionData = JSON.stringify({ session_id: sessionId });
          const event: SSEEvent = {
            event: 'session',
            data: sessionData,
          };
          const formatted = formatSSEEvent(event);

          // Verify valid SSE format
          expect(isValidSSEFormat(formatted)).toBe(true);

          // Verify session data can be recovered
          const parsed = parseSSEEvent(formatted);
          expect(parsed.event).toBe('session');
          const recoveredData = JSON.parse(parsed.data);
          expect(recoveredData.session_id).toBe(sessionId);
        }),
        { numRuns: 100 }
      );
    });
  });
});
