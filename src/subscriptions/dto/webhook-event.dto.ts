import { ApiProperty } from '@nestjs/swagger';

export enum PaystackEventType {
  CHARGE_SUCCESS = 'charge.success',
  SUBSCRIPTION_CREATE = 'subscription.create',
  SUBSCRIPTION_ENABLE = 'subscription.enable',
  SUBSCRIPTION_DISABLE = 'subscription.disable',
  SUBSCRIPTION_NOTIFICATION = 'subscription.notification',
  INVOICE_CREATE = 'invoice.create',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  INVOICE_UPDATE = 'invoice.update',
  SUBSCRIPTION_EXPIRING_CARDS = 'subscription.expiring_cards',
}

export class PaystackWebhookEventDto {
  @ApiProperty({
    description: 'Event type',
    enum: PaystackEventType,
    example: PaystackEventType.CHARGE_SUCCESS,
  })
  event!: string;

  @ApiProperty({
    description: 'Event data payload',
    example: {},
  })
  data!: Record<string, unknown>;
}

