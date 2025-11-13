import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsEnum,
  IsOptional,
  IsObject,
} from 'class-validator';

export enum PlanInterval {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  ANNUALLY = 'ANNUALLY',
}

export class CreatePlanDto {
  @ApiProperty({
    description: 'Plan name',
    example: 'Basic Plan',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Plan description',
    example: 'Perfect for small restaurants',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description:
      'Amount in smallest currency unit (pesewas for GHS, kobo for NGN, cents for ZAR/KES). Minimum: 200 for GHS (2 GHS), 100 for NGN (1 NGN)',
    example: 5000, // 50 GHS (5000 pesewas) or 50 NGN (5000 kobo)
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({
    description: 'Billing interval',
    enum: PlanInterval,
    example: PlanInterval.MONTHLY,
  })
  @IsEnum(PlanInterval)
  interval!: PlanInterval;

  @ApiPropertyOptional({
    description: 'Plan features as JSON object',
    example: { maxBranches: 3, maxUsers: 10 },
  })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;
}
