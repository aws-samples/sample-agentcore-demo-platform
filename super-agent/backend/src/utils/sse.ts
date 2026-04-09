/**
 * SSE (Server-Sent Events) Utilities
 *
 * Provides formatting functions for SSE events used in streaming responses.
 * Requirements: 8.2, 8.3
 */

/**
 * SSE event data structure
 */
export interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * Format an SSE event for streaming.
 * Requirements: 8.2 - WHEN streaming a response, THE Chat_API SHALL send chunks as SSE events with proper formatting
 *
 * @param event - The SSE event to format
 * @returns Formatted SSE string
 */
export function formatSSEEvent(event: SSEEvent): string {
  let result = '';

  if (event.event) {
    result += `event: ${event.event}\n`;
  }

  if (event.id) {
    result += `id: ${event.id}\n`;
  }

  if (event.retry) {
    result += `retry: ${event.retry}\n`;
  }

  // Data can be multi-line, each line needs 'data: ' prefix
  const dataLines = event.data.split('\n');
  for (const line of dataLines) {
    result += `data: ${line}\n`;
  }

  result += '\n';
  return result;
}

/**
 * Format the [DONE] event that signals stream completion.
 * Requirements: 8.3 - WHEN the stream completes, THE Chat_API SHALL send a [DONE] event
 *
 * @returns Formatted [DONE] SSE event string
 */
export function formatDoneEvent(): string {
  return formatSSEEvent({ data: '[DONE]' });
}
