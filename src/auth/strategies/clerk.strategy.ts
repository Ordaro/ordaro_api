import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '../enums/user-role.enum';
import { ClerkJwtPayload, UserPayload } from '../interfaces';

@Injectable()
export class ClerkStrategy extends PassportStrategy(Strategy, 'clerk') {
  private readonly logger = new Logger(ClerkStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    const issuer = configService.get<string>('app.clerk.issuer');
    const audience = configService.get<string>('app.clerk.audience');

    // Clerk JWKS endpoint format: https://{instance-id}.clerk.accounts.dev/.well-known/jwks.json
    // Or for custom domains: https://{custom-domain}/.well-known/jwks.json
    const jwksUri = issuer
      ? `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`
      : 'https://eager-jay-75.clerk.accounts.dev/.well-known/jwks.json';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri,
      }),
    });

    this.logger.log('🔧 Clerk Strategy Configuration:', {
      issuer,
      audience,
      jwksUri,
      expectedAudience: audience,
      expectedIssuer: issuer,
      algorithm: 'RS256',
      configService: this.configService.get('app.clerk'),
    });
  }

  async validate(payload: ClerkJwtPayload): Promise<UserPayload> {
    this.logger.log('🔓 Token decoded successfully - Full payload:', {
      payload: JSON.stringify(payload, null, 2),
      hasSub: !!payload.sub,
      sub: payload.sub,
      hasOrgId: !!payload.org_id,
      orgId: payload.org_id,
      hasEmail: !!payload.email,
      email: payload.email,
      hasName: !!payload.name,
      name: payload.name,
      orgRole: payload.org_role,
      orgPermissions: payload.org_permissions,
      // Token timing
      expiresAt: payload.exp
        ? new Date(payload.exp * 1000).toISOString()
        : null,
      issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
      isExpired: payload.exp ? Date.now() > payload.exp * 1000 : false,
      // All other claims
      allClaims: Object.keys(payload),
    });

    if (!payload.sub) {
      this.logger.error(
        '❌ Token validation failed: Missing sub (subject) claim',
      );
      throw new UnauthorizedException('Invalid token payload');
    }

    // Extract custom claims from Clerk
    // Clerk stores custom claims in public_metadata or private_metadata
    // For JWT, they should be added via JWT template
    const branchIds = (payload['branch_ids'] as string[]) || [];
    const customRole = payload['role'] as string | undefined;

    // Map Clerk org_role to UserRole enum
    // Clerk roles: org:admin, org:member, or custom roles
    // Our roles: OWNER, MANAGER, WAITER, CHEF
    const role = this.mapClerkRoleToUserRole(payload.org_role, customRole);

    // Extract email and name
    const email = payload.email || '';
    const name = payload.name || payload.given_name || undefined;
    const orgId = payload.org_id;

    this.logger.debug('✅ Extracted user data from token:', {
      clerkUserId: payload.sub,
      email: email || 'not provided',
      name: name || 'not provided',
      organizationId: orgId || 'not provided (allows org creation)',
      role: role,
      branchIds: branchIds.length > 0 ? branchIds : 'none',
      orgRole: payload.org_role,
    });

    // Allow users without organization (for org creation flow)
    // Sync user to database if organization exists
    if (orgId) {
      await this.syncUserToDatabase(payload.sub, email, orgId, role, branchIds);
    }

    const userPayload: UserPayload = {
      clerkUserId: payload.sub,
      email: email || '',
      ...(name && { name }),
      ...(orgId && { organizationId: orgId }),
      role,
      branchIds,
    };

    this.logger.debug('✅ Returning validated user payload:', userPayload);

    return userPayload;
  }

  private async syncUserToDatabase(
    clerkUserId: string,
    email: string | undefined,
    organizationId: string,
    role: UserRole,
    branchIds: string[],
  ): Promise<void> {
    try {
      this.logger.log('JIT provisioning started', {
        clerkUserId,
        email,
        organizationId,
        role,
        branchIds,
      });

      // Check if organization exists in our database
      const organization = await this.prismaService.organization.findUnique({
        where: { clerkOrgId: organizationId },
      });

      if (!organization) {
        // Organization doesn't exist yet in our DB
        // This is expected during org creation flow
        this.logger.warn(
          `Organization ${organizationId} not found in database`,
        );
        return;
      }

      // Check for pending invitation
      const pendingInvitation = await this.prismaService.invitation.findFirst({
        where: {
          ...(email && { email }),
          organizationId: organization.id,
          status: 'PENDING',
        },
        include: {
          branch: true,
        },
      });

      if (pendingInvitation) {
        this.logger.log('Pending invitation found during login', {
          invitationId: pendingInvitation.id,
          email: pendingInvitation.email,
          role: pendingInvitation.role,
          branchId: pendingInvitation.branchId,
          branchName: pendingInvitation.branch.name,
        });
      }

      // Use invitation role if exists, otherwise use role from JWT
      const finalRole = pendingInvitation?.role || role;

      // Upsert user
      const user = await this.prismaService.user.upsert({
        where: { clerkUserId },
        create: {
          clerkUserId,
          email: email || '',
          role: finalRole,
          organizationId: organization.id,
        },
        update: {
          ...(email && { email }),
          role: finalRole,
        },
      });

      // Auto-assign branches from JWT or invitation
      if (pendingInvitation) {
        // Assign branch from invitation
        await this.prismaService.userBranch.upsert({
          where: {
            userId_branchId: {
              userId: user.id,
              branchId: pendingInvitation.branchId,
            },
          },
          create: {
            userId: user.id,
            branchId: pendingInvitation.branchId,
          },
          update: {},
        });
      } else if (branchIds.length > 0) {
        // Assign branches from JWT claims
        const branches = await this.prismaService.branch.findMany({
          where: {
            id: { in: branchIds },
            organizationId: organization.id,
          },
        });

        for (const branch of branches) {
          await this.prismaService.userBranch.upsert({
            where: {
              userId_branchId: {
                userId: user.id,
                branchId: branch.id,
              },
            },
            create: {
              userId: user.id,
              branchId: branch.id,
            },
            update: {},
          });
        }
      }

      // Mark invitation as accepted if exists
      if (pendingInvitation) {
        await this.prismaService.invitation.update({
          where: { id: pendingInvitation.id },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
          },
        });

        this.logger.log('JIT provisioning completed with invitation', {
          userId: user.id,
          role: finalRole,
          branchAssigned: true,
          branchName: pendingInvitation.branch.name,
          invitationId: pendingInvitation.id,
        });
      } else {
        const assignedBranchCount =
          branchIds.length > 0
            ? (
                await this.prismaService.branch.findMany({
                  where: {
                    id: { in: branchIds },
                    organizationId: organization.id,
                  },
                })
              ).length
            : 0;
        this.logger.log('JIT provisioning completed without invitation', {
          userId: user.id,
          role: finalRole,
          branchAssigned: assignedBranchCount > 0,
        });
      }
    } catch (error) {
      // Log error but don't fail authentication
      this.logger.error('Failed to sync user to database', {
        clerkUserId,
        email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private mapClerkRoleToUserRole(
    orgRole: string | undefined,
    customRole: string | undefined,
  ): UserRole {
    // Priority: custom role > org role
    const roleString = (customRole || orgRole || '').toLowerCase();

    // Map Clerk org roles
    if (roleString.includes('admin') || roleString === 'org:admin') {
      return UserRole.OWNER;
    }

    // Map custom roles
    switch (roleString) {
      case 'owner':
        return UserRole.OWNER;
      case 'manager':
        return UserRole.MANAGER;
      case 'waiter':
        return UserRole.WAITER;
      case 'chef':
        return UserRole.CHEF;
      default:
        this.logger.warn(`Unknown role: ${roleString}, defaulting to OWNER`);
        return UserRole.OWNER;
    }
  }
}
