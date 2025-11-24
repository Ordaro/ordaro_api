import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { UserRole } from 'generated/prisma';
import { Webhook } from 'svix';

import { ConfigService } from '../config';
import { PrismaService } from '../database/prisma.service';
import {
  ClerkEmailType,
  ClerkEmailTemplateData,
} from '../services/email/dto/clerk-email.dto';
import { ORDARO_JOB_TYPES } from '../services/queue/job-types.enum';
import { QueueService } from '../services/queue/queue.service';

import {
  ClerkWebhookEvent,
  ClerkWebhookEventType,
  type ClerkUser,
  type ClerkOrganization,
  type ClerkOrganizationMembership,
  type ClerkOrganizationInvitation,
  type ClerkEmailEvent,
  type ClerkEmailEventData,
} from './dto';

@ApiTags('Webhooks')
@Controller('clerk')
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly queueService: QueueService,
  ) {
    this.webhookSecret =
      this.configService.get<string>('app.clerk.signingSecret') ||
      process.env['CLERK_SIGNING_SECRET'] ||
      '';

    if (!this.webhookSecret) {
      this.logger.warn(
        'CLERK_SIGNING_SECRET not configured. Webhook signature verification will fail.',
      );
    }
  }

  /**
   * Handle Clerk webhook events
   * Verifies Svix signature and processes events
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clerk webhook handler',
    description:
      'Receives and processes webhook events from Clerk. Signature verification required using Svix.',
  })
  @ApiHeader({
    name: 'svix-id',
    description: 'Svix message ID',
    required: false,
  })
  @ApiHeader({
    name: 'svix-timestamp',
    description: 'Svix message timestamp',
    required: false,
  })
  @ApiHeader({
    name: 'svix-signature',
    description: 'Svix message signature for verification',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async handleClerkWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ) {
    // Verify signature using Svix
    const svixId = headers['svix-id'] as string;
    const svixTimestamp = headers['svix-timestamp'] as string;
    const svixSignature = headers['svix-signature'] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      this.logger.warn('Webhook received without required Svix headers', {
        hasId: !!svixId,
        hasTimestamp: !!svixTimestamp,
        hasSignature: !!svixSignature,
      });
      throw new BadRequestException('Missing required Svix headers');
    }

    if (!this.webhookSecret) {
      this.logger.error('CLERK_SIGNING_SECRET not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    // Get raw body for signature verification
    const rawBody =
      req.rawBody?.toString('utf8') ||
      (typeof req.body === 'string' ? req.body : JSON.stringify(body));

    // Verify signature using Svix
    const wh = new Webhook(this.webhookSecret);

    let evt: ClerkWebhookEvent;
    try {
      evt = wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error('Invalid webhook signature', {
        error: errorMessage,
        svixId,
      });
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log('Clerk webhook event received', {
      eventType: evt.type,
      eventId: evt.data?.id || 'unknown',
      object: evt.object,
    });

    try {
      await this.processWebhookEvent(evt);
      return { received: true };
    } catch (error: any) {
      this.logger.error('Failed to process webhook event', {
        eventType: evt.type,
        error: error.message || String(error),
      });
      // Still return 200 to prevent Clerk retries for processing errors
      // Clerk will retry on 4xx/5xx, so we return 200 and log the error
      return { received: true, processed: false, error: error.message };
    }
  }

  /**
   * Process different types of Clerk webhook events
   */
  private async processWebhookEvent(event: ClerkWebhookEvent): Promise<void> {
    switch (event.type) {
      // User events
      case ClerkWebhookEventType.USER_CREATED:
        this.handleUserCreated({
          ...event,
          data: event.data as unknown as ClerkUser,
        });
        break;
      case ClerkWebhookEventType.USER_UPDATED:
        await this.handleUserUpdated({
          ...event,
          data: event.data as unknown as ClerkUser,
        });
        break;
      case ClerkWebhookEventType.USER_DELETED:
        await this.handleUserDeleted({
          ...event,
          data: event.data as unknown as ClerkUser,
        });
        break;

      // Organization events
      case ClerkWebhookEventType.ORGANIZATION_CREATED:
        this.handleOrganizationCreated({
          ...event,
          data: event.data as unknown as ClerkOrganization,
        });
        break;
      case ClerkWebhookEventType.ORGANIZATION_UPDATED:
        await this.handleOrganizationUpdated({
          ...event,
          data: event.data as unknown as ClerkOrganization,
        });
        break;
      case ClerkWebhookEventType.ORGANIZATION_DELETED:
        this.handleOrganizationDeleted({
          ...event,
          data: event.data as unknown as ClerkOrganization,
        });
        break;

      // Organization membership events
      case ClerkWebhookEventType.ORGANIZATION_MEMBERSHIP_CREATED:
        await this.handleMembershipCreated({
          ...event,
          data: event.data as unknown as ClerkOrganizationMembership,
        });
        break;
      case ClerkWebhookEventType.ORGANIZATION_MEMBERSHIP_UPDATED:
        await this.handleMembershipUpdated({
          ...event,
          data: event.data as unknown as ClerkOrganizationMembership,
        });
        break;
      case ClerkWebhookEventType.ORGANIZATION_MEMBERSHIP_DELETED:
        this.handleMembershipDeleted({
          ...event,
          data: event.data as unknown as ClerkOrganizationMembership,
        });
        break;

      // Organization invitation events
      case ClerkWebhookEventType.ORGANIZATION_INVITATION_CREATED:
        await this.handleInvitationCreated({
          ...event,
          data: event.data as unknown as ClerkOrganizationInvitation,
        });
        break;
      case ClerkWebhookEventType.ORGANIZATION_INVITATION_ACCEPTED:
        await this.handleInvitationAccepted({
          ...event,
          data: event.data as unknown as ClerkOrganizationInvitation,
        });
        break;
      case ClerkWebhookEventType.ORGANIZATION_INVITATION_REVOKED:
        await this.handleInvitationRevoked({
          ...event,
          data: event.data as unknown as ClerkOrganizationInvitation,
        });
        break;
      case ClerkWebhookEventType.EMAIL_CREATED:
        await this.handleEmailCreated(event as unknown as ClerkEmailEvent);
        break;

      default:
        this.logger.warn('Unhandled webhook event type', {
          eventType: event.type,
        });
    }
  }

  /**
   * Handle user.created event
   * Syncs user to database immediately when created in Clerk
   * Note: User might not have an organization yet, so we create without org
   * Organization will be assigned when membership is created
   */
  private async handleUserCreated(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkUser;
  }): Promise<void> {
    const user = event.data;
    const primaryEmail = user.email_addresses.find(
      (e) => e.id === user.primary_email_address_id,
    );
    const email = primaryEmail?.email_address || '';

    this.logger.log('User created in Clerk - syncing to database', {
      userId: user.id,
      email,
    });

    try {
      // Check if user already exists
      const existingUser = await this.prismaService.user.findUnique({
        where: { clerkUserId: user.id },
      });

      if (existingUser) {
        this.logger.debug('User already exists in database', {
          userId: user.id,
          dbUserId: existingUser.id,
        });
        return;
      }

      // Get user's name
      const name =
        user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : user.first_name || user.last_name || null;

      // User doesn't have an organization yet when first created
      // They'll be synced to database when:
      // 1. They get an organization membership (via organizationMembership.created webhook) - BEST
      // 2. They log in and JIT provisioning assigns them (fallback)
      // 3. They create an organization (via API)

      // For now, we'll log and let organizationMembership.created or JIT provisioning handle it
      // This is safer because we don't know which organization they belong to yet
      this.logger.log(
        'User created - will be synced when organization membership is created',
        {
          userId: user.id,
          email,
          name,
        },
      );

      // If you want to create users immediately, you would need to:
      // 1. Make organizationId optional in schema, OR
      // 2. Create a default organization for new users, OR
      // 3. Wait for organizationMembership.created event
    } catch (error) {
      this.logger.error('Failed to sync user creation', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle user.updated event
   */
  private async handleUserUpdated(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkUser;
  }): Promise<void> {
    const user = event.data;
    const primaryEmail = user.email_addresses.find(
      (e) => e.id === user.primary_email_address_id,
    );

    this.logger.log('User updated in Clerk', {
      userId: user.id,
      email: primaryEmail?.email_address || 'no email',
    });

    // Update user in database if exists
    try {
      const dbUser = await this.prismaService.user.findUnique({
        where: { clerkUserId: user.id },
      });

      if (dbUser) {
        await this.prismaService.user.update({
          where: { id: dbUser.id },
          data: {
            email: primaryEmail?.email_address || dbUser.email,
            name:
              user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.first_name || user.last_name || dbUser.name,
            profilePicture: user.image_url || dbUser.profilePicture,
          },
        });

        this.logger.log('User synced to database', { userId: user.id });
      }
    } catch (error) {
      this.logger.error('Failed to sync user update', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle user.deleted event
   */
  private async handleUserDeleted(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkUser;
  }): Promise<void> {
    const user = event.data;

    this.logger.log('User deleted in Clerk', { userId: user.id });

    // Mark user as deleted or remove from database
    // Note: We might want to soft delete instead of hard delete
    try {
      const dbUser = await this.prismaService.user.findUnique({
        where: { clerkUserId: user.id },
      });

      if (dbUser) {
        // For now, just log - actual deletion can be handled by admin
        this.logger.warn('User deleted in Clerk but still exists in DB', {
          userId: user.id,
          dbUserId: dbUser.id,
        });
      }
    } catch (error) {
      this.logger.error('Failed to handle user deletion', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle organization.created event
   */
  private handleOrganizationCreated(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganization;
  }) {
    const org = event.data;

    this.logger.log('Organization created in Clerk', {
      orgId: org.id,
      name: org.name,
      slug: org.slug,
    });

    // Organization should already be created via API
    // This webhook is for tracking/logging purposes
    // But we can verify it exists in our DB
    // try {
    //   const dbOrg = await this.prismaService.organization.findUnique({
    //     where: { clerkOrgId: org.id },
    //   });

    //   if (!dbOrg) {
    //     this.logger.warn('Organization created in Clerk but not found in DB', {
    //       orgId: org.id,
    //     });
    //   }
    // } catch (error) {
    //   this.logger.error('Failed to verify organization', {
    //     orgId: org.id,
    //     error: error instanceof Error ? error.message : String(error),
    //   });
    // }
  }

  /**
   * Handle organization.updated event
   */
  private async handleOrganizationUpdated(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganization;
  }): Promise<void> {
    const org = event.data;

    this.logger.log('Organization updated in Clerk', {
      orgId: org.id,
      name: org.name,
    });

    // Update organization in database
    try {
      const dbOrg = await this.prismaService.organization.findUnique({
        where: { clerkOrgId: org.id },
      });

      if (dbOrg) {
        await this.prismaService.organization.update({
          where: { id: dbOrg.id },
          data: {
            name: org.name,
            // slug is managed by our system, don't update from Clerk
          },
        });

        this.logger.log('Organization synced to database', {
          orgId: org.id,
        });
      }
    } catch (error) {
      this.logger.error('Failed to sync organization update', {
        orgId: org.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle organization.deleted event
   */
  private handleOrganizationDeleted(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganization;
  }) {
    const org = event.data;

    this.logger.log('Organization deleted in Clerk', { orgId: org.id });

    // Mark organization as deleted or handle cleanup
    // Note: We might want to soft delete instead of hard delete
    this.logger.warn(
      'Organization deleted in Clerk - manual cleanup may be required',
      {
        orgId: org.id,
      },
    );
  }

  /**
   * Handle organizationMembership.created event
   * This is the BEST place to sync users to database because:
   * 1. User now has an organization (required field)
   * 2. We know their role in the organization
   * 3. We can create user with all required fields
   */
  private async handleMembershipCreated(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganizationMembership;
  }): Promise<void> {
    const membership = event.data;
    const userId = membership.public_user_data.user_id;
    const orgId = membership.organization.id;
    const userEmail = membership.public_user_data.identifier;
    const userName =
      membership.public_user_data.first_name &&
      membership.public_user_data.last_name
        ? `${membership.public_user_data.first_name} ${membership.public_user_data.last_name}`
        : membership.public_user_data.first_name ||
          membership.public_user_data.last_name ||
          null;

    this.logger.log(
      'Organization membership created - syncing user to database',
      {
        membershipId: membership.id,
        userId,
        orgId,
        role: membership.role,
        email: userEmail,
      },
    );

    try {
      const dbOrg = await this.prismaService.organization.findUnique({
        where: { clerkOrgId: orgId },
      });

      if (!dbOrg) {
        this.logger.warn('Organization not found in database', {
          orgId,
          userId,
        });
        return;
      }

      // Map Clerk role to our UserRole enum
      const role = this.mapClerkRoleToUserRole(membership.role);

      // Check if user already exists
      let dbUser = await this.prismaService.user.findUnique({
        where: { clerkUserId: userId },
      });

      if (dbUser) {
        // User exists - update organization and role if needed
        const updates: {
          organizationId?: string;
          role?: UserRole;
          email?: string;
          name?: string | null;
        } = {};

        if (dbUser.organizationId !== dbOrg.id) {
          updates.organizationId = dbOrg.id;
        }
        const parsedRole = role;
        if (dbUser.role !== parsedRole) {
          updates.role = parsedRole;
        }

        if (userEmail && dbUser.email !== userEmail) {
          updates.email = userEmail;
        }

        if (userName && dbUser.name !== userName) {
          updates.name = userName;
        }

        if (Object.keys(updates).length > 0) {
          await this.prismaService.user.update({
            where: { id: dbUser.id },
            data: updates,
          });

          this.logger.log('User updated from membership', {
            userId: dbUser.id,
            updates,
          });
        }
      } else {
        // User doesn't exist - create them
        // This is the BEST time because we have:
        // - Organization (required)
        // - Role (required)
        // - Email (required)
        dbUser = await this.prismaService.user.create({
          data: {
            clerkUserId: userId,
            email: userEmail || `user_${userId}@temp.com`, // Fallback email
            name: userName,
            role,
            organizationId: dbOrg.id,
          },
        });

        this.logger.log('User created from membership', {
          userId: dbUser.id,
          clerkUserId: userId,
          orgId: dbOrg.id,
          role,
        });
      }
    } catch (error) {
      this.logger.error('Failed to sync membership', {
        membershipId: membership.id,
        userId,
        orgId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Map Clerk role to our UserRole enum
   */
  private mapClerkRoleToUserRole(clerkRole: string | null): UserRole {
    if (!clerkRole) {
      return UserRole.OWNER; // Default
    }

    const roleLower = clerkRole.toLowerCase();

    // Map Clerk org roles
    if (roleLower.includes('admin') || roleLower === 'org:admin') {
      return UserRole.OWNER;
    }

    // Map custom roles
    switch (roleLower) {
      case 'owner':
        return UserRole.OWNER;
      case 'manager':
        return UserRole.MANAGER;
      case 'waiter':
        return UserRole.WAITER;
      case 'chef':
        return UserRole.CHEF;
      default:
        this.logger.warn(
          `Unknown Clerk role: ${clerkRole}, defaulting to OWNER`,
        );
        return UserRole.OWNER;
    }
  }

  /**
   * Handle organizationMembership.updated event
   * Updates user role when membership role changes
   */
  private async handleMembershipUpdated(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganizationMembership;
  }): Promise<void> {
    const membership = event.data;
    const userId = membership.public_user_data.user_id;

    this.logger.log('Organization membership updated - syncing role', {
      membershipId: membership.id,
      userId,
      role: membership.role,
    });

    // Update user role in database
    try {
      const dbUser = await this.prismaService.user.findUnique({
        where: {
          clerkUserId: userId,
        },
      });

      if (dbUser) {
        // Map Clerk role to our UserRole enum
        const newRole = this.mapClerkRoleToUserRole(membership.role);
        const parsedRole = newRole;
        if (dbUser.role !== parsedRole) {
          await this.prismaService.user.update({
            where: { id: dbUser.id },
            data: { role: parsedRole },
          });

          this.logger.log('User role updated from membership', {
            userId: dbUser.id,
            oldRole: dbUser.role,
            newRole: parsedRole,
          });
        }
      } else {
        // User doesn't exist - this shouldn't happen if membership.created worked
        // But we can create them here as fallback
        this.logger.warn(
          'User not found when updating membership - creating user',
          {
            userId,
            orgId: membership.organization.id,
          },
        );

        // Try to create user (similar to handleMembershipCreated)
        const dbOrg = await this.prismaService.organization.findUnique({
          where: { clerkOrgId: membership.organization.id },
        });

        if (dbOrg) {
          const userEmail = membership.public_user_data.identifier;
          const userName =
            membership.public_user_data.first_name &&
            membership.public_user_data.last_name
              ? `${membership.public_user_data.first_name} ${membership.public_user_data.last_name}`
              : membership.public_user_data.first_name ||
                membership.public_user_data.last_name ||
                null;

          const role = this.mapClerkRoleToUserRole(membership.role);

          await this.prismaService.user.create({
            data: {
              clerkUserId: userId,
              email: userEmail || `user_${userId}@temp.com`,
              name: userName,
              role,
              organizationId: dbOrg.id,
            },
          });

          this.logger.log('User created from membership update (fallback)', {
            userId,
            orgId: dbOrg.id,
            role,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to sync membership update', {
        membershipId: membership.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle organizationMembership.deleted event
   */
  private handleMembershipDeleted(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganizationMembership;
  }) {
    const membership = event.data;

    this.logger.log('Organization membership deleted', {
      membershipId: membership.id,
    });

    // Handle user removal from organization
    // This might trigger cleanup or user deletion
    this.logger.warn('Membership deleted - manual cleanup may be required', {
      membershipId: membership.id,
    });
  }

  /**
   * Handle organizationInvitation.created event
   */
  private async handleInvitationCreated(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganizationInvitation;
  }): Promise<void> {
    const invitation = event.data;

    this.logger.log('Organization invitation created', {
      invitationId: invitation.id,
      email: invitation.email_address,
      orgId: invitation.organization.id,
      role: invitation.role,
    });

    // Find or create invitation in database
    try {
      const dbOrg = await this.prismaService.organization.findUnique({
        where: { clerkOrgId: invitation.organization.id },
      });

      if (dbOrg) {
        // Check if invitation already exists
        const existingInvitation =
          await this.prismaService.invitation.findFirst({
            where: {
              email: invitation.email_address,
              organizationId: dbOrg.id,
              status: 'PENDING',
            },
          });

        if (!existingInvitation) {
          // Create invitation record
          // Note: We need branchId - this might come from metadata or default branch
          // For now, we'll create without branchId and update later
          await this.prismaService.invitation.create({
            data: {
              clerkInvitationId: invitation.id,
              email: invitation.email_address,
              role: this.mapClerkRoleToUserRole(invitation.role),
              organizationId: dbOrg.id,
              branchId: '', // Will be set when user accepts or via metadata
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
          });

          this.logger.log('Invitation synced to database', {
            invitationId: invitation.id,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to sync invitation', {
        invitationId: invitation.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle organizationInvitation.accepted event
   */
  private async handleInvitationAccepted(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganizationInvitation;
  }): Promise<void> {
    const invitation = event.data;

    this.logger.log('Organization invitation accepted', {
      invitationId: invitation.id,
      email: invitation.email_address,
    });

    // Mark invitation as accepted in database
    try {
      const dbInvitation = await this.prismaService.invitation.findFirst({
        where: {
          clerkInvitationId: invitation.id,
        },
      });

      if (dbInvitation) {
        await this.prismaService.invitation.update({
          where: { id: dbInvitation.id },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
          },
        });

        this.logger.log('Invitation marked as accepted', {
          invitationId: invitation.id,
        });
      }
    } catch (error) {
      this.logger.error('Failed to update invitation status', {
        invitationId: invitation.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle organizationInvitation.revoked event
   */
  private async handleInvitationRevoked(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganizationInvitation;
  }): Promise<void> {
    const invitation = event.data;

    this.logger.log('Organization invitation revoked', {
      invitationId: invitation.id,
      email: invitation.email_address,
    });

    // Mark invitation as revoked in database
    try {
      const dbInvitation = await this.prismaService.invitation.findFirst({
        where: {
          clerkInvitationId: invitation.id,
        },
      });

      if (dbInvitation) {
        await this.prismaService.invitation.update({
          where: { id: dbInvitation.id },
          data: {
            status: 'REVOKED',
          },
        });

        this.logger.log('Invitation marked as revoked', {
          invitationId: invitation.id,
        });
      }
    } catch (error) {
      this.logger.error('Failed to update invitation status', {
        invitationId: invitation.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle email.created event
   */
  private async handleEmailCreated(event: ClerkEmailEvent): Promise<void> {
    const payload: ClerkEmailEventData = event.data;
    const metadata = payload.data || {};
    const httpRequest = event.event_attributes?.http_request;

    const emailType = this.mapClerkEmailType(payload.slug, payload.subject);
    if (emailType === ClerkEmailType.UNKNOWN) {
      this.logger.warn('Clerk email slug not mapped, using fallback template', {
        slug: payload.slug ?? 'undefined',
        subject: payload.subject,
        status: payload.status,
      });
    }

    const templateData: ClerkEmailTemplateData = {
      to: payload.to_email_address,
      subject: payload.subject,
      slug: payload.slug,

      // Required
      rawBody: payload.body,
      rawBodyPlain:
        typeof payload.body_plain === 'string' ? payload.body_plain : undefined,

      // Invitation URL (action_url safely validated)
      invitationUrl:
        typeof metadata['action_url'] === 'string'
          ? metadata['action_url']
          : undefined,

      // inviter_name → requestedBy
      requestedBy:
        typeof metadata['inviter_name'] === 'string'
          ? metadata['inviter_name']
          : undefined,

      // Organization name — ensure string
      organizationName:
        typeof metadata.organization?.name === 'string'
          ? metadata.organization.name
          : typeof metadata['org_name'] === 'string'
            ? metadata['org_name']
            : undefined,

      // App name (name | domain_name)
      appName:
        typeof metadata.app?.name === 'string'
          ? metadata.app.name
          : typeof metadata.app?.domain_name === 'string'
            ? metadata.app.domain_name
            : undefined,

      // App URL
      appUrl:
        typeof metadata.app?.url === 'string' ? metadata.app.url : undefined,

      // App logo
      appLogoUrl:
        typeof metadata.app?.logo_image_url === 'string'
          ? metadata.app.logo_image_url
          : undefined,

      // Network
      clientIp:
        typeof httpRequest?.client_ip === 'string'
          ? httpRequest.client_ip
          : undefined,

      userAgent:
        typeof httpRequest?.user_agent === 'string'
          ? httpRequest.user_agent
          : undefined,

      // Fields required by interface but not supplied in this webhook
      otpCode: undefined,
      verificationUrl: undefined,
      resetUrl: undefined,
      magicLinkUrl: undefined,
    };

    await this.queueService.addJob(
      ORDARO_JOB_TYPES.SEND_CLERK_EMAIL,
      {
        type: emailType,
        templateData,
      },
      { priority: 1 },
    );

    this.logger.log('Clerk email queued for delivery', {
      type: emailType,
      slug: payload.slug,
      to: this.maskEmail(payload.to_email_address),
    });
  }

  private mapClerkEmailType(
    rawSlug: string | null,
    rawSubject: string | undefined,
  ): ClerkEmailType {
    const tokens: string[] = [];

    if (rawSlug) {
      tokens.push(rawSlug);
    }
    if (rawSubject) {
      tokens.push(rawSubject);
    }

    for (const token of tokens) {
      const normalized = token.trim().toLowerCase();
      if (!normalized) {
        continue;
      }

      if (
        normalized.includes('verification') ||
        normalized.includes('verify') ||
        normalized.includes('otp') ||
        normalized.includes('code')
      ) {
        return ClerkEmailType.VERIFICATION_CODE;
      }

      if (normalized.includes('reset') || normalized.includes('password')) {
        return ClerkEmailType.PASSWORD_RESET;
      }

      if (
        normalized.includes('magic') ||
        normalized.includes('signin') ||
        normalized.includes('sign-in') ||
        normalized.includes('link') ||
        normalized.includes('login')
      ) {
        return ClerkEmailType.MAGIC_LINK;
      }

      if (
        normalized.includes('invite') ||
        normalized.includes('invitation') ||
        normalized.includes('member')
      ) {
        return ClerkEmailType.ORGANIZATION_INVITATION;
      }

      if (normalized.includes('welcome')) {
        return ClerkEmailType.WELCOME_EMAIL;
      }
    }

    return ClerkEmailType.UNKNOWN;
  }

  private maskEmail(email: string): string {
    const [localPart = '', domain] = email.split('@');
    if (!domain) {
      return email;
    }
    if (!localPart) {
      return `*@${domain}`;
    }
    const maskedLocal =
      localPart.length <= 2
        ? `${localPart.charAt(0)}*`
        : `${localPart.charAt(0)}***${localPart.charAt(localPart.length - 1)}`;
    return `${maskedLocal}@${domain}`;
  }
}
