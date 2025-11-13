import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  Min,
  IsEnum,
  IsOptional,
  IsObject,
  IsBoolean,
} from 'class-validator';

import { PlanInterval } from './create-plan.dto';

export class UpdatePlanDto {
  @ApiPropertyOptional({
    description: 'Plan name',
    example: 'Basic Plan Updated',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Plan description',
    example: 'Updated description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Amount in kobo (Nigeria) or smallest currency unit',
    example: 600000,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Billing interval',
    enum: PlanInterval,
  })
  @IsOptional()
  @IsEnum(PlanInterval)
  interval?: PlanInterval;

  @ApiPropertyOptional({
    description: 'Plan features as JSON object',
  })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Whether plan is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
