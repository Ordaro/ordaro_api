import {
  Controller,
  Get,
  Param,
  UseGuards,
  UnauthorizedException,
  Headers,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';

import { PrismaService } from '../database/prisma.service';

import { CurrentUser } from './decorators';
import { ClerkGuard } from './guards';
import type { UserPayload } from './interfaces';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get current authenticated user profile with branches
   */
  @Get('me')
  @UseGuards(ClerkGuard)
  @ApiBearerAuth('Auth0')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the authenticated user profile including organization, role, and assigned branches',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      example: {
        clerkUserId: 'user_2abc123xyz',
        email: 'user@example.com',
        name: 'John Doe',
        organizationId: 'org_xxxxx',
        role: 'OWNER',
        branchIds: ['branch-uuid-1', 'branch-uuid-2'],
        branches: [
          {
            id: 'branch-uuid-1',
            name: 'Downtown Branch',
            address: '123 Main St',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async getCurrentUser(@CurrentUser() user: UserPayload) {
    this.logger.debug('User payload from JWT:', {
      clerkUserId: user.clerkUserId,
      role: user.role,
      organizationId: user.organizationId,
    });

    if (!user.role) {
      this.logger.warn('User has no role assigned', {
        userId: user.clerkUserId,
      });
    }

    // Fetch user from database with branches
    const dbUser = await this.prismaService.user.findUnique({
      where: { clerkUserId: user.clerkUserId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        branches: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                address: true,
                phone: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!dbUser) {
      this.logger.warn('User not found in database during /me call', {
        userId: user.clerkUserId,
        email: user.email,
      });

      return {
        clerkUserId: user.clerkUserId,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        branchIds: user.branchIds,
        branches: [],
      };
    }

    return {
      id: dbUser.id,
      clerkUserId: dbUser.clerkUserId,
      email: dbUser.email,
      name: dbUser.name,
      phone: dbUser.phone,
      profilePicture: dbUser.profilePicture,
      role: dbUser.role,
      organization: dbUser.organization,
      branches: dbUser.branches.map((ub) => ub.branch),
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    };
  }

  /**
   * Internal endpoint: Get user's branch IDs for Auth0 Action callback
   * This endpoint is called by Auth0 Actions during login to add branch_ids to JWT
   * Secured with API_INTERNAL_TOKEN
   */
  @Get('users/:userId/branches')
  @ApiOperation({
    summary: '[Internal] Get user branch assignments',
    description:
      'Used by Auth0 Actions to fetch branch IDs for JWT claims. Secured with API_INTERNAL_TOKEN.',
  })
  @ApiParam({
    name: 'userId',
    description: 'Auth0 User ID',
    example: 'auth0|123456',
  })
  @ApiHeader({
    name: 'authorization',
    description: 'Bearer token with API_INTERNAL_TOKEN',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Branch IDs retrieved',
    schema: {
      example: {
        branchIds: ['branch-uuid-1', 'branch-uuid-2'],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid internal token',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserBranches(
    @Param('userId') userId: string,
    @Headers('authorization') authHeader: string,
  ) {
    // Verify internal token
    const internalToken = this.configService.get<string>(
      'app.apiInternalToken',
    );
    const token = authHeader?.replace('Bearer ', '');

    if (!token || token !== internalToken) {
      throw new UnauthorizedException('Invalid internal token');
    }

    // Get user's branch assignments
    const userBranches = await this.prismaService.userBranch.findMany({
      where: {
        user: {
          clerkUserId: userId,
        },
      },
      select: {
        branchId: true,
      },
    });

    return {
      branchIds: userBranches.map((ub) => ub.branchId),
    };
  }
}
