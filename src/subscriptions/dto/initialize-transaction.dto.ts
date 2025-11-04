import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';

export class InitializeTransactionDto {
  @ApiProperty({
    description: 'Plan ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @ApiPropertyOptional({
    description: 'Customer email (defaults to authenticated user email)',
    example: 'customer@example.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: 'Amount in kobo/cents (defaults to plan amount)',
    example: 500000,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;
}

