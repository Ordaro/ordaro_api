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
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';

import { PrismaService } from '../database/prisma.service';
import { PaystackService } from './paystack.service';
import { PaystackEventType } from './dto';
import { SubscriptionStatus as PrismaSubscriptionStatus } from '../../generated/prisma';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly paystackService: PaystackService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Handle Paystack webhook events
   */
  @Post('paystack')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Paystack webhook handler',
    description:
      'Receives and processes webhook events from Paystack. Signature verification required.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handlePaystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
    @Body() event: { event: string; data: Record<string, unknown> },
  ) {
    if (!signature) {
      this.logger.warn('Webhook received without signature');
      throw new BadRequestException('Missing webhook signature');
    }

    // Verify signature - use raw body if available, otherwise stringify event
    const rawBody =
      req.rawBody?.toString('utf8') ||
      (typeof req.body === 'string' ? req.body : JSON.stringify(event));
    const isValid = this.paystackService.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      this.logger.error('Invalid webhook signature', {
        signature: signature.substring(0, 20) + '...',
      });
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log('Webhook event received', {
      event: event.event,
      eventId: (event.data?.['id'] as string) ?? 'unknown',
    });

    try {
      await this.processWebhookEvent(event.event, event.data);
      return { received: true };
    } catch (error: any) {
      this.logger.error('Failed to process webhook event', {
        event: event.event,
        error: error.message,
      });
      // Still return 200 to prevent Paystack retries for processing errors
      return { received: true, processed: false };
    }
  }

  private async processWebhookEvent(
    eventType: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    switch (eventType) {
      case PaystackEventType.CHARGE_SUCCESS:
        await this.handleChargeSuccess(data);
        break;

      case PaystackEventType.SUBSCRIPTION_CREATE:
        await this.handleSubscriptionCreate(data);
        break;

      case PaystackEventType.SUBSCRIPTION_ENABLE:
        await this.handleSubscriptionEnable(data);
        break;

      case PaystackEventType.SUBSCRIPTION_DISABLE:
        await this.handleSubscriptionDisable(data);
        break;

      case PaystackEventType.INVOICE_CREATE:
        await this.handleInvoiceCreate(data);
        break;

      case PaystackEventType.INVOICE_PAYMENT_FAILED:
        await this.handleInvoicePaymentFailed(data);
        break;

      case PaystackEventType.INVOICE_UPDATE:
        await this.handleInvoiceUpdate(data);
        break;

      case PaystackEventType.SUBSCRIPTION_EXPIRING_CARDS:
        await this.handleSubscriptionExpiringCards(data);
        break;

      default:
        this.logger.warn('Unhandled webhook event type', { eventType });
    }
  }

  private async handleChargeSuccess(data: Record<string, unknown>): Promise<void> {
    this.logger.log('Charge success event', {
      reference: (data['reference'] as string) ?? '',
      amount: (data['amount'] as number) ?? 0,
    });
    // Charge success is typically handled by transaction verification
    // Additional logic can be added here if needed
  }

  private async handleSubscriptionCreate(data: Record<string, unknown>): Promise<void> {
    this.logger.log('Subscription created event', {
      subscriptionCode: data['subscription_code'] ?? '',
    });
    // Subscription is already created via API
    // This event can be used for additional processing/logging
  }

  private async handleSubscriptionEnable(data: Record<string, unknown>): Promise<void> {
    const subscriptionCode = data['subscription_code'] as string;
    if (!subscriptionCode) {
      this.logger.warn('Subscription enable event missing subscription_code');
      return;
    }

    try {
      const subscription = await this.prismaService.subscription.findUnique({
        where: { paystackSubscriptionCode: subscriptionCode },
      });

      if (!subscription) {
        this.logger.warn('Subscription not found for enable event', { subscriptionCode });
        return;
      }

      await this.prismaService.subscription.update({
        where: { id: subscription.id },
        data: {
          status: PrismaSubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
      });

      this.logger.log('Subscription enabled', { subscriptionId: subscription.id, subscriptionCode });
    } catch (error) {
      this.logger.error('Failed to handle subscription enable', {
        subscriptionCode,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleSubscriptionDisable(data: Record<string, unknown>): Promise<void> {
    const subscriptionCode = data['subscription_code'] as string;
    if (!subscriptionCode) {
      this.logger.warn('Subscription disable event missing subscription_code');
      return;
    }

    try {
      const subscription = await this.prismaService.subscription.findUnique({
        where: { paystackSubscriptionCode: subscriptionCode },
      });

      if (!subscription) {
        this.logger.warn('Subscription not found for disable event', { subscriptionCode });
        return;
      }

      await this.prismaService.subscription.update({
        where: { id: subscription.id },
        data: {
          status: PrismaSubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelAtPeriodEnd: true,
        },
      });

      this.logger.log('Subscription disabled', { subscriptionId: subscription.id, subscriptionCode });
    } catch (error) {
      this.logger.error('Failed to handle subscription disable', {
        subscriptionCode,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleInvoiceCreate(data: Record<string, unknown>): Promise<void> {
    this.logger.log('Invoice created event', {
      invoiceId: (data['id'] as string) ?? '',
      subscriptionCode: (data['subscription'] as string) ?? '',
    });
    // Invoice creation tracking can be added here
  }

  private async handleInvoicePaymentFailed(data: Record<string, unknown>): Promise<void> {
    const subscriptionCode = data['subscription'] as string;
    if (!subscriptionCode) {
      this.logger.warn('Invoice payment failed event missing subscription code');
      return;
    }

    try {
      const subscription = await this.prismaService.subscription.findUnique({
        where: { paystackSubscriptionCode: subscriptionCode },
      });

      if (!subscription) {
        this.logger.warn('Subscription not found for payment failed event', { subscriptionCode });
        return;
      }

      await this.prismaService.subscription.update({
        where: { id: subscription.id },
        data: {
          status: PrismaSubscriptionStatus.PAST_DUE,
        },
      });

      this.logger.log('Subscription marked as past due', {
        subscriptionId: subscription.id,
        subscriptionCode,
      });
    } catch (error) {
      this.logger.error('Failed to handle invoice payment failed', {
        subscriptionCode,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleInvoiceUpdate(data: Record<string, unknown>): Promise<void> {
    const invoiceStatus = (data['status'] as string) ?? '';
    const subscriptionCode = data['subscription'] as string;

    this.logger.log('Invoice updated event', {
      invoiceId: (data['id'] as string) ?? '',
      status: invoiceStatus,
      subscriptionCode,
    });

    // Update subscription period if invoice is paid
    if (invoiceStatus === 'success' && subscriptionCode) {
      try {
        const subscription = await this.prismaService.subscription.findUnique({
          where: { paystackSubscriptionCode: subscriptionCode },
        });

        if (subscription) {
          // Update period end date if provided
          const paidAt = data['paid_at'] as string;
          if (paidAt) {
            const paidDate = new Date(paidAt);
            // Calculate next period end (this should match the plan interval)
            // For now, we'll just update the timestamp
            // In production, calculate based on plan interval
            await this.prismaService.subscription.update({
              where: { id: subscription.id },
              data: {
                status: PrismaSubscriptionStatus.ACTIVE,
                currentPeriodStart: paidDate,
                // Period end will be updated when we receive next payment notification
              },
            });

            this.logger.log('Subscription period updated from invoice', {
              subscriptionId: subscription.id,
              paidAt,
            });
          }
        }
      } catch (error) {
        this.logger.error('Failed to handle invoice update', {
          subscriptionCode,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async handleSubscriptionExpiringCards(data: Record<string, unknown>): Promise<void> {
    this.logger.warn('Subscription expiring cards event', {
      subscriptionCode: data['subscription_code'] ?? '',
    });
    // Notify organization about expiring card
    // This can trigger email notifications
  }
}

