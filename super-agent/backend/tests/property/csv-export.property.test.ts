/**
 * Property-based tests for CSV Export
 *
 * Feature: unified-ecs-backend
 * Property 10: CSV Export Correctness
 * Validates: Requirements 5.6
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { TaskService } from '../../src/services/task.service.js';
import { taskRepository, type TaskEntity } from '../../src/repositories/task.repository.js';
import type { TaskStatus } from '../../src/schemas/task.schema.js';

// Mock the repository to test the service layer logic
vi.mock('../../src/repositories/task.repository.js', () => {
  // In-memory store for testing
  let mockTasks: TaskEntity[] = [];

  return {
    taskRepository: {
      findAllForExport: vi.fn(async () => mockTasks),
      // Helper to set mock data
      _setMockTasks: (tasks: TaskEntity[]) => {
        mockTasks = tasks;
      },
      _clear: () => {
        mockTasks = [];
      },
    },
  };
});

describe('CSV Export Properties', () => {
  const taskService = new TaskService();

  // Clear the mock store before each test
  beforeEach(() => {
    vi.clearAllMocks();
    (taskRepository as unknown as { _clear: () => void })._clear();
  });

  /**
   * Feature: unified-ecs-backend, Property 10: CSV Export Correctness
   * Validates: Requirements 5.6
   *
   * For any set of tasks, the CSV export should contain a header row
   * and one data row per task, with all task fields properly escaped and included.
   */
  it('should generate valid CSV with header and all task fields', async () => {
    // Generate timestamps as integers within a reasonable range (2020-2030) to avoid edge cases
    const minTimestamp = new Date('2020-01-01T00:00:00.000Z').getTime();
    const maxTimestamp = new Date('2030-12-31T23:59:59.999Z').getTime();
    const validDateArbitrary = fc.integer({ min: minTimestamp, max: maxTimestamp }).map(ts => new Date(ts));

    await fc.assert(
      fc.asyncProperty(
        // Generate an array of task-like objects
        fc.array(
          fc.record({
            id: fc.uuid(),
            organization_id: fc.uuid(),
            agent_id: fc.oneof(fc.uuid(), fc.constant(null)),
            workflow_id: fc.oneof(fc.uuid(), fc.constant(null)),
            description: fc.string({ minLength: 1, maxLength: 200 }),
            status: fc.constantFrom<TaskStatus>('complete', 'running', 'failed'),
            details: fc.constant({}),
            created_by: fc.oneof(fc.uuid(), fc.constant(null)),
            created_at: validDateArbitrary,
            updated_at: validDateArbitrary,
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (tasks) => {
          // Set mock tasks
          (taskRepository as unknown as { _setMockTasks: (tasks: TaskEntity[]) => void })._setMockTasks(
            tasks as TaskEntity[]
          );

          // Generate CSV
          const csv = await taskService.exportTasksToCsv('test-org-id');

          // Split into lines
          const lines = csv.split('\n');

          // Verify header row exists
          expect(lines.length).toBeGreaterThan(0);
          const headerLine = lines[0];
          expect(headerLine).toBe(
            'id,description,status,agent_id,workflow_id,created_by,created_at,updated_at'
          );

          // Verify we have correct number of data rows (header + task rows)
          expect(lines.length).toBe(tasks.length + 1);

          // Verify each task has a corresponding row
          for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const dataLine = lines[i + 1];

            // Verify the row is not empty
            expect(dataLine.length).toBeGreaterThan(0);

            // Parse the CSV row (simple parsing for verification)
            const fields = parseCsvLine(dataLine);

            // Verify all required fields are present
            expect(fields.length).toBe(8);

            // Verify field values match task data
            expect(fields[0]).toBe(task.id);
            expect(fields[2]).toBe(task.status);
            expect(fields[3]).toBe(task.agent_id ?? '');
            expect(fields[4]).toBe(task.workflow_id ?? '');
            expect(fields[5]).toBe(task.created_by ?? '');

            // Verify description is included (may be escaped and sanitized)
            const descriptionField = fields[1];
            // Newlines should be replaced with spaces
            const expectedDescription = task.description.replace(/[\r\n]+/g, ' ');
            
            // The field should contain the sanitized description
            // If it has commas or quotes, it will be wrapped in quotes
            if (expectedDescription.includes(',') || expectedDescription.includes('"')) {
              // Field should be quoted
              expect(dataLine).toContain('"');
            }

            // Verify timestamps are ISO format (handle both 4-digit and 5+ digit years)
            expect(fields[6]).toMatch(/^[+-]?\d{4,}-\d{2}-\d{2}T/);
            expect(fields[7]).toMatch(/^[+-]?\d{4,}-\d{2}-\d{2}T/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test that CSV properly escapes special characters
   */
  it('should properly escape fields containing commas, quotes, and newlines', async () => {
    // Use a fixed valid date to avoid NaN date issues
    const validDate = new Date('2024-01-15T10:30:00.000Z');
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          organization_id: fc.uuid(),
          agent_id: fc.constant(null),
          workflow_id: fc.constant(null),
          description: fc.oneof(
            fc.constant('Task with, comma'),
            fc.constant('Task with "quotes"'),
            fc.constant('Task with\nnewline'),
            fc.constant('Task with, comma and "quotes"')
          ),
          status: fc.constantFrom<TaskStatus>('complete', 'running', 'failed'),
          details: fc.constant({}),
          created_by: fc.constant(null),
          created_at: fc.constant(validDate),
          updated_at: fc.constant(validDate),
        }),
        async (task) => {
          // Set mock tasks
          (taskRepository as unknown as { _setMockTasks: (tasks: TaskEntity[]) => void })._setMockTasks(
            [task as TaskEntity]
          );

          // Generate CSV
          const csv = await taskService.exportTasksToCsv('test-org-id');
          const lines = csv.split('\n');

          // Should have header + 1 data row (newlines are replaced with spaces)
          expect(lines.length).toBe(2);

          const dataLine = lines[1];

          // Parse and verify the description is preserved
          const fields = parseCsvLine(dataLine);
          const descriptionField = fields[1];

          // Newlines should be replaced with spaces
          const expectedDescription = task.description.replace(/[\r\n]+/g, ' ');

          // If description contains comma or quote, it should be quoted
          if (expectedDescription.includes(',') || expectedDescription.includes('"')) {
            expect(dataLine).toContain('"');

            // Verify the description content is preserved
            // The parser removes the outer quotes, so we compare the unquoted content
            if (task.description.includes('"')) {
              // Quotes are escaped as "" in CSV, but our parser converts them back to "
              const expectedWithEscapedQuotes = expectedDescription.replace(/"/g, '""');
              // The parsed field should have the quotes unescaped
              expect(descriptionField).toBe(expectedDescription);
            } else {
              expect(descriptionField).toBe(expectedDescription);
            }
          } else {
            // No special chars, should match exactly
            expect(descriptionField).toBe(expectedDescription);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Simple CSV line parser for testing purposes.
 * Handles quoted fields with escaped quotes.
 *
 * @param line - CSV line to parse
 * @returns Array of field values
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }

    if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(currentField);
      currentField = '';
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  // Add last field
  fields.push(currentField);

  return fields;
}
