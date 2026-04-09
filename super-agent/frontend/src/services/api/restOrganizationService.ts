/**
 * REST Organization Service
 * 
 * Implements the organization service interface using the REST API backend.
 */

import { restClient } from './restClient';
import { ServiceError } from '@/utils/errorHandling';

/**
 * API response type for organizations (snake_case from backend)
 */
interface ApiOrganization {
  id: string;
  name: string;
  slug: string;
  plan_type: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * API response type for memberships
 */
interface ApiMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  status: string;
  invited_email: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Application-level Organization type
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  planType: 'free' | 'pro' | 'enterprise';
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Application-level Membership type
 */
export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'pending' | 'active' | 'inactive';
  invitedEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input type for creating an organization
 */
export interface CreateOrganizationInput {
  name: string;
  slug?: string;
  planType?: 'free' | 'pro' | 'enterprise';
}

/**
 * Input type for inviting a user
 */
export interface InviteUserInput {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

/**
 * Maps API organization to application Organization type
 */
function mapApiOrganizationToOrganization(apiOrg: ApiOrganization): Organization {
  return {
    id: apiOrg.id,
    name: apiOrg.name,
    slug: apiOrg.slug,
    planType: apiOrg.plan_type as Organization['planType'],
    settings: apiOrg.settings,
    createdAt: new Date(apiOrg.created_at),
    updatedAt: new Date(apiOrg.updated_at),
  };
}

/**
 * Maps API membership to application Membership type
 */
function mapApiMembershipToMembership(apiMembership: ApiMembership): Membership {
  return {
    id: apiMembership.id,
    organizationId: apiMembership.organization_id,
    userId: apiMembership.user_id,
    role: apiMembership.role as Membership['role'],
    status: apiMembership.status as Membership['status'],
    invitedEmail: apiMembership.invited_email,
    createdAt: new Date(apiMembership.created_at),
    updatedAt: new Date(apiMembership.updated_at),
  };
}

/**
 * REST implementation of the Organization Service
 */
export const RestOrganizationService = {
  /**
   * Retrieves all organizations for the current user
   */
  async getOrganizations(): Promise<Organization[]> {
    try {
      const response = await restClient.get<ApiOrganization[]>('/api/organizations');
      return response.map(mapApiOrganizationToOrganization);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to fetch organizations', 'UNKNOWN');
    }
  },

  /**
   * Retrieves a single organization by ID
   */
  async getOrganizationById(id: string): Promise<Organization> {
    try {
      const response = await restClient.get<ApiOrganization>(`/api/organizations/${id}`);
      return mapApiOrganizationToOrganization(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch organization with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Creates a new organization
   */
  async createOrganization(input: CreateOrganizationInput): Promise<Organization> {
    try {
      if (!input.name || input.name.trim() === '') {
        throw new ServiceError('Organization name is required', 'VALIDATION_ERROR');
      }

      const requestData = {
        name: input.name.trim(),
        slug: input.slug || input.name.toLowerCase().replace(/\s+/g, '-'),
        plan_type: input.planType || 'free',
      };

      const response = await restClient.post<ApiOrganization>('/api/organizations', requestData);
      return mapApiOrganizationToOrganization(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to create organization', 'UNKNOWN');
    }
  },

  /**
   * Updates an organization
   */
  async updateOrganization(
    id: string,
    data: { name?: string; settings?: Record<string, unknown> }
  ): Promise<Organization> {
    try {
      const requestData: Record<string, unknown> = {};
      if (data.name !== undefined) requestData.name = data.name;
      if (data.settings !== undefined) requestData.settings = data.settings;

      const response = await restClient.put<ApiOrganization>(`/api/organizations/${id}`, requestData);
      return mapApiOrganizationToOrganization(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to update organization with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Deletes an organization
   */
  async deleteOrganization(id: string): Promise<void> {
    try {
      await restClient.delete(`/api/organizations/${id}`);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to delete organization with id "${id}"`, 'UNKNOWN');
    }
  },

  /**
   * Retrieves members of an organization
   */
  async getMembers(organizationId: string): Promise<Membership[]> {
    try {
      const response = await restClient.get<ApiMembership[]>(
        `/api/organizations/${organizationId}/members`
      );
      return response.map(mapApiMembershipToMembership);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to fetch members for organization "${organizationId}"`, 'UNKNOWN');
    }
  },

  /**
   * Invites a user to an organization
   */
  async inviteUser(organizationId: string, input: InviteUserInput): Promise<Membership> {
    try {
      if (!input.email || input.email.trim() === '') {
        throw new ServiceError('Email is required', 'VALIDATION_ERROR');
      }

      const response = await restClient.post<ApiMembership>(
        `/api/organizations/${organizationId}/members`,
        {
          email: input.email.trim(),
          role: input.role,
        }
      );
      return mapApiMembershipToMembership(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to invite user', 'UNKNOWN');
    }
  },

  /**
   * Updates a member's role
   */
  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: Membership['role']
  ): Promise<Membership> {
    try {
      const response = await restClient.put<ApiMembership>(
        `/api/organizations/${organizationId}/members/${userId}`,
        { role }
      );
      return mapApiMembershipToMembership(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(`Failed to update member role`, 'UNKNOWN');
    }
  },

  /**
   * Removes a member from an organization
   */
  async removeMember(organizationId: string, userId: string): Promise<void> {
    try {
      await restClient.delete(`/api/organizations/${organizationId}/members/${userId}`);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to remove member', 'UNKNOWN');
    }
  },

  /**
   * Subscribes to real-time organization changes (no-op for REST)
   */
  subscribeToChanges(callback: (payload: { eventType: string; new?: Organization; old?: Organization }) => void) {
    console.warn('REST API does not support real-time subscriptions. Consider using polling.');
    return () => {};
  },
};

export default RestOrganizationService;
