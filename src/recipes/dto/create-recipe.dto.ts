import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';

export class RecipeIngredientDto {
  @ApiProperty({ description: 'Ingredient ID' })
  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @ApiProperty({ description: 'Quantity used in recipe' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0.01)
  quantityUsed!: number;
}

export class CreateRecipeDto {
  @ApiProperty({ description: 'Recipe name', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Yield quantity - number of portions this recipe produces',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0.01)
  yieldQuantity!: number;

  @ApiProperty({
    description: 'List of ingredients with quantities',
    type: [RecipeIngredientDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];
}
