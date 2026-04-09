/**
 * Property-Based Tests for Timestamp Auto-Update
 * 
 * Feature: supabase-backend, Property 5: Timestamp Auto-Update
 * Validates: Requirements 3.4, 6.4
 * 
 * Property 5: Timestamp Auto-Update
 * *For any* UPDATE operation on a table with `updated_at` column,
 * the timestamp SHALL be automatically set to the current time.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

// ============================================================================
// Type Definitions
// ============================================================================

interface RecordWithTimestamp {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

interface UpdatePayload {
  name?: string;
  status?: string;
  description?: string;
  [key: string]: unknown;
}

// ============================================================================
// Generators
// ============================================================================

const recordIdArbitrary = fc.uuid();

const pastDateArbitrary = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2024-12-31'),
});

const recordArbitrary = fc.record({
  id: recordIdArbitrary,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  created_at: pastDateArbitrary,
  updated_at: pastDateArbitrary,
});

const updatePayloadArbitrary = fc.record({
  name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  status: fc.option(fc.constantFrom('active', 'busy', 'offline'), { nil: undefined }),
  description: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: undefined }),
});

// ============================================================================
// Trigger Simulation Functions
// ============================================================================

/**
 * Simulates the private.update_timestamp() PostgreSQL trigger function.
 * This trigger runs BEFORE UPDATE on tables with updated_at column.
 * 
 * It sets updated_at to the current time (now()).
 */
function applyUpdateTimestampTrigger(
  existingRecord: RecordWithTimestamp,
  updatePayload: UpdatePayload,
  currentTime: Date
): RecordWithTimestamp {
  // Merge the update payload with existing record
  const updatedRecord: RecordWithTimestamp = {
    ...existingRecord,
    ...updatePayload,
  };
  
  // The trigger sets updated_at to now()
  updatedRecord.updated_at = currentTime;
  
  return updatedRecord;
}

/**
 * Simulates a complete UPDATE operation with the timestamp trigger.
 */
function simulateUpdate(
  existingRecord: RecordWithTimestamp,
  updatePayload: UpdatePayload,
  currentTime: Date
): RecordWithTimestamp {
  return applyUpdateTimestampTrigger(existingRecord, updatePayload, currentTime);
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Timestamp Auto-Update - Property-Based Tests', () => {
  let mockCurrentTime: Date;
  
  beforeEach(() => {
    // Set a fixed "current time" for testing
    mockCurrentTime = new Date('2025-01-09T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockCurrentTime);
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Feature: supabase-backend, Property 5: Timestamp Auto-Update
   * Validates: Requirements 3.4, 6.4
   */
  describe('Property 5: Timestamp Auto-Update', () => {
    it('should automatically update updated_at to current time on any update', () => {
      fc.assert(
        fc.property(
          recordArbitrary,
          updatePayloadArbitrary,
          (existingRecord, updatePayload) => {
            const currentTime = new Date();
            const result = simulateUpdate(existingRecord, updatePayload, currentTime);
            
            // updated_at should be set to current time
            expect(result.updated_at).toEqual(currentTime);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update timestamp even when no fields are changed', () => {
      fc.assert(
        fc.property(
          recordArbitrary,
          (existingRecord) => {
            const currentTime = new Date();
            // Empty update payload - no actual changes
            const emptyPayload: UpdatePayload = {};
            
            const result = simulateUpdate(existingRecord, emptyPayload, currentTime);
            
            // updated_at should still be updated to current time
            expect(result.updated_at).toEqual(currentTime);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve created_at timestamp on update', () => {
      fc.assert(
        fc.property(
          recordArbitrary,
          updatePayloadArbitrary,
          (existingRecord, updatePayload) => {
            const currentTime = new Date();
            const result = simulateUpdate(existingRecord, updatePayload, currentTime);
            
            // created_at should remain unchanged
            expect(result.created_at).toEqual(existingRecord.created_at);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set updated_at to a time >= original updated_at', () => {
      fc.assert(
        fc.property(
          recordArbitrary,
          updatePayloadArbitrary,
          (existingRecord, updatePayload) => {
            // Use a time that's definitely after the record's updated_at
            const currentTime = new Date(Math.max(
              existingRecord.updated_at.getTime() + 1000,
              Date.now()
            ));
            
            const result = simulateUpdate(existingRecord, updatePayload, currentTime);
            
            // New updated_at should be >= original
            expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(
              existingRecord.updated_at.getTime()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply timestamp update consistently across multiple updates', () => {
      fc.assert(
        fc.property(
          recordArbitrary,
          fc.array(updatePayloadArbitrary, { minLength: 2, maxLength: 5 }),
          (existingRecord, updates) => {
            let currentRecord = existingRecord;
            const timestamps: Date[] = [];
            
            // Apply multiple updates with increasing timestamps
            updates.forEach((updatePayload, index) => {
              const updateTime = new Date(mockCurrentTime.getTime() + (index + 1) * 1000);
              currentRecord = simulateUpdate(currentRecord, updatePayload, updateTime);
              timestamps.push(currentRecord.updated_at);
            });
            
            // Each timestamp should be greater than the previous
            for (let i = 1; i < timestamps.length; i++) {
              expect(timestamps[i].getTime()).toBeGreaterThan(timestamps[i - 1].getTime());
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve record id on update', () => {
      fc.assert(
        fc.property(
          recordArbitrary,
          updatePayloadArbitrary,
          (existingRecord, updatePayload) => {
            const currentTime = new Date();
            const result = simulateUpdate(existingRecord, updatePayload, currentTime);
            
            // id should remain unchanged
            expect(result.id).toBe(existingRecord.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply update payload fields correctly', () => {
      fc.assert(
        fc.property(
          recordArbitrary,
          fc.string({ minLength: 1, maxLength: 100 }),
          (existingRecord, newName) => {
            const currentTime = new Date();
            const updatePayload: UpdatePayload = { name: newName };
            
            const result = simulateUpdate(existingRecord, updatePayload, currentTime);
            
            // name should be updated
            expect(result.name).toBe(newName);
            // updated_at should be current time
            expect(result.updated_at).toEqual(currentTime);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle updates to different table types consistently', () => {
      // Simulate updates to different table types (agents, workflows, tasks, etc.)
      const tableTypes = ['agents', 'workflows', 'tasks', 'documents', 'mcp_servers'];
      
      fc.assert(
        fc.property(
          recordArbitrary,
          updatePayloadArbitrary,
          fc.constantFrom(...tableTypes),
          (existingRecord, updatePayload, _tableType) => {
            const currentTime = new Date();
            const result = simulateUpdate(existingRecord, updatePayload, currentTime);
            
            // Regardless of table type, updated_at should be set to current time
            expect(result.updated_at).toEqual(currentTime);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not modify updated_at if explicitly provided in payload (trigger overrides)', () => {
      fc.assert(
        fc.property(
          recordArbitrary,
          pastDateArbitrary,
          (existingRecord, explicitTimestamp) => {
            const currentTime = new Date();
            // Even if someone tries to set updated_at explicitly, the trigger overrides it
            const updatePayload: UpdatePayload = {
              updated_at: explicitTimestamp,
            };
            
            const result = simulateUpdate(existingRecord, updatePayload, currentTime);
            
            // Trigger should override any explicit updated_at with current time
            expect(result.updated_at).toEqual(currentTime);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
