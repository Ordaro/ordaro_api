import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';

import { RecipeIngredientDto } from './create-recipe.dto';

export class UpdateRecipeDto {
  @ApiPropertyOptional({ description: 'Recipe name', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Yield quantity - number of portions this recipe produces',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0.01)
  yieldQuantity?: number;

  @ApiPropertyOptional({
    description:
      'List of ingredients with quantities (full replacement if provided)',
    type: [RecipeIngredientDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients?: RecipeIngredientDto[];
}
