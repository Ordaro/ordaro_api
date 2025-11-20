import { ApiProperty } from '@nestjs/swagger';

export class RecipeIngredientResponseDto {
  @ApiProperty({ description: 'Recipe ingredient ID' })
  id!: string;

  @ApiProperty({ description: 'Quantity used' })
  quantityUsed!: number;

  @ApiProperty({ description: 'Unit cost at time of recipe creation/update' })
  unitCostAtUse!: number;

  @ApiProperty({ description: 'Total cost for this ingredient' })
  totalCost!: number;

  @ApiProperty({ description: 'Ingredient ID' })
  ingredientId!: string;

  @ApiProperty({ description: 'Ingredient name' })
  ingredientName!: string;

  @ApiProperty({ description: 'Ingredient unit' })
  ingredientUnit!: string;
}

export class RecipeResponseDto {
  @ApiProperty({ description: 'Recipe ID' })
  id!: string;

  @ApiProperty({ description: 'Recipe name' })
  name!: string;

  @ApiProperty({ description: 'Yield quantity (portions)' })
  yieldQuantity!: number;

  @ApiProperty({ description: 'Total cost of all ingredients' })
  totalCost!: number;

  @ApiProperty({ description: 'Cost per portion' })
  costPerPortion!: number;

  @ApiProperty({ description: 'Recipe version' })
  version!: number;

  @ApiProperty({ description: 'Whether recipe is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Company ID' })
  companyId!: string;

  @ApiProperty({
    description: 'Recipe ingredients',
    type: [RecipeIngredientResponseDto],
  })
  recipeItems!: RecipeIngredientResponseDto[];

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;
}
