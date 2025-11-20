import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsNumber,
  Min,
  IsUrl,
} from 'class-validator';

export class UpdateMenuItemDto {
  @ApiPropertyOptional({ description: 'Menu item name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Menu item description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Image URL' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({ description: 'Base price' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ description: 'Portion multiplier' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0.01)
  portionMultiplier?: number;

  @ApiPropertyOptional({ description: 'Recipe ID to link' })
  @IsOptional()
  @IsString()
  recipeId?: string;
}
