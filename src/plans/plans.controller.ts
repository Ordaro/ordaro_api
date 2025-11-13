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
  HttpCode,
  HttpStatus,
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
import { PaginationQueryDto } from '../common/dto/pagination.dto';

import { CreatePlanDto, UpdatePlanDto, PlanResponseDto } from './dto';
import { PlansService } from './plans.service';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  /**
   * Create a new subscription plan
   * Platform Admin only (Owner role with internal access)
   */
  @Post()
  @UseGuards(Auth0Guard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth('Auth0')
  @ApiOperation({
    summary: 'Create subscription plan',
    description:
      'Creates a new subscription plan in Paystack and database. Platform Admin only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Plan created successfully',
    type: PlanResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  @ApiResponse({
    status: 409,
    description: 'Plan with this name already exists',
  })
  async create(
    @Body() createPlanDto: CreatePlanDto,
    @CurrentUser() _user: UserPayload,
  ): Promise<PlanResponseDto> {
    return this.plansService.create(createPlanDto);
  }

  /**
   * List all active subscription plans
   * Public endpoint - no authentication required
   */
  @Get()
  @ApiOperation({
    summary: 'List subscription plans',
    description:
      'Returns all active subscription plans available for subscription.',
  })
  @ApiResponse({
    status: 200,
    description: 'Plans retrieved successfully',
    type: [PlanResponseDto],
  })
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PlanResponseDto[]> {
    return this.plansService.findAll(query);
  }

  /**
   * Get plan details
   * Public endpoint - no authentication required
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get plan details',
    description: 'Returns details of a specific subscription plan.',
  })
  @ApiParam({
    name: 'id',
    description: 'Plan ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Plan retrieved successfully',
    type: PlanResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async findOne(@Param('id') id: string): Promise<PlanResponseDto> {
    return this.plansService.findOne(id);
  }

  /**
   * Update subscription plan
   * Platform Admin only (Owner role with internal access)
   */
  @Patch(':id')
  @UseGuards(Auth0Guard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth('Auth0')
  @ApiOperation({
    summary: 'Update subscription plan',
    description: 'Updates an existing subscription plan. Platform Admin only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Plan ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Plan updated successfully',
    type: PlanResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async update(
    @Param('id') id: string,
    @Body() updatePlanDto: UpdatePlanDto,
    @CurrentUser() _user: UserPayload,
  ): Promise<PlanResponseDto> {
    return this.plansService.update(id, updatePlanDto);
  }

  /**
   * Deactivate subscription plan
   * Platform Admin only (Owner role with internal access)
   */
  @Delete(':id')
  @UseGuards(Auth0Guard, RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiBearerAuth('Auth0')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate subscription plan',
    description:
      'Deactivates a subscription plan (soft delete). Cannot deactivate plans with active subscriptions. Platform Admin only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Plan ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Plan deactivated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiResponse({ status: 409, description: 'Plan has active subscriptions' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() _user: UserPayload,
  ): Promise<void> {
    return this.plansService.remove(id);
  }
}
