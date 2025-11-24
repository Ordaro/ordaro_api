import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import { SubscriptionStatus as PrismaSubscriptionStatus } from '../../generated/prisma';
import { PrismaService } from '../database/prisma.service';

import { CreateSubscriptionDto, SubscriptionResponseDto } from './dto';
import { SubscriptionStatus as DtoSubscriptionStatus } from './dto/subscription-response.dto';
import { PaystackService } from './paystack.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paystackService: PaystackService,
  ) {}

  /**
   * Initialize transaction for card authorization
   */
  async initializeTransaction(
    organizationId: string,
    userEmail: string,
    data: {
      amount: number;
      planId: string;
    },
  ): Promise<{
    authorizationUrl: string;
    reference: string;
    accessCode: string;
  }> {
    // Callback URL should point to frontend page (not API endpoint)
    // Frontend will then call backend API to verify the transaction
    const frontendBaseUrl =
      process.env['NEXT_PUBLIC_APP_BASE_URL'] ||
      process.env['APP_BASE_URL'] ||
      'http://localhost:3001';
    const callbackUrl = `${frontendBaseUrl}/subscriptions/callback`;

    const metadata = {
      organizationId,
      planId: data.planId,
    };

    return this.paystackService.initializeTransaction({
      email: userEmail,
      amount: data.amount,
      callbackUrl,
      metadata,
    });
  }

  /**
   * Handle Paystack authorization callback
   * Verifies transaction and saves authorization to database
   */
  async handleAuthorizationCallback(reference: string): Promise<{
    success: boolean;
    authorizationCode?: string;
    organizationId?: string;
    planId?: string;
    message: string;
  }> {
    try {
      const transaction =
        await this.paystackService.verifyTransaction(reference);

      if (transaction.status !== 'success') {
        return {
          success: false,
          message: 'Transaction was not successful',
        };
      }

      // Extract metadata from transaction (metadata is at transaction level)
      const metadata = transaction.metadata || {};
      const organizationId = (metadata['organizationId'] ||
        metadata['organization_id']) as string | undefined;
      const planId = (metadata['planId'] || metadata['plan_id']) as
        | string
        | undefined;

      if (!organizationId || !transaction.authorization.authorizationCode) {
        return {
          success: false,
          message: 'Missing required transaction data',
        };
      }

      // Get or create customer for organization
      const customer = await this.prismaService.customer.findUnique({
        where: { organizationId },
      });

      if (!customer) {
        // Customer should be created during organization setup, but create if missing
        // Note: In production, customer should be created in Paystack first
        // For now, we'll create a placeholder - customer creation will be implemented separately
        throw new NotFoundException(
          'Customer record not found. Please contact support.',
        );
      }

      // Check if authorization already exists
      let authorization = await this.prismaService.authorization.findUnique({
        where: {
          paystackAuthCode: transaction.authorization.authorizationCode,
        },
      });

      if (!authorization) {
        // Save authorization to database
        authorization = await this.prismaService.authorization.create({
          data: {
            paystackAuthCode: transaction.authorization.authorizationCode,
            paystackSignature: transaction.authorization.signature,
            last4: transaction.authorization.last4,
            cardType: transaction.authorization.cardType ?? null,
            expMonth: transaction.authorization.expMonth ?? null,
            expYear: transaction.authorization.expYear ?? null,
            bin: transaction.authorization.bin ?? null,
            customerId: customer.id,
            isActive: transaction.authorization.reusable,
          },
        });

        this.logger.log('Authorization saved to database', {
          authorizationId: authorization.id,
          organizationId,
        });
      } else {
        // Update existing authorization if needed
        authorization = await this.prismaService.authorization.update({
          where: { id: authorization.id },
          data: {
            isActive: transaction.authorization.reusable,
            last4: transaction.authorization.last4,
            expMonth: transaction.authorization.expMonth ?? null,
            expYear: transaction.authorization.expYear ?? null,
          },
        });
      }

      const result: {
        success: boolean;
        authorizationCode?: string;
        organizationId?: string;
        planId?: string;
        message: string;
      } = {
        success: true,
        authorizationCode: transaction.authorization.authorizationCode,
        message: 'Authorization successful',
      };

      if (organizationId !== undefined) {
        result.organizationId = organizationId;
      }

      if (planId !== undefined) {
        result.planId = planId;
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to handle authorization callback', {
        reference,
        error,
      });
      if (error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to verify transaction',
      };
    }
  }

  /**
   * Create subscription with authorization code
   */
  async createSubscription(
    organizationId: string,
    _user: { clerkUserId: string; email: string; name?: string },
    dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    // Verify organization exists
    const organization = await this.prismaService.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Get plan by Paystack plan code
    const plan = await this.prismaService.plan.findUnique({
      where: { paystackPlanCode: dto.planCode },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with code ${dto.planCode} not found`);
    }

    // Check if organization already has an active subscription
    const existingSubscription =
      await this.prismaService.subscription.findFirst({
        where: {
          customer: { organizationId },
          status: {
            in: [
              PrismaSubscriptionStatus.ACTIVE,
              PrismaSubscriptionStatus.TRIALING,
            ],
          },
        },
      });

    if (existingSubscription) {
      throw new BadRequestException(
        'Organization already has an active subscription. Cancel existing subscription first.',
      );
    }

    // Get or create customer
    const customer = await this.prismaService.customer.findUnique({
      where: { organizationId },
    });

    // TODO: Create customer in Paystack when customer service is implemented
    // For now, we'll need to handle this differently
    // This is a placeholder - customer creation will be added later
    if (!customer) {
      throw new BadRequestException(
        'Customer record not found. Please contact support.',
      );
    }

    // Verify authorization exists and is active
    const authorization = await this.prismaService.authorization.findFirst({
      where: {
        paystackAuthCode: dto.authorizationCode,
        customerId: customer.id,
        isActive: true,
      },
    });

    if (!authorization) {
      throw new NotFoundException('Authorization code not found or inactive');
    }

    try {
      // Create subscription in Paystack
      const paystackSubscription =
        await this.paystackService.createSubscription({
          customer: customer.paystackCustomerCode,
          plan: dto.planCode,
          authorization: dto.authorizationCode,
        });

      // Calculate period dates from Paystack response or use defaults
      const periodStart = new Date(paystackSubscription.start * 1000);
      let periodEnd = new Date(periodStart);

      // Paystack returns next_payment_date, but we calculate based on interval
      switch (plan.interval) {
        case 'DAILY':
          periodEnd.setDate(periodEnd.getDate() + 1);
          break;
        case 'WEEKLY':
          periodEnd.setDate(periodEnd.getDate() + 7);
          break;
        case 'MONTHLY':
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          break;
        case 'ANNUALLY':
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          break;
      }

      // If Paystack provided next payment date, use it
      if (paystackSubscription.nextPaymentDate) {
        periodEnd = new Date(paystackSubscription.nextPaymentDate);
      }

      // Create subscription in database
      const subscription = await this.prismaService.subscription.create({
        data: {
          paystackSubscriptionCode: paystackSubscription.subscriptionCode,
          paystackEmailToken: paystackSubscription.emailToken || null,
          customerId: customer.id,
          planId: plan.id,
          status:
            paystackSubscription.status === 'active'
              ? PrismaSubscriptionStatus.ACTIVE
              : PrismaSubscriptionStatus.INACTIVE,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      });

      this.logger.log(`Subscription created: ${subscription.id}`, {
        subscriptionId: subscription.id,
        organizationId,
      });

      return this.mapToResponse(subscription);
    } catch (error: any) {
      this.logger.error('Failed to create subscription', {
        organizationId,
        dto,
        error: error.message,
      });
      throw new InternalServerErrorException(
        error.message || 'Failed to create subscription',
      );
    }
  }

  /**
   * Get current subscription for organization
   */
  async getCurrentSubscription(
    organizationId: string,
  ): Promise<SubscriptionResponseDto | null> {
    const subscription = await this.prismaService.subscription.findFirst({
      where: {
        customer: { organizationId },
        status: {
          in: [
            PrismaSubscriptionStatus.ACTIVE,
            PrismaSubscriptionStatus.TRIALING,
            PrismaSubscriptionStatus.PAST_DUE,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        customer: true,
      },
    });

    if (!subscription) {
      return null;
    }

    return this.mapToResponse(subscription);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    organizationId: string,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.prismaService.subscription.findUnique({
      where: { id: subscriptionId },
      include: { customer: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.customer.organizationId !== organizationId) {
      throw new UnauthorizedException(
        'Subscription does not belong to your organization',
      );
    }

    try {
      // Cancel in Paystack
      await this.paystackService.cancelSubscription(
        subscription.paystackSubscriptionCode,
        subscription.paystackEmailToken || undefined,
      );

      // Update in database
      const updated = await this.prismaService.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: PrismaSubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelAtPeriodEnd: true,
        },
      });

      this.logger.log(`Subscription cancelled: ${subscriptionId}`, {
        subscriptionId,
        organizationId,
      });

      return this.mapToResponse(updated);
    } catch (error: any) {
      this.logger.error('Failed to cancel subscription', {
        subscriptionId,
        error: error.message,
      });
      throw new InternalServerErrorException('Failed to cancel subscription');
    }
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(
    subscriptionId: string,
    organizationId: string,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.prismaService.subscription.findUnique({
      where: { id: subscriptionId },
      include: { customer: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.customer.organizationId !== organizationId) {
      throw new UnauthorizedException(
        'Subscription does not belong to your organization',
      );
    }

    if (subscription.status !== PrismaSubscriptionStatus.CANCELLED) {
      throw new BadRequestException(
        'Only cancelled subscriptions can be reactivated',
      );
    }

    try {
      // Reactivate in Paystack
      await this.paystackService.reactivateSubscription(
        subscription.paystackSubscriptionCode,
        subscription.paystackEmailToken || undefined,
      );

      // Update in database
      const updated = await this.prismaService.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: PrismaSubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
      });

      this.logger.log(`Subscription reactivated: ${subscriptionId}`, {
        subscriptionId,
        organizationId,
      });

      return this.mapToResponse(updated);
    } catch (error: any) {
      this.logger.error('Failed to reactivate subscription', {
        subscriptionId,
        error: error.message,
      });
      throw new InternalServerErrorException(
        'Failed to reactivate subscription',
      );
    }
  }

  private mapToResponse(subscription: {
    id: string;
    paystackSubscriptionCode: string;
    paystackEmailToken: string | null;
    customerId: string;
    planId: string;
    status: PrismaSubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): SubscriptionResponseDto {
    const result: SubscriptionResponseDto = {
      id: subscription.id,
      paystackSubscriptionCode: subscription.paystackSubscriptionCode,
      customerId: subscription.customerId,
      planId: subscription.planId,
      status: subscription.status as DtoSubscriptionStatus,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };

    if (subscription.paystackEmailToken !== null) {
      result.paystackEmailToken = subscription.paystackEmailToken;
    }
    if (subscription.cancelledAt !== null) {
      result.cancelledAt = subscription.cancelledAt;
    }

    return result;
  }
}
