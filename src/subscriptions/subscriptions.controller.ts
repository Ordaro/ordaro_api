import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { Inject, forwardRef } from '@nestjs/common';

import { CurrentUser, Roles } from '../auth/decorators';
import { requiresOrganization } from '../auth/decorators/requires-organization.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { Auth0Guard, RolesGuard } from '../auth/guards';
import type { UserPayload } from '../auth/interfaces';

import {
  InitializeTransactionDto,
  CreateSubscriptionDto,
  SubscriptionResponseDto,
} from './dto';
import { SubscriptionsService } from './subscriptions.service';
import { PlansService } from '../plans/plans.service';

@ApiTags('Subscriptions')
@ApiBearerAuth('Auth0')
@Controller('subscriptions')
@UseGuards(Auth0Guard)
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @Inject(forwardRef(() => PlansService))
    private readonly plansService: PlansService,
  ) {}

  /**
   * Initialize transaction for card authorization
   */
  @Post('initialize')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Initialize payment transaction',
    description:
      'Initializes a Paystack transaction for card authorization. Returns authorization URL for user to complete payment.',
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction initialized successfully',
    schema: {
      type: 'object',
      properties: {
        authorizationUrl: {
          type: 'string',
          example: 'https://checkout.paystack.com/xxxxx',
        },
        reference: { type: 'string', example: 'ref_xxxxxxxxxxxxx' },
        accessCode: { type: 'string', example: 'xxxxxxxxxxxxx' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  async initializeTransaction(
    @Body() dto: InitializeTransactionDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);

    // Get plan
    const plan = await this.plansService.findOne(dto.planId);

    return this.subscriptionsService.initializeTransaction(
      user.organizationId!,
      dto.email || user.email,
      {
        amount: dto.amount || plan.amount,
        planId: plan.id,
      },
    );
  }

  /**
   * Verify Paystack transaction and get authorization code
   * Called by frontend after Paystack redirects back with reference
   */
  @Post('verify-transaction')
  @ApiOperation({
    summary: 'Verify Paystack transaction',
    description: 'Verifies Paystack transaction reference and returns authorization code. Called by frontend after Paystack callback redirect.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction verified successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        authorizationCode: { type: 'string' },
        organizationId: { type: 'string' },
        planId: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  async verifyTransaction(@Body() body: { reference: string }) {
    return this.subscriptionsService.handleAuthorizationCallback(body.reference);
  }

  /**
   * Create subscription with authorization code
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Create subscription',
    description:
      'Creates a subscription using a valid authorization code from card authorization.',
  })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  @ApiResponse({ status: 404, description: 'Plan or authorization not found' })
  async create(
    @Body() dto: CreateSubscriptionDto,
    @CurrentUser() user: UserPayload,
  ): Promise<SubscriptionResponseDto> {
    requiresOrganization(user);

    return this.subscriptionsService.createSubscription(
      user.organizationId!,
      {
        auth0Id: user.auth0Id,
        email: user.email,
        ...(user.name && { name: user.name }),
      },
      dto,
    );
  }

  /**
   * Get current organization subscription
   */
  @Get('current')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get current subscription',
    description: 'Returns the current active subscription for the organization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription retrieved successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'No active subscription found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrent(@CurrentUser() user: UserPayload): Promise<SubscriptionResponseDto | null> {
    requiresOrganization(user);

    const subscription = await this.subscriptionsService.getCurrentSubscription(
      user.organizationId!,
    );

    if (!subscription) {
      throw new BadRequestException('No active subscription found');
    }

    return subscription;
  }

  /**
   * Cancel subscription
   */
  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Cancel subscription',
    description: 'Cancels the subscription. Access continues until period end.',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ): Promise<SubscriptionResponseDto> {
    requiresOrganization(user);

    return this.subscriptionsService.cancelSubscription(id, user.organizationId!);
  }

  /**
   * Reactivate subscription
   */
  @Post(':id/reactivate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reactivate subscription',
    description: 'Reactivates a cancelled subscription.',
  })
  @ApiParam({
    name: 'id',
    description: 'Subscription ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription reactivated successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Subscription cannot be reactivated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async reactivate(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
  ): Promise<SubscriptionResponseDto> {
    requiresOrganization(user);

    return this.subscriptionsService.reactivateSubscription(id, user.organizationId!);
  }
}

