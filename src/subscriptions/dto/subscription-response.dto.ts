import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CANCELLED = 'CANCELLED',
  PAST_DUE = 'PAST_DUE',
  TRIALING = 'TRIALING',
}

export class SubscriptionResponseDto {
  @ApiProperty({
    description: 'Subscription ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Paystack subscription code',
    example: 'SUB_xxxxxxxxxxxxx',
  })
  paystackSubscriptionCode!: string;

  @ApiPropertyOptional({
    description: 'Paystack email token for subscription management',
    example: 'token_xxxxxxxxxxxxx',
  })
  paystackEmailToken?: string;

  @ApiProperty({
    description: 'Customer ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  customerId!: string;

  @ApiProperty({
    description: 'Plan ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  planId!: string;

  @ApiProperty({
    description: 'Subscription status',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @ApiProperty({
    description: 'Current period start',
    example: '2025-01-01T00:00:00.000Z',
  })
  currentPeriodStart!: Date;

  @ApiProperty({
    description: 'Current period end',
    example: '2025-02-01T00:00:00.000Z',
  })
  currentPeriodEnd!: Date;

  @ApiProperty({
    description: 'Whether subscription will cancel at period end',
    example: false,
  })
  cancelAtPeriodEnd!: boolean;

  @ApiPropertyOptional({
    description: 'Cancellation timestamp',
    example: '2025-01-15T00:00:00.000Z',
  })
  cancelledAt?: Date;

  @ApiProperty({
    description: 'Created at timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Updated at timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  updatedAt!: Date;
}

