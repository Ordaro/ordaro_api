import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { CurrentUser, Roles, requiresOrganization } from '../auth/decorators';
import { UserRole } from '../auth/enums/user-role.enum';
import { ClerkGuard, RolesGuard } from '../auth/guards';
import type { UserPayload } from '../auth/interfaces';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

import { InviteUserDto, AssignBranchesDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('Auth0')
@Controller('users')
@UseGuards(ClerkGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Invite a user to join the organization and assign to a branch
   * Owners can invite anyone, Managers can invite Waiters and Chefs only
   */
  @Post('invitations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Invite user to organization',
    description:
      'Send Auth0 invitation to join organization and assign to a branch. Owners can invite any role, Managers can only invite Waiters and Chefs.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation sent successfully',
    schema: {
      example: {
        success: true,
        invitationId: 'inv_xxxxx',
        invitationUrl: 'https://auth.chainpos.live/...',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  inviteUser(
    @Body() inviteUserDto: InviteUserDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.usersService.inviteUser(
      inviteUserDto,
      user.organizationId,
      user.name || user.email,
      user.role,
    );
  }

  /**
   * Get all members of the organization
   */
  @Get()
  @ApiOperation({
    summary: 'List organization members',
    description: 'Returns paginated list of organization members',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of members',
    schema: {
      example: {
        data: [{ id: '...', email: '...', role: 'WAITER' }],
        pageInfo: {
          hasNextPage: true,
          hasPreviousPage: false,
          startCursor: 'eyJpZCI6IjEyMyJ9',
          endCursor: 'eyJpZCI6IjQ1NiJ9',
        },
      },
    },
  })
  getOrganizationMembers(
    @CurrentUser() user: UserPayload,
    @Query() paginationQuery: PaginationQueryDto,
  ) {
    requiresOrganization(user);
    return this.usersService.getOrganizationMembers(
      user.organizationId,
      paginationQuery,
    );
  }

  /**
   * Update user's branch assignments
   * Owners and Managers can update branch assignments
   */
  @Patch(':userId/branches')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Update user branch assignments',
    description:
      'Assign or reassign a user to branches. Owner and Manager roles only.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID (Prisma ID, not Auth0 ID)',
  })
  @ApiResponse({
    status: 200,
    description: 'Branch assignments updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateUserBranches(
    @Param('userId') userId: string,
    @Body() assignBranchesDto: AssignBranchesDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.usersService.updateUserBranches(
      userId,
      assignBranchesDto,
      user.organizationId,
      user.role,
    );
  }

  /**
   * Get user's branch assignments by database ID
   * Users can view their own assignments, Owners/Managers can view any user's assignments
   */
  @Get(':userId/branches')
  @ApiOperation({
    summary: 'Get user branch assignments',
    description:
      'Returns all branches assigned to a specific user. Users can view their own assignments, Owners/Managers can view any user.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User UUID (Prisma database ID)',
  })
  @ApiResponse({
    status: 200,
    description: 'User branch assignments retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        userEmail: { type: 'string' },
        userName: { type: 'string' },
        userRole: { type: 'string' },
        branches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              address: { type: 'string' },
              phone: { type: 'string' },
              isActive: { type: 'boolean' },
              assignedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot view other users assignments',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserBranches(
    @Param('userId') userId: string,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.usersService.getUserBranches(
      userId,
      user.organizationId,
      user.clerkUserId,
      user.role,
    );
  }

  /**
   * Get current user's branch assignments
   * Returns branches assigned to the authenticated user
   */
  @Get('me/branches')
  @ApiOperation({
    summary: 'Get current user branch assignments',
    description:
      'Returns all branches assigned to the currently authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user branch assignments retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        userEmail: { type: 'string' },
        userName: { type: 'string' },
        userRole: { type: 'string' },
        branches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              address: { type: 'string' },
              phone: { type: 'string' },
              isActive: { type: 'boolean' },
              assignedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  getCurrentUserBranches(@CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.usersService.getCurrentUserBranches(
      user.clerkUserId,
      user.organizationId,
    );
  }

  /**
   * Get user's branch assignments by Clerk ID
   * Owners and Managers can view any user's assignments using Clerk ID
   */
  @Get('clerk/:clerkUserId/branches')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get user branch assignments by Clerk ID',
    description:
      'Returns all branches assigned to a user identified by Clerk ID. Owner and Manager roles only.',
  })
  @ApiParam({
    name: 'clerkUserId',
    description: 'Clerk User ID (sub claim from JWT)',
  })
  @ApiResponse({
    status: 200,
    description: 'User branch assignments retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Owner/Manager role required',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserBranchesByClerkId(
    @Param('clerkUserId') clerkUserId: string,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.usersService.getUserBranchesByClerkId(
      clerkUserId,
      user.organizationId,
    );
  }

  /**
   * Get pending invitations for the organization
   * Owners and Managers can view pending invitations
   */
  @Get('invitations/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get pending invitations',
    description:
      'Get all pending invitations for the current organization. Owner and Manager roles only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated pending invitations',
    schema: {
      example: {
        data: [
          {
            id: 'invitation-uuid',
            email: 'user@example.com',
            role: 'WAITER',
            branchName: 'Downtown Branch',
            branchId: 'branch-uuid',
            createdAt: '2024-01-15T10:30:00Z',
            expiresAt: '2024-01-22T10:30:00Z',
            status: 'PENDING',
          },
        ],
        pageInfo: {
          hasNextPage: true,
          hasPreviousPage: false,
          startCursor: 'eyJpZCI6IjEyMyJ9',
          endCursor: 'eyJpZCI6IjQ1NiJ9',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Owner/Manager role required',
  })
  getPendingInvitations(
    @CurrentUser() user: UserPayload,
    @Query() paginationQuery: PaginationQueryDto,
  ) {
    requiresOrganization(user);
    return this.usersService.getPendingInvitations(
      user.organizationId,
      paginationQuery,
    );
  }

  /**
   * Remove a user from the organization
   * Only Owners can remove users
   */
  @Delete(':userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Remove user from organization',
    description:
      'Removes a user from both Auth0 organization and local database. Owner role only.',
  })
  @ApiParam({ name: 'userId', description: 'User UUID (Prisma ID)' })
  @ApiResponse({
    status: 200,
    description: 'User removed successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  removeUser(
    @Param('userId') userId: string,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.usersService.removeUser(
      userId,
      user.organizationId,
      user.role,
      user.clerkUserId,
    );
  }
}
