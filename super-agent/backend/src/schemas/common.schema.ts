/**
 * Common Zod schemas used across multiple entities
 */
import { z } from 'zod';

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Pagination query parameters schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(0).default(0), // 0 = no pagination (return all)
});

/**
 * Common ID parameter schema
 */
export const idParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Timestamp fields schema (for responses)
 */
export const timestampSchema = z.object({
  created_at: z.date(),
  updated_at: z.date(),
});

/**
 * Error response schema
 */
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.unknown().optional(),
  requestId: z.string(),
});

// Type exports
export type Pagination = z.infer<typeof paginationSchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
