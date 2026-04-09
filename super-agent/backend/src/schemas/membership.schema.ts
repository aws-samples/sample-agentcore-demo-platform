/**
 * Zod validation schemas for Membership entity
 */
import { z } from 'zod';
import { uuidSchema } from './common.schema.js';

/**
 * Membership role enum values
 */
export const membershipRoleValues = ['owner', 'admin', 'member', 'viewer'] as const;
export const membershipRoleSchema = z.enum(membershipRoleValues);

/**
 * Membership status enum values
 */
export const membershipStatusValues = ['pending', 'active', 'inactive'] as const;
export const membershipStatusSchema = z.enum(membershipStatusValues);

/**
 * Schema for inviting a new member
 */
export const inviteMemberSchema = z.object({
  invited_email: z.string().email('Invalid email address'),
  role: membershipRoleSchema.default('member'),
});

/**
 * Schema for updating a membership
 */
export const updateMembershipSchema = z.object({
  role: membershipRoleSchema.optional(),
  status: membershipStatusSchema.optional(),
});

/**
 * Schema for membership query filters
 */
export const membershipFilterSchema = z.object({
  role: membershipRoleSchema.optional(),
  status: membershipStatusSchema.optional(),
  user_id: uuidSchema.optional(),
});

/**
 * Schema for membership response (includes all fields)
 */
export const membershipResponseSchema = z.object({
  id: uuidSchema,
  organization_id: uuidSchema,
  user_id: uuidSchema,
  role: membershipRoleSchema,
  status: membershipStatusSchema,
  invited_email: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

// Type exports
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
export type MembershipFilter = z.infer<typeof membershipFilterSchema>;
export type MembershipResponse = z.infer<typeof membershipResponseSchema>;
