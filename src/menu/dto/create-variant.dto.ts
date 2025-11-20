import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';

export class CreateVariantDto {
  @ApiProperty({
    description: 'Variant name (e.g., Small, Large)',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiProperty({ description: 'Variant price' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    description: 'Portion multiplier (default: 1)',
    default: 1,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0.01)
  portionMultiplier?: number;

  @ApiPropertyOptional({
    description: 'Optional recipe override for this variant',
  })
  @IsOptional()
  @IsString()
  recipeId?: string;
}
