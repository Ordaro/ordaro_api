import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateIngredientDto {
  @ApiProperty({ description: 'Ingredient name', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Unit of measurement (e.g., kg, liters, pieces)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit!: string;

  @ApiPropertyOptional({
    description: 'Reorder threshold - alert when stock falls below this',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  reorderThreshold?: number;

  @ApiPropertyOptional({
    description: 'Initial stock quantity (optional)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  initialStock?: number;

  @ApiPropertyOptional({
    description: 'Initial unit cost (required if initialStock is provided)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  initialCost?: number;
}
