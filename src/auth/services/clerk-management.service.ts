import { createClerkClient } from '@clerk/backend';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UserRole } from '../enums/user-role.enum';

@Injectable()
export class ClerkManagementService {
  private readonly clerkClient;
  private readonly logger = new Logger(ClerkManagementService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('app.clerk.secretKey');

    if (!secretKey) {
      throw new Error('CLERK_SECRET_KEY is required');
    }

    this.clerkClient = createClerkClient({ secretKey });
  }

  /**
   * Create a Clerk organization
   */
  async createOrganization(name: string, createdBy: string): Promise<string> {
    try {
      const organization =
        await this.clerkClient.organizations.createOrganization({
          name,
          createdBy,
        });

      if (!organization.id) {
        throw new Error('Organization creation failed: no ID returned');
      }

      this.logger.log(`Created organization: ${organization.id}`);
      return organization.id;
    } catch (error) {
      this.logger.error('Failed to create organization', error);
      throw error;
    }
  }

  /**
   * Add user as member to organization
   */
  // async addMemberToOrganization(
  //   orgId: string,
  //   userId: string,
  //   role: string = 'org:member',
  // ): Promise<void> {
  //   try {
  //     await this.clerkClient.organizations.createOrganizationMembership({
  //       organizationId: orgId,
  //       userId,
  //       role,
  //     });

  //     this.logger.log(`Added user ${userId} to organization ${orgId}`);
  //   } catch (error) {
  //     this.logger.error('Failed to add member to organization', error);
  //     throw error;
  //   }
  // }

  /**
   * Assign role to user within organization
   */
  async assignRoleToUser(
    orgId: string,
    userId: string,
    role: string,
  ): Promise<void> {
    try {
      await this.clerkClient.organizations.updateOrganizationMembership({
        organizationId: orgId,
        userId,
        role,
      });

      this.logger.log(
        `Assigned role ${role} to user ${userId} in org ${orgId}`,
      );
    } catch (error) {
      this.logger.error('Failed to assign role to user', error);
      throw error;
    }
  }

  /**
   * Create invitation to join organization
   */
  async createInvitation(
    orgId: string,
    inviteeEmail: string,
    role: string = 'org:member',
    publicMetadata?: Record<string, unknown>,
  ): Promise<{ id: string; url: string }> {
    try {
      const invitation =
        await this.clerkClient.organizations.createOrganizationInvitation({
          organizationId: orgId,
          emailAddress: inviteeEmail,
          role,
          ...(publicMetadata && { publicMetadata }),
        });

      this.logger.log(`Created invitation for ${inviteeEmail} to org ${orgId}`);

      if (!invitation.id || !invitation.url) {
        throw new Error('Invitation creation failed: missing required fields');
      }

      return {
        id: invitation.id,
        url: invitation.url,
      };
    } catch (error) {
      this.logger.error('Failed to create invitation', error);
      throw error;
    }
  }

  /**
   * Revoke organization invitation
   */
  async revokeInvitation(orgId: string, invitationId: string): Promise<void> {
    try {
      await this.clerkClient.organizations.revokeOrganizationInvitation({
        organizationId: orgId,
        invitationId,
      });

      this.logger.log(`Revoked invitation ${invitationId} for org ${orgId}`);
    } catch (error) {
      this.logger.error('Failed to revoke invitation', error);
      throw error;
    }
  }

  /**
   * Remove user from organization
   */
  async removeMemberFromOrganization(
    orgId: string,
    userId: string,
  ): Promise<void> {
    try {
      await this.clerkClient.organizations.deleteOrganizationMembership({
        organizationId: orgId,
        userId,
      });

      this.logger.log(`Removed user ${userId} from organization ${orgId}`);
    } catch (error) {
      this.logger.error('Failed to remove member from organization', error);
      throw error;
    }
  }

  /**
   * Update user role in organization
   */
  async updateUserRole(
    orgId: string,
    userId: string,
    newRole: string,
  ): Promise<void> {
    try {
      await this.clerkClient.organizations.updateOrganizationMembership({
        organizationId: orgId,
        userId,
        role: newRole,
      });

      this.logger.log(
        `Updated role for user ${userId} in org ${orgId} to ${newRole}`,
      );
    } catch (error) {
      this.logger.error('Failed to update user role', error);
      throw error;
    }
  }

  /**
   * Get user's organizations
   */
  async getUserOrganizations(
    userId: string,
  ): Promise<Array<{ id: string; name: string; slug: string }>> {
    try {
      const organizations =
        await this.clerkClient.users.getOrganizationMembershipList({
          userId,
        });

      return organizations.data.map((org) => ({
        id: org.organization.id,
        name: org.organization.name,
        slug: org.organization.slug || '',
      }));
    } catch (error) {
      this.logger.error('Failed to get user organizations', error);
      throw error;
    }
  }

  /**
   * Get organization members
   */
  async getOrganizationMembers(orgId: string): Promise<
    Array<{
      userId: string;
      email: string;
      firstName?: string;
      lastName?: string;
      imageUrl?: string;
      role: string;
    }>
  > {
    try {
      const members =
        await this.clerkClient.organizations.getOrganizationMembershipList({
          organizationId: orgId,
        });

      return members.data.map((member) => {
        const publicUserData = member.publicUserData;
        return {
          userId: publicUserData?.userId || '',
          email: publicUserData?.identifier || '',
          ...(publicUserData?.firstName && {
            firstName: publicUserData.firstName,
          }),
          ...(publicUserData?.lastName && {
            lastName: publicUserData.lastName,
          }),
          ...(publicUserData?.imageUrl && {
            imageUrl: publicUserData.imageUrl,
          }),
          role: member.role || 'org:member',
        };
      });
    } catch (error) {
      this.logger.error('Failed to get organization members', error);
      throw error;
    }
  }

  /**
   * Get user's role in organization
   */
  async getUserRoleInOrganization(
    orgId: string,
    userId: string,
  ): Promise<string | null> {
    try {
      const membership =
        await this.clerkClient.organizations.getOrganizationMembershipList({
          organizationId: orgId,
        });

      const userMembership = membership.data.find(
        (m) => m.publicUserData?.userId === userId,
      );

      return userMembership?.role || null;
    } catch (error) {
      this.logger.error('Failed to get user role', error);
      throw error;
    }
  }

  /**
   * Update user's public metadata (e.g., branch_ids)
   */
  async updateUserMetadata(
    userId: string,
    publicMetadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.clerkClient.users.updateUser(userId, {
        publicMetadata,
      });

      this.logger.log(`Updated public metadata for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to update user metadata', error);
      throw error;
    }
  }

  /**
   * Map UserRole enum to Clerk role string
   */
  mapUserRoleToClerkRole(role: UserRole): string {
    switch (role) {
      case UserRole.OWNER:
        return 'org:owner';
      case UserRole.MANAGER:
        return 'org:manager'; // Manager has admin privileges
      case UserRole.WAITER:
        return 'org:waiter';
      case UserRole.CHEF:
        return 'org:chef';
      default:
        return 'org:owner';
    }
  }
}
