import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({ description: 'Ingredient ID' })
  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @ApiProperty({
    description: 'Quantity adjustment (positive or negative)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  quantity!: number;

  @ApiProperty({ description: 'Reason for adjustment' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
