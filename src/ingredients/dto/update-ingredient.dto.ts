import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsNumber,
  Min,
} from 'class-validator';

export class UpdateIngredientDto {
  @ApiPropertyOptional({ description: 'Ingredient name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Unit of measurement (e.g., kg, liters, pieces)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({
    description: 'Reorder threshold - alert when stock falls below this',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  reorderThreshold?: number;

  @ApiPropertyOptional({
    description: 'Unit cost - updating this will trigger cost recalculation',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  unitCost?: number;
}
