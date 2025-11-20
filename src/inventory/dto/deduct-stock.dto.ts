import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';

export class DeductStockDto {
  @ApiProperty({ description: 'Ingredient ID' })
  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @ApiProperty({ description: 'Quantity to deduct' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0.01)
  qty!: number;

  @ApiPropertyOptional({ description: 'Order ID (if deducted for order)' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Recipe ID (if deducted for recipe)' })
  @IsOptional()
  @IsString()
  recipeId?: string;

  @ApiPropertyOptional({ description: 'Reason for deduction' })
  @IsOptional()
  @IsString()
  reason?: string;
}
