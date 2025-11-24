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

import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';

@ApiTags('Branches')
@ApiBearerAuth('Auth0')
@Controller('branches')
@UseGuards(ClerkGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  /**
   * Create a new branch
   * Only Owners and Managers can create branches
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Create new branch',
    description:
      'Creates a new restaurant branch/location. Owner and Manager roles only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Branch created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  create(
    @Body() createBranchDto: CreateBranchDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.branchesService.create(
      createBranchDto,
      user.organizationId,
      user.clerkUserId,
    );
  }
  @Post('/onboarding/branch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Create new branch',
    description:
      'Creates a new restaurant branch/location. Owner and Manager roles only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Branch created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async addBranchForOnboarding(
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: UserPayload,
    @Query('organizationId') organizationId: string,
  ) {
    return this.branchesService.create(dto, organizationId, user.clerkUserId);
  }

  /**
   * Get all branches accessible to the user
   */
  @Get()
  @ApiOperation({
    summary: 'List all accessible branches',
    description: 'Returns paginated branches accessible to the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of branches',
  })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query() paginationQuery: PaginationQueryDto,
  ) {
    requiresOrganization(user);
    return this.branchesService.findAll(
      user.organizationId,
      user.role,
      user.clerkUserId,
      paginationQuery,
    );
  }

  /**
   * Get branch by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get branch details',
    description: 'Retrieve detailed information about a specific branch',
  })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({
    status: 200,
    description: 'Branch details',
  })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.branchesService.findOne(id, user.organizationId);
  }

  /**
   * Update branch
   * Only Owners and Managers can update branches
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Update branch',
    description: 'Update branch details. Owner and Manager roles only.',
  })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({
    status: 200,
    description: 'Branch updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  update(
    @Param('id') id: string,
    @Body() updateBranchDto: UpdateBranchDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.branchesService.update(
      id,
      updateBranchDto,
      user.organizationId,
    );
  }

  /**
   * Get users assigned to a specific branch
   * Owners and Managers can view all users, others can only view users in their assigned branches
   */
  @Get(':id/users')
  @ApiOperation({
    summary: 'Get users assigned to branch',
    description:
      'Returns all users assigned to a specific branch. Owners and Managers can view all users, others can only view users in their assigned branches.',
  })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({
    status: 200,
    description: 'Users assigned to branch retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        branchId: { type: 'string' },
        branchName: { type: 'string' },
        branchAddress: { type: 'string' },
        users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              clerkUserId: { type: 'string' },
              email: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string' },
              assignedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot view users in this branch',
  })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  getBranchUsers(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.branchesService.getBranchUsers(
      id,
      user.organizationId,
      user.clerkUserId,
      user.role,
    );
  }

  /**
   * Soft delete branch
   * Only Owners can delete branches
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Delete branch (soft delete)',
    description: 'Marks a branch as inactive. Owner role only.',
  })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({
    status: 200,
    description: 'Branch deleted successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  remove(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.branchesService.remove(id, user.organizationId);
  }
}
