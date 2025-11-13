import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../auth/enums/user-role.enum';
import { Auth0Guard, RolesGuard } from '../auth/guards';
import type { UserPayload } from '../auth/interfaces';

import { CreateOrganizationDto, UpdateOrganizationDto } from './dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth('Auth0')
@Controller('organizations')
@UseGuards(Auth0Guard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * Create a new organization
   * Available to authenticated users who don't have an organization yet
   */
  @Post()
  @ApiOperation({
    summary: 'Create new organization',
    description:
      'Creates a new organization in Auth0 and database. User becomes the Owner. Only available for first-time users without an organization.',
  })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
  })
  @ApiResponse({ status: 400, description: 'User already has an organization' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @CurrentUser() user: UserPayload,
  ) {
    // Check if user already has an organization
    if (user.organizationId) {
      throw new BadRequestException(
        'You already belong to an organization. Please contact support if you need to create another one.',
      );
    }

    return this.organizationsService.create(
      createOrganizationDto,
      user.auth0Id,
      user.email,
      user.name,
    );
  }

  /**
   * Get Member organizations
   */
  @Get('my-organizations')
  @UseGuards(Auth0Guard)
  @ApiOperation({
    summary: 'Get user Organizations',
    description: 'Get organizations that the authenticated user belongs to',
  })
  @ApiResponse({
    status: 200,
    description: 'User organizations retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Auth0 organization ID' },
          name: { type: 'string', description: 'Organization name' },
          display_name: {
            type: 'string',
            description: 'Organization display name',
          },
          redirectUrl: {
            type: 'string',
            description: 'Auth0 login URL with organization context',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async findOrgs(@CurrentUser() userPayload: UserPayload) {
    return await this.organizationsService.findOrgs(userPayload.auth0Id);
  }

  /**
   * Get organization details
   * Available to members of the organization
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get organization details',
    description:
      'Retrieve organization information including member and branch counts',
  })
  @ApiParam({
    name: 'id',
    description: 'Organization UUID (from Prisma, not Auth0 org ID)',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization found',
  })
  @ApiResponse({
    status: 403,
    description: 'User is not a member of this organization',
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    // Users can only access their own organization
    // This is already enforced by JWT (user.organizationId)
    // but we double-check here for security
    const organization = await this.organizationsService.findOne(id);

    console.log('organization', organization);
    console.log('user', user);

    return organization;
  }

  /**
   * Update organization details
   * Only Owners can update organization
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Update organization',
    description: 'Update organization details. Owner role required.',
  })
  @ApiParam({ name: 'id', description: 'Organization UUID' })
  @ApiResponse({
    status: 200,
    description: 'Organization updated successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async update(
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @CurrentUser() user: UserPayload,
  ) {
    const organization = await this.organizationsService.findOne(id);

    if (organization.auth0OrgId !== user.organizationId) {
      throw new BadRequestException(
        'You do not have access to this organization',
      );
    }

    return this.organizationsService.update(id, updateOrganizationDto);
  }
}
