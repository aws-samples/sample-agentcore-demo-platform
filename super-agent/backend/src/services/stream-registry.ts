/**
 * Stream Registry
 * Manages active SSE streams so that clients can reconnect to in-progress sessions.
 * Each generating session publishes events here; new subscribers get buffered events
 * plus live events going forward.
 */

import { EventEmitter } from 'events';
import type { ConversationEvent } from './claude-agent.service.js';

interface ActiveStream {
  /** All events emitted so far (for replay on reconnect) */
  buffer: ConversationEvent[];
  /** Whether the stream has completed */
  done: boolean;
  /** EventEmitter for live subscribers */
  emitter: EventEmitter;
}

class StreamRegistry {
  private streams = new Map<string, ActiveStream>();

  /**
   * Register a new active stream for a session.
   */
  register(sessionId: string): void {
    this.streams.set(sessionId, {
      buffer: [],
      done: false,
      emitter: new EventEmitter(),
    });
  }

  /**
   * Push an event to the stream buffer and notify subscribers.
   */
  push(sessionId: string, event: ConversationEvent): void {
    const stream = this.streams.get(sessionId);
    if (!stream) return;
    stream.buffer.push(event);
    stream.emitter.emit('event', event);
  }

  /**
   * Mark the stream as done and notify subscribers.
   */
  complete(sessionId: string): void {
    const stream = this.streams.get(sessionId);
    if (!stream) return;
    stream.done = true;
    stream.emitter.emit('done');
    // Clean up after a delay to allow late reconnects
    setTimeout(() => {
      this.streams.delete(sessionId);
    }, 30_000);
  }

  /**
   * Check if a session has an active (not yet done) stream.
   */
  isActive(sessionId: string): boolean {
    const stream = this.streams.get(sessionId);
    return !!stream && !stream.done;
  }

  /**
   * Subscribe to a session's stream. Returns the buffered events so far
   * and an emitter for live events. Returns null if no active stream.
   */
  subscribe(sessionId: string): {
    buffer: ConversationEvent[];
    emitter: EventEmitter;
    done: boolean;
  } | null {
    const stream = this.streams.get(sessionId);
    if (!stream) return null;
    return {
      buffer: [...stream.buffer],
      emitter: stream.emitter,
      done: stream.done,
    };
  }
}

export const streamRegistry = new StreamRegistry();
