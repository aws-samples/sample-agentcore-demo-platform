/**
 * Zod validation schemas for Document entity
 */
import { z } from 'zod';
import { uuidSchema } from './common.schema.js';

/**
 * Document file type enum values
 */
export const documentFileTypeValues = ['PDF', 'TXT', 'MD', 'DOCX'] as const;
export const documentFileTypeSchema = z.enum(documentFileTypeValues);

/**
 * Document status enum values
 */
export const documentStatusValues = ['indexed', 'processing', 'error'] as const;
export const documentStatusSchema = z.enum(documentStatusValues);

/**
 * Schema for creating a new document
 */
export const createDocumentSchema = z.object({
  title: z
    .string()
    .min(1, 'Document title is required')
    .max(255, 'Document title must be 255 characters or less'),
  category: z.string().max(100).optional().nullable(),
  file_name: z
    .string()
    .min(1, 'File name is required')
    .max(255, 'File name must be 255 characters or less'),
  file_type: documentFileTypeSchema.optional().nullable(),
  file_path: z.string().min(1, 'File path is required'),
  status: documentStatusSchema.default('processing'),
});

/**
 * Schema for updating a document
 */
export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  category: z.string().max(100).optional().nullable(),
  status: documentStatusSchema.optional(),
});

/**
 * Schema for document query filters
 */
export const documentFilterSchema = z.object({
  category: z.string().optional(),
  status: documentStatusSchema.optional(),
  file_type: documentFileTypeSchema.optional(),
});

/**
 * Schema for document response (includes all fields)
 */
export const documentResponseSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  title: z.string(),
  category: z.string().nullable(),
  file_name: z.string(),
  file_type: z.string().nullable(),
  file_path: z.string(),
  status: documentStatusSchema,
  created_at: z.date(),
  updated_at: z.date(),
});

// Type exports
export type DocumentFileType = z.infer<typeof documentFileTypeSchema>;
export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentFilter = z.infer<typeof documentFilterSchema>;
export type DocumentResponse = z.infer<typeof documentResponseSchema>;
