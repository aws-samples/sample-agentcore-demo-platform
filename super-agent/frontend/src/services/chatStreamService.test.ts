/**
 * Unit tests for Chat Stream Service
 *
 * Tests SSE parsing logic, event type handling, session management,
 * and the streamChat function.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseSSEFrames,
  parseSSEData,
  streamChat,
  storeSessionId,
  getStoredSessionId,
  clearStoredSessionId,
  type AssistantEvent,
  type ResultEvent,
  type HeartbeatEvent,
  type ErrorEvent,
  type ChatStreamCallbacks,
} from './chatStreamService';

// ============================================================================
// parseSSEFrames
// ============================================================================

describe('parseSSEFrames', () => {
  it('should parse a single data-only frame', () => {
    const raw = 'data: {"type":"heartbeat"}\n\n';
    const frames = parseSSEFrames(raw);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual({ event: undefined, data: '{"type":"heartbeat"}' });
  });

  it('should parse a frame with event and data fields', () => {
    const raw = 'event: session_start\ndata: {"session_id":"abc-123"}\n\n';
    const frames = parseSSEFrames(raw);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual({
      event: 'session_start',
      data: '{"session_id":"abc-123"}',
    });
  });

  it('should parse multiple frames', () => {
    const raw =
      'event: session\ndata: {"session_id":"s1"}\n\n' +
      'data: {"type":"assistant","content":[{"type":"text","text":"Hello"}]}\n\n' +
      'data: [DONE]\n\n';
    const frames = parseSSEFrames(raw);
    expect(frames).toHaveLength(3);
    expect(frames[0].event).toBe('session');
    expect(frames[1].data).toContain('assistant');
    expect(frames[2].data).toBe('[DONE]');
  });

  it('should ignore comment lines starting with :', () => {
    const raw = ': this is a comment\ndata: {"type":"heartbeat"}\n\n';
    const frames = parseSSEFrames(raw);
    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe('{"type":"heartbeat"}');
  });

  it('should handle empty input', () => {
    expect(parseSSEFrames('')).toEqual([]);
    expect(parseSSEFrames('\n\n')).toEqual([]);
  });

  it('should handle multi-line data fields', () => {
    const raw = 'data: line1\ndata: line2\n\n';
    const frames = parseSSEFrames(raw);
    expect(frames).toHaveLength(1);
    expect(frames[0].data).toBe('line1\nline2');
  });

  it('should skip frames with no data lines', () => {
    const raw = 'event: something\n\n';
    const frames = parseSSEFrames(raw);
    expect(frames).toEqual([]);
  });
});

// ============================================================================
// parseSSEData
// ============================================================================

describe('parseSSEData', () => {
  describe('[DONE] sentinel', () => {
    it('should parse [DONE] as a done event', () => {
      const event = parseSSEData('[DONE]');
      expect(event).toEqual({ type: 'done' });
    });

    it('should handle [DONE] with whitespace', () => {
      const event = parseSSEData('  [DONE]  ');
      expect(event).toEqual({ type: 'done' });
    });
  });

  describe('session_start events (Requirement 9.4)', () => {
    it('should parse session_start from event name', () => {
      const event = parseSSEData('{"session_id":"abc-123"}', 'session_start');
      expect(event).toEqual({
        type: 'session_start',
        session_id: 'abc-123',
      });
    });

    it('should parse session_start from "session" event name', () => {
      const event = parseSSEData('{"session_id":"abc-123"}', 'session');
      expect(event).toEqual({
        type: 'session_start',
        session_id: 'abc-123',
      });
    });

    it('should parse session_start from type field in data', () => {
      const event = parseSSEData('{"type":"session_start","session_id":"xyz-789"}');
      expect(event).toEqual({
        type: 'session_start',
        session_id: 'xyz-789',
      });
    });

    it('should fallback to session_start for JSON with session_id but no type', () => {
      const event = parseSSEData('{"session_id":"fallback-id"}');
      expect(event).toEqual({
        type: 'session_start',
        session_id: 'fallback-id',
      });
    });

    it('should handle missing session_id gracefully', () => {
      const event = parseSSEData('{}', 'session_start');
      expect(event).toEqual({
        type: 'session_start',
        session_id: '',
      });
    });
  });

  describe('assistant events (Requirements 9.1, 9.2, 9.3)', () => {
    it('should parse assistant event with text content block', () => {
      const data = JSON.stringify({
        type: 'assistant',
        content: [{ type: 'text', text: 'Hello, world!' }],
        model: 'claude-sonnet-4-5-20250929',
      });
      const event = parseSSEData(data) as AssistantEvent;
      expect(event.type).toBe('assistant');
      expect(event.content).toHaveLength(1);
      expect(event.content[0]).toEqual({ type: 'text', text: 'Hello, world!' });
      expect(event.model).toBe('claude-sonnet-4-5-20250929');
    });

    it('should parse assistant event with tool_use content block', () => {
      const data = JSON.stringify({
        type: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tu_123',
            name: 'Bash',
            input: { command: 'ls -la' },
          },
        ],
      });
      const event = parseSSEData(data) as AssistantEvent;
      expect(event.type).toBe('assistant');
      expect(event.content[0]).toEqual({
        type: 'tool_use',
        id: 'tu_123',
        name: 'Bash',
        input: { command: 'ls -la' },
      });
    });

    it('should parse assistant event with tool_result content block', () => {
      const data = JSON.stringify({
        type: 'assistant',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tu_123',
            content: 'file1.txt\nfile2.txt',
            is_error: false,
          },
        ],
      });
      const event = parseSSEData(data) as AssistantEvent;
      expect(event.type).toBe('assistant');
      expect(event.content[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tu_123',
        content: 'file1.txt\nfile2.txt',
        is_error: false,
      });
    });

    it('should parse assistant event with mixed content blocks', () => {
      const data = JSON.stringify({
        type: 'assistant',
        content: [
          { type: 'text', text: 'Let me check...' },
          { type: 'tool_use', id: 'tu_1', name: 'Read', input: { file_path: '/config.json' } },
          { type: 'tool_result', tool_use_id: 'tu_1', content: '{"key":"value"}', is_error: false },
          { type: 'text', text: 'The file contains a key-value pair.' },
        ],
      });
      const event = parseSSEData(data) as AssistantEvent;
      expect(event.type).toBe('assistant');
      expect(event.content).toHaveLength(4);
      expect(event.content[0].type).toBe('text');
      expect(event.content[1].type).toBe('tool_use');
      expect(event.content[2].type).toBe('tool_result');
      expect(event.content[3].type).toBe('text');
    });

    it('should handle assistant event with empty content array', () => {
      const data = JSON.stringify({ type: 'assistant', content: [] });
      const event = parseSSEData(data) as AssistantEvent;
      expect(event.type).toBe('assistant');
      expect(event.content).toEqual([]);
    });

    it('should handle assistant event with missing content', () => {
      const data = JSON.stringify({ type: 'assistant' });
      const event = parseSSEData(data) as AssistantEvent;
      expect(event.type).toBe('assistant');
      expect(event.content).toEqual([]);
    });
  });

  describe('result events (Requirement 9.7)', () => {
    it('should parse result event with all fields', () => {
      const data = JSON.stringify({
        type: 'result',
        session_id: 'sess-1',
        duration_ms: 5200,
        num_turns: 3,
      });
      const event = parseSSEData(data) as ResultEvent;
      expect(event).toEqual({
        type: 'result',
        session_id: 'sess-1',
        duration_ms: 5200,
        num_turns: 3,
      });
    });

    it('should handle result event with missing optional fields', () => {
      const data = JSON.stringify({ type: 'result', session_id: 'sess-2' });
      const event = parseSSEData(data) as ResultEvent;
      expect(event.type).toBe('result');
      expect(event.session_id).toBe('sess-2');
      expect(event.duration_ms).toBeUndefined();
      expect(event.num_turns).toBeUndefined();
    });
  });

  describe('heartbeat events (Requirement 9.5)', () => {
    it('should parse heartbeat event from type field', () => {
      const data = JSON.stringify({ type: 'heartbeat', timestamp: 1234567890 });
      const event = parseSSEData(data) as HeartbeatEvent;
      expect(event).toEqual({ type: 'heartbeat', timestamp: 1234567890 });
    });

    it('should parse heartbeat event from event name', () => {
      const event = parseSSEData('{}', 'heartbeat') as HeartbeatEvent;
      expect(event.type).toBe('heartbeat');
    });
  });

  describe('error events (Requirement 9.6)', () => {
    it('should parse error event with all fields', () => {
      const data = JSON.stringify({
        type: 'error',
        code: 'AGENT_TIMEOUT',
        message: 'Agent response timed out',
        suggested_action: 'Please try again',
      });
      const event = parseSSEData(data) as ErrorEvent;
      expect(event).toEqual({
        type: 'error',
        code: 'AGENT_TIMEOUT',
        message: 'Agent response timed out',
        suggested_action: 'Please try again',
      });
    });

    it('should parse error event from event name', () => {
      const data = JSON.stringify({
        error: 'Something went wrong',
        code: 'INTERNAL',
        suggested_action: 'Retry',
      });
      const event = parseSSEData(data, 'error') as ErrorEvent;
      expect(event.type).toBe('error');
      expect(event.message).toBe('Something went wrong');
      expect(event.code).toBe('INTERNAL');
      expect(event.suggested_action).toBe('Retry');
    });

    it('should prefer message over error field', () => {
      const data = JSON.stringify({
        type: 'error',
        message: 'Primary message',
        error: 'Fallback message',
      });
      const event = parseSSEData(data) as ErrorEvent;
      expect(event.message).toBe('Primary message');
    });

    it('should fall back to error field when message is missing', () => {
      const data = JSON.stringify({
        type: 'error',
        error: 'Fallback message',
      });
      const event = parseSSEData(data) as ErrorEvent;
      expect(event.message).toBe('Fallback message');
    });
  });

  describe('edge cases', () => {
    it('should return null for invalid JSON', () => {
      expect(parseSSEData('not json')).toBeNull();
    });

    it('should return null for unknown type', () => {
      expect(parseSSEData('{"type":"unknown_event"}')).toBeNull();
    });

    it('should return null for empty JSON object without session_id', () => {
      expect(parseSSEData('{}')).toBeNull();
    });
  });
});

// ============================================================================
// streamChat
// ============================================================================

describe('streamChat', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Helper to create a ReadableStream from SSE text chunks.
   */
  function createSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let index = 0;
    return new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });
  }

  function mockSuccessResponse(chunks: string[]): void {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: createSSEStream(chunks),
    } as unknown as Response);
  }

  it('should call onSessionStart when session_start event is received (Requirement 9.4)', async () => {
    const chunks = [
      'event: session\ndata: {"session_id":"test-session-1"}\n\n',
      'data: [DONE]\n\n',
    ];
    mockSuccessResponse(chunks);

    const callbacks: ChatStreamCallbacks = {
      onSessionStart: vi.fn(),
      onDone: vi.fn(),
    };

    const handle = streamChat(
      { agentId: 'agent-1', message: 'Hello' },
      callbacks
    );

    const sessionId = await handle.sessionId;
    expect(sessionId).toBe('test-session-1');

    // Wait for stream to complete
    await vi.waitFor(() => {
      expect(callbacks.onDone).toHaveBeenCalled();
    });

    expect(callbacks.onSessionStart).toHaveBeenCalledWith({
      type: 'session_start',
      session_id: 'test-session-1',
    });
  });

  it('should call onAssistant with text content blocks (Requirement 9.1)', async () => {
    const chunks = [
      'event: session\ndata: {"session_id":"s1"}\n\n',
      'data: {"type":"assistant","content":[{"type":"text","text":"Hello!"}],"model":"claude-sonnet-4-5-20250929"}\n\n',
      'data: [DONE]\n\n',
    ];
    mockSuccessResponse(chunks);

    const callbacks: ChatStreamCallbacks = {
      onSessionStart: vi.fn(),
      onAssistant: vi.fn(),
      onDone: vi.fn(),
    };

    const handle = streamChat(
      { agentId: 'agent-1', message: 'Hi' },
      callbacks
    );

    await handle.sessionId;
    await vi.waitFor(() => {
      expect(callbacks.onDone).toHaveBeenCalled();
    });

    expect(callbacks.onAssistant).toHaveBeenCalledWith({
      type: 'assistant',
      content: [{ type: 'text', text: 'Hello!' }],
      model: 'claude-sonnet-4-5-20250929',
    });
  });

  it('should call onAssistant with tool_use content blocks (Requirement 9.2)', async () => {
    const chunks = [
      'event: session\ndata: {"session_id":"s1"}\n\n',
      'data: {"type":"assistant","content":[{"type":"tool_use","id":"tu_1","name":"Bash","input":{"command":"ls"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    mockSuccessResponse(chunks);

    const callbacks: ChatStreamCallbacks = {
      onSessionStart: vi.fn(),
      onAssistant: vi.fn(),
      onDone: vi.fn(),
    };

    streamChat({ agentId: 'agent-1', message: 'list files' }, callbacks);

    await vi.waitFor(() => {
      expect(callbacks.onDone).toHaveBeenCalled();
    });

    expect(callbacks.onAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'Bash',
            input: { command: 'ls' },
          },
        ],
      })
    );
  });

  it('should call onAssistant with tool_result content blocks (Requirement 9.3)', async () => {
    const chunks = [
      'event: session\ndata: {"session_id":"s1"}\n\n',
      'data: {"type":"assistant","content":[{"type":"tool_result","tool_use_id":"tu_1","content":"output","is_error":false}]}\n\n',
      'data: [DONE]\n\n',
    ];
    mockSuccessResponse(chunks);

    const callbacks: ChatStreamCallbacks = {
      onSessionStart: vi.fn(),
      onAssistant: vi.fn(),
      onDone: vi.fn(),
    };

    streamChat({ agentId: 'agent-1', message: 'test' }, callbacks);

    await vi.waitFor(() => {
      expect(callbacks.onDone).toHaveBeenCalled();
    });

    expect(callbacks.onAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tu_1',
            content: 'output',
            is_error: false,
          },
        ],
      })
    );
  });

  it('should call onHeartbeat for heartbeat events without UI update (Requirement 9.5)', async () => {
    const chunks = [
      'event: session\ndata: {"session_id":"s1"}\n\n',
      'data: {"type":"heartbeat","timestamp":1234567890}\n\n',
      'data: [DONE]\n\n',
    ];
    mockSuccessResponse(chunks);

    const callbacks: ChatStreamCallbacks = {
      onSessionStart: vi.fn(),
      onHeartbeat: vi.fn(),
      onDone: vi.fn(),
    };

    streamChat({ agentId: 'agent-1', message: 'test' }, callbacks);

    await vi.waitFor(() => {
      expect(callbacks.onDone).toHaveBeenCalled();
    });

    expect(callbacks.onHeartbeat).toHaveBeenCalledWith({
      type: 'heartbeat',
      timestamp: 1234567890,
    });
  });

  it('should call onError for error events (Requirement 9.6)', async () => {
    const chunks = [
      'event: session\ndata: {"session_id":"s1"}\n\n',
      'data: {"type":"error","code":"AGENT_TIMEOUT","message":"Timed out","suggested_action":"Retry"}\n\n',
      'data: [DONE]\n\n',
    ];
    mockSuccessResponse(chunks);

    const callbacks: ChatStreamCallbacks = {
      onSessionStart: vi.fn(),
      onError: vi.fn(),
      onDone: vi.fn(),
    };

    streamChat({ agentId: 'agent-1', message: 'test' }, callbacks);

    await vi.waitFor(() => {
      expect(callbacks.onDone).toHaveBeenCalled();
    });

    expect(callbacks.onError).toHaveBeenCalledWith({
      type: 'error',
      code: 'AGENT_TIMEOUT',
      message: 'Timed out',
      suggested_action: 'Retry',
    });
  });

  it('should call onResult for result events (Requirement 9.7)', async () => {
    const chunks = [
      'event: session\ndata: {"session_id":"s1"}\n\n',
      'data: {"type":"result","session_id":"s1","duration_ms":5200,"num_turns":3}\n\n',
      'data: [DONE]\n\n',
    ];
    mockSuccessResponse(chunks);

    const callbacks: ChatStreamCallbacks = {
      onSessionStart: vi.fn(),
      onResult: vi.fn(),
      onDone: vi.fn(),
    };

    streamChat({ agentId: 'agent-1', message: 'test' }, callbacks);

    await vi.waitFor(() => {
      expect(callbacks.onDone).toHaveBeenCalled();
    });

    expect(callbacks.onResult).toHaveBeenCalledWith({
      type: 'result',
      session_id: 's1',
      duration_ms: 5200,
      num_turns: 3,
    });
  });

  it('should handle HTTP error responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'Internal server error' }),
    } as unknown as Response);

    const callbacks: ChatStreamCallbacks = {
      onError: vi.fn(),
    };

    const handle = streamChat(
      { agentId: 'agent-1', message: 'test' },
      callbacks
    );

    await expect(handle.sessionId).rejects.toThrow('Internal server error');

    await vi.waitFor(() => {
      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          code: 'HTTP_ERROR',
          message: 'Internal server error',
        })
      );
    });
  });

  it('should send session_id in request body when provided', async () => {
    const chunks = [
      'event: session\ndata: {"session_id":"existing-session"}\n\n',
      'data: [DONE]\n\n',
    ];
    mockSuccessResponse(chunks);

    const callbacks: ChatStreamCallbacks = {
      onSessionStart: vi.fn(),
      onDone: vi.fn(),
    };

    streamChat(
      { agentId: 'agent-1', message: 'Hello', sessionId: 'existing-session' },
      callbacks
    );

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const [, fetchOptions] = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchOptions.body);
    expect(body.session_id).toBe('existing-session');
    expect(body.agent_id).toBe('agent-1');
    expect(body.message).toBe('Hello');
  });

  it('should support aborting the stream', async () => {
    // Mock fetch to reject with AbortError when signal is aborted
    mockFetch.mockImplementation((_url: string, options: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    const callbacks: ChatStreamCallbacks = {
      onError: vi.fn(),
    };

    const handle = streamChat(
      { agentId: 'agent-1', message: 'test' },
      callbacks
    );

    // Abort the stream
    handle.abort();

    // The session ID promise should reject with abort error
    await expect(handle.sessionId).rejects.toThrow('Stream aborted');
  });

  it('should handle a full conversation flow', async () => {
    const chunks = [
      'event: session\ndata: {"session_id":"full-flow-session"}\n\n',
      'data: {"type":"assistant","content":[{"type":"text","text":"Let me check..."}]}\n\n',
      'data: {"type":"assistant","content":[{"type":"tool_use","id":"tu_1","name":"Bash","input":{"command":"ls"}}]}\n\n',
      'data: {"type":"heartbeat","timestamp":1234567890}\n\n',
      'data: {"type":"assistant","content":[{"type":"tool_result","tool_use_id":"tu_1","content":"file.txt","is_error":false}]}\n\n',
      'data: {"type":"assistant","content":[{"type":"text","text":"Found file.txt"}]}\n\n',
      'data: {"type":"result","session_id":"full-flow-session","duration_ms":3000,"num_turns":2}\n\n',
      'data: [DONE]\n\n',
    ];
    mockSuccessResponse(chunks);

    const callbacks: ChatStreamCallbacks = {
      onSessionStart: vi.fn(),
      onAssistant: vi.fn(),
      onResult: vi.fn(),
      onHeartbeat: vi.fn(),
      onDone: vi.fn(),
    };

    const handle = streamChat(
      { agentId: 'agent-1', message: 'list files' },
      callbacks
    );

    const sessionId = await handle.sessionId;
    expect(sessionId).toBe('full-flow-session');

    await vi.waitFor(() => {
      expect(callbacks.onDone).toHaveBeenCalledTimes(1);
    });

    expect(callbacks.onSessionStart).toHaveBeenCalledTimes(1);
    expect(callbacks.onAssistant).toHaveBeenCalledTimes(4);
    expect(callbacks.onHeartbeat).toHaveBeenCalledTimes(1);
    expect(callbacks.onResult).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Session ID Management
// ============================================================================

describe('Session ID Management', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockClear();
    vi.mocked(localStorage.removeItem).mockClear();
  });

  it('should store session ID in localStorage', () => {
    storeSessionId('test-session-123');
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'super-agent-chat-stream-session',
      'test-session-123'
    );
  });

  it('should retrieve stored session ID', () => {
    vi.mocked(localStorage.getItem).mockReturnValue('stored-session');
    const id = getStoredSessionId();
    expect(id).toBe('stored-session');
    expect(localStorage.getItem).toHaveBeenCalledWith('super-agent-chat-stream-session');
  });

  it('should return null when no session ID is stored', () => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    const id = getStoredSessionId();
    expect(id).toBeNull();
  });

  it('should clear stored session ID', () => {
    clearStoredSessionId();
    expect(localStorage.removeItem).toHaveBeenCalledWith('super-agent-chat-stream-session');
  });
});
