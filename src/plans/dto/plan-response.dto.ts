import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanInterval } from './create-plan.dto';

export class PlanResponseDto {
  @ApiProperty({
    description: 'Plan ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Paystack plan code',
    example: 'PLN_xxxxxxxxxxxxx',
  })
  paystackPlanCode!: string;

  @ApiProperty({
    description: 'Plan name',
    example: 'Basic Plan',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Plan description',
    example: 'Perfect for small restaurants',
  })
  description?: string;

  @ApiProperty({
    description: 'Amount in kobo/cents',
    example: 500000,
  })
  amount!: number;

  @ApiProperty({
    description: 'Billing interval',
    enum: PlanInterval,
    example: PlanInterval.MONTHLY,
  })
  interval!: PlanInterval;

  @ApiProperty({
    description: 'Whether plan is active',
    example: true,
  })
  isActive!: boolean;

  @ApiPropertyOptional({
    description: 'Plan features',
    example: { maxBranches: 3, maxUsers: 10 },
  })
  features?: Record<string, unknown>;

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

