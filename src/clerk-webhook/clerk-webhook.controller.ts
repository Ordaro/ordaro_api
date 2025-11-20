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
import { Webhook } from 'svix';

import { UserRole } from '../auth/enums/user-role.enum';
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
@Controller('v1/clerk')
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
        await this.handleOrganizationCreated({
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
   */
  private handleUserCreated(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkUser;
  }) {
    const user = event.data;
    const primaryEmail = user.email_addresses.find(
      (e) => e.id === user.primary_email_address_id,
    );

    this.logger.log('User created in Clerk', {
      userId: user.id,
      email: primaryEmail?.email_address || 'no email',
    });

    // Sync user to database if needed
    // This will be handled by JIT provisioning in the auth strategy
    // But we can log it here for tracking
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
        where: { auth0UserId: user.id }, // TODO: Change to clerkUserId after migration
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
        where: { auth0UserId: user.id }, // TODO: Change to clerkUserId after migration
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
  private async handleOrganizationCreated(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganization;
  }): Promise<void> {
    const org = event.data;

    this.logger.log('Organization created in Clerk', {
      orgId: org.id,
      name: org.name,
      slug: org.slug,
    });

    // Organization should already be created via API
    // This webhook is for tracking/logging purposes
    // But we can verify it exists in our DB
    try {
      const dbOrg = await this.prismaService.organization.findUnique({
        where: { auth0OrgId: org.id }, // TODO: Change to clerkOrgId after migration
      });

      if (!dbOrg) {
        this.logger.warn('Organization created in Clerk but not found in DB', {
          orgId: org.id,
        });
      }
    } catch (error) {
      this.logger.error('Failed to verify organization', {
        orgId: org.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
        where: { auth0OrgId: org.id }, // TODO: Change to clerkOrgId after migration
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
   */
  private async handleMembershipCreated(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganizationMembership;
  }): Promise<void> {
    const membership = event.data;
    const userId = membership.public_user_data.user_id;
    const orgId = membership.organization.id;

    this.logger.log('Organization membership created', {
      membershipId: membership.id,
      userId,
      orgId,
      role: membership.role,
    });

    // Sync membership to database
    // User should already exist (created via JIT or webhook)
    try {
      const dbUser = await this.prismaService.user.findUnique({
        where: { auth0UserId: userId }, // TODO: Change to clerkUserId after migration
      });

      const dbOrg = await this.prismaService.organization.findUnique({
        where: { auth0OrgId: orgId }, // TODO: Change to clerkOrgId after migration
      });

      if (dbUser && dbOrg) {
        // Update user's organization and role if needed
        if (dbUser.organizationId !== dbOrg.id) {
          await this.prismaService.user.update({
            where: { id: dbUser.id },
            data: {
              organizationId: dbOrg.id,
              // Role mapping from Clerk role to our enum
              // This will be handled by role mapping logic
            },
          });

          this.logger.log('User organization updated from membership', {
            userId: dbUser.id,
            orgId: dbOrg.id,
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to sync membership', {
        membershipId: membership.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle organizationMembership.updated event
   */
  private async handleMembershipUpdated(event: {
    object: string;
    type: ClerkWebhookEventType;
    data: ClerkOrganizationMembership;
  }): Promise<void> {
    const membership = event.data;

    this.logger.log('Organization membership updated', {
      membershipId: membership.id,
      role: membership.role,
    });

    // Update user role in database
    try {
      const dbUser = await this.prismaService.user.findUnique({
        where: {
          auth0UserId: membership.public_user_data.user_id, // TODO: Change to clerkUserId after migration
        },
      });

      if (dbUser) {
        // Map Clerk role to our UserRole enum
        // This will be handled by role mapping logic
        this.logger.log('Membership role updated', {
          userId: dbUser.id,
          newRole: membership.role,
        });
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
        where: { auth0OrgId: invitation.organization.id }, // TODO: Change to clerkOrgId after migration
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
              auth0InvitationId: invitation.id, // TODO: Change to clerkInvitationId after migration
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
          auth0InvitationId: invitation.id, // TODO: Change to clerkInvitationId after migration
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
          auth0InvitationId: invitation.id, // TODO: Change to clerkInvitationId after migration
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
   * Map Clerk role to our UserRole enum
   */
  private mapClerkRoleToUserRole(clerkRole: string): UserRole {
    // Map Clerk roles to our enum values
    const roleMap: Record<string, UserRole> = {
      owner: UserRole.OWNER,
      manager: UserRole.MANAGER,
      waiter: UserRole.WAITER,
      chef: UserRole.CHEF,
    };

    return roleMap[clerkRole.toLowerCase()] || UserRole.WAITER;
  }

  /**
   * Handle email.created event
   */
  private async handleEmailCreated(event: ClerkEmailEvent): Promise<void> {
    const payload: ClerkEmailEventData = event.data;
    const metadata = payload.data || {};
    const httpRequest = event.event_attributes?.http_request;

    const emailType = this.mapClerkEmailSlugToType(payload.slug);

    const templateData: ClerkEmailTemplateData = {
      to: payload.to_email_address,
      subject: payload.subject,
      slug: payload.slug,
      rawBody: payload.body,
      ...(payload.body_plain ? { rawBodyPlain: payload.body_plain } : {}),
      ...(metadata.otp_code ? { otpCode: metadata.otp_code } : {}),
      ...(metadata.verification_url
        ? { verificationUrl: metadata.verification_url }
        : {}),
      ...(metadata.reset_password_url
        ? { resetUrl: metadata.reset_password_url }
        : {}),
      ...(metadata.magic_link_url
        ? { magicLinkUrl: metadata.magic_link_url }
        : {}),
      ...(metadata.invitation_url
        ? { invitationUrl: metadata.invitation_url }
        : {}),
      ...(metadata.requested_at ? { requestedAt: metadata.requested_at } : {}),
      ...(metadata.requested_by ? { requestedBy: metadata.requested_by } : {}),
      ...(metadata.organization?.name
        ? { organizationName: metadata.organization.name }
        : metadata['org_name']
          ? { organizationName: metadata['org_name'] as string }
          : {}),
      ...((metadata.app?.name || metadata.app?.domain_name) && {
        appName:
          (metadata.app?.name as string) ||
          (metadata.app?.domain_name as string),
      }),
      ...(metadata.app?.url ? { appUrl: metadata.app.url } : {}),
      ...(metadata.app?.logo_image_url
        ? { appLogoUrl: metadata.app.logo_image_url }
        : {}),
      ...(httpRequest?.client_ip ? { clientIp: httpRequest.client_ip } : {}),
      ...(httpRequest?.user_agent ? { userAgent: httpRequest.user_agent } : {}),
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

  private mapClerkEmailSlugToType(slug: string): ClerkEmailType {
    const normalized = slug.toLowerCase();
    switch (normalized) {
      case 'verification_code':
      case 'email_verification':
      case 'verify_email_code':
        return ClerkEmailType.VERIFICATION_CODE;
      case 'password_reset':
      case 'reset_password':
        return ClerkEmailType.PASSWORD_RESET;
      case 'magic_link':
      case 'email_link':
        return ClerkEmailType.MAGIC_LINK;
      case 'organization_invitation':
      case 'organization_invite':
        return ClerkEmailType.ORGANIZATION_INVITATION;
      case 'welcome_email':
        return ClerkEmailType.WELCOME_EMAIL;
      default:
        return ClerkEmailType.UNKNOWN;
    }
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
