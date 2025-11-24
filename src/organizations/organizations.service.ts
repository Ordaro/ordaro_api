import {
  Injectable,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import slugify from '@sindresorhus/slugify';

import { UserRole } from '../auth/enums/user-role.enum';
import { ClerkManagementService } from '../auth/services/clerk-management.service';
import { extractErrorInfo } from '../common/utils/error.util';
import { PrismaService } from '../database/prisma.service';

import { CreateOrganizationDto, UpdateOrganizationDto } from './dto';
@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly clerkManagementService: ClerkManagementService,
  ) {}

  /**
   * Create a new organization (in both Clerk and our DB) and assign the creator as Owner.
   * Ensures slug uniqueness and handles error scenarios.
   */
  async create(
    dto: CreateOrganizationDto,
    userId: string,
    userEmail: string,
    userName?: string,
  ) {
    const { name, logoUrl, address, phone } = dto;

    const slug = slugify(name);

    // Check DB slug uniqueness first
    const existing = await this.prismaService.organization.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException(
        `Organization with name "${name}" (slug: ${slug}) already exists.`,
      );
    }

    let clerkOrgId: string;

    try {
      // 1. Create in Clerk
      clerkOrgId = await this.clerkManagementService.createOrganization(
        name,
        userId,
      );

      // 2. Add user as member with Owner role
      // const ownerRole = this.clerkManagementService.mapUserRoleToClerkRole(
      //   UserRole.OWNER,
      // );
      // await this.clerkManagementService.addMemberToOrganization(
      //   clerkOrgId,
      //   userId,
      //   ownerRole,
      // );
    } catch (err) {
      // If Clerk operation fails, you might consider cleaning up (delete org) or logging for later cleanup
      this.logger.error('Clerk operation failed during organization creation', {
        dto,
        userId,
        error: err,
      });
      // Wrap in a safe exception
      throw new InternalServerErrorException(
        `Failed to provision organization with external identity provider.`,
      );
    }

    // Now write to your DB
    try {
      // Create the organization FIRST (user requires organizationId foreign key)
      const organization = await this.prismaService.organization.create({
        data: {
          clerkOrgId,
          name,
          slug,
          ...(logoUrl && { logoUrl }),
          ...(address && { address }),
          ...(phone && { phone }),
        },
        include: { users: true },
      });

      // Then upsert the user with the organization ID
      // This handles both new users and existing users (who might have logged in before org creation)
      await this.prismaService.user.upsert({
        where: { clerkUserId: userId },
        create: {
          clerkUserId: userId,
          email: userEmail,
          ...(userName && { name: userName }),
          role: UserRole.OWNER,
          organizationId: organization.id, // Now we have a valid organization ID
        },
        update: {
          ...(userEmail && { email: userEmail }),
          ...(userName && { name: userName }),
          role: UserRole.OWNER,
          organizationId: organization.id, // Update existing user's organization
        },
      });

      this.logger.log(
        `Organization ${organization.id} created for user ${userId}`,
        {
          orgId: organization.id,
          clerkOrgId,
          userId,
        },
      );
      const authParams = new URLSearchParams({
        returnTo: '/',
        ...(organization.clerkOrgId
          ? { organization: organization.clerkOrgId }
          : {}),
      });

      const redirectUrl = `/auth/login?${authParams.toString()}`;
      return {
        organization,
        redirectUrl,
      };
    } catch (dbError) {
      this.logger.error('Database errr when saving organization', {
        dto,
        userId,
        clerkOrgId,
        error: dbError,
      });
      // Optionally: try to rollback Clerk creation if possible
      throw new InternalServerErrorException(
        `Failed to save organization in database.`,
      );
    }
  }

  async findOrgs(uid: string): Promise<
    Array<{
      id: string;
      name: string;
      display_name: string;
      redirectUrl: string;
    }>
  > {
    try {
      this.logger.log(`Fetching organizations for user: ${uid}`);

      const orgs = await this.clerkManagementService.getUserOrganizations(uid);

      // Add redirect URL for each organization
      const orgsWithRedirects = orgs.map((org) => {
        const authParams = new URLSearchParams({
          organization: org.id,
          returnTo: '/',
        });

        const redirectUrl = `/auth/login?${authParams.toString()}`;

        return {
          id: org.id,
          name: org.name,
          display_name: org.name,
          redirectUrl,
        };
      });

      this.logger.log(
        `Found ${orgsWithRedirects.length} organizations for user: ${uid}`,
      );
      return orgsWithRedirects;
    } catch (error) {
      this.logger.error('Failed to get user organizations', {
        userId: uid,
        error: extractErrorInfo(error).message,
      });
      throw new InternalServerErrorException(
        'Failed to retrieve user organizations. Please try again later.',
      );
    }
  }
  /**
   * Fetch organization by our local ID, including branches count and active branches.
   */
  async findOne(id: string) {
    const org = await this.prismaService.organization.findUnique({
      where: { id },
      include: {
        branches: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            users: true,
            branches: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization with id ${id} not found`);
    }
    return org;
  }

  /**
   * Update organization fields (name, logoUrl, address, phone). If name changes, slug and uniqueness are handled.
   */
  async update(id: string, dto: UpdateOrganizationDto) {
    const org = await this.prismaService.organization.findUnique({
      where: { id },
    });
    if (!org) {
      throw new NotFoundException(`Organization with id ${id} not found`);
    }

    let newSlug: string | undefined = undefined;
    if (dto.name && dto.name !== org.name) {
      newSlug = slugify(dto.name);

      // Check slug conflict excluding this org
      const conflict = await this.prismaService.organization.findFirst({
        where: {
          slug: newSlug,
          id: { not: id },
        },
      });
      if (conflict) {
        throw new ConflictException(
          `Another organization with name "${dto.name}" already exists.`,
        );
      }
    }

    try {
      const updated = await this.prismaService.organization.update({
        where: { id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-misused-spread
          ...dto,
          ...(newSlug && { slug: newSlug }),
        },
      });
      this.logger.log(`Organization ${id} updated`, { changes: dto });
      return updated;
    } catch (err) {
      this.logger.error('Error updating organization in DB', {
        id,
        dto,
        error: err,
      });
      throw new InternalServerErrorException(`Failed to update organization.`);
    }
  }

  /**
   * Find by Clerk organization ID (your local DB mapping)
   */
  async findByClerkOrgId(clerkOrgId: string) {
    // Optionally throw if not found
    const org = await this.prismaService.organization.findUnique({
      where: { clerkOrgId },
    });
    if (!org) {
      throw new NotFoundException(
        `Local organization mapping for Clerk ID ${clerkOrgId} not found`,
      );
    }
    return org;
  }
}
