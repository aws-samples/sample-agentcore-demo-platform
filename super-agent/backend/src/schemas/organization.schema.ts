/**
 * Zod validation schemas for Organization entity
 */
import { z } from 'zod';
import { uuidSchema } from './common.schema.js';

/**
 * Organization plan type enum values
 */
export const organizationPlanTypeValues = ['free', 'pro', 'enterprise'] as const;
export const organizationPlanTypeSchema = z.enum(organizationPlanTypeValues);

/**
 * Schema for creating a new organization
 */
export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(255, 'Organization name must be 255 characters or less'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be 100 characters or less')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens only'),
  plan_type: organizationPlanTypeSchema.default('free'),
  settings: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Schema for updating an organization
 */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  plan_type: organizationPlanTypeSchema.optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for organization query filters
 */
export const organizationFilterSchema = z.object({
  plan_type: organizationPlanTypeSchema.optional(),
  slug: z.string().optional(),
});

/**
 * Schema for organization response (includes all fields)
 */
export const organizationResponseSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  plan_type: organizationPlanTypeSchema,
  settings: z.record(z.string(), z.unknown()),
  created_at: z.date(),
  updated_at: z.date(),
});

// Type exports
export type OrganizationPlanType = z.infer<typeof organizationPlanTypeSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type OrganizationFilter = z.infer<typeof organizationFilterSchema>;
export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;
