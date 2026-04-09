/**
 * Authorization Permission Definitions
 *
 * Defines the resource:action permission matrix for each role.
 * Roles are hierarchical: owner > admin > member > viewer
 */

import type { UserRole } from '../types/index.js';

// ─── Permission Types ────────────────────────────────────────────────────────

export type Resource =
  | 'agents'
  | 'workflows'
  | 'skills'
  | 'members'
  | 'organization'
  | 'api_keys'
  | 'tasks'
  | 'documents'
  | 'integrations';

export type Action = 'read' | 'write' | 'delete' | 'execute' | 'invite' | 'publish' | 'remove';

export type Permission = `${Resource}:${Action}`;

// ─── Role Permission Matrix ──────────────────────────────────────────────────

/**
 * Permissions granted to each role.
 * Higher roles inherit all permissions from lower roles.
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  viewer: [
    'agents:read',
    'workflows:read',
    'skills:read',
    'members:read',
    'organization:read',
    'tasks:read',
    'documents:read',
    'integrations:read',
  ],

  member: [
    // inherits viewer
    'agents:write',
    'agents:delete',   // own resources only — enforced in AuthorizationService
    'workflows:write',
    'workflows:delete', // own resources only
    'workflows:execute',
    'skills:write',
    'tasks:write',
    'tasks:delete',    // own resources only
    'documents:write',
    'documents:delete', // own resources only
    'api_keys:read',
    'api_keys:write',
    'api_keys:delete', // own resources only
  ],

  admin: [
    // inherits member
    'members:invite',
    'members:update',
    'members:remove',
    'organization:update',
    'skills:publish',
    'integrations:write',
    'integrations:delete',
  ],

  owner: [
    // inherits admin
    'organization:delete',
  ],
};

// ─── Resolved Permission Sets ────────────────────────────────────────────────

const ROLE_HIERARCHY: UserRole[] = ['viewer', 'member', 'admin', 'owner'];

/**
 * Builds the full permission set for a role by accumulating all permissions
 * from lower roles in the hierarchy.
 */
function buildPermissionSet(role: UserRole): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of ROLE_HIERARCHY) {
    for (const p of ROLE_PERMISSIONS[r]) {
      set.add(p);
    }
    if (r === role) break;
  }
  return set;
}

export const PERMISSIONS_BY_ROLE: Record<UserRole, Set<Permission>> = {
  viewer: buildPermissionSet('viewer'),
  member: buildPermissionSet('member'),
  admin: buildPermissionSet('admin'),
  owner: buildPermissionSet('owner'),
};

/**
 * Permissions that are restricted to the resource owner even when the role
 * grants them. Admins and owners bypass this check.
 */
export const OWNER_ONLY_PERMISSIONS = new Set<Permission>([
  'agents:delete',
  'workflows:delete',
  'tasks:delete',
  'documents:delete',
  'api_keys:delete',
]);

/**
 * Roles that bypass resource ownership checks (can act on any resource).
 */
export const OWNERSHIP_BYPASS_ROLES = new Set<UserRole>(['admin', 'owner']);
