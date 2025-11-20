import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class StockEntryDto {
  @ApiProperty({ description: 'Ingredient ID' })
  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0.01)
  quantity!: number;

  @ApiProperty({ description: 'Total cost' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  totalCost!: number;

  @ApiPropertyOptional({ description: 'Receipt reference' })
  @IsOptional()
  @IsString()
  receiptRef?: string;

  @ApiPropertyOptional({ description: 'Expiration date' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Branch ID (optional)' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
