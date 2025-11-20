import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MenuVariantResponseDto {
  @ApiProperty({ description: 'Variant ID' })
  id!: string;

  @ApiProperty({ description: 'Variant name' })
  name!: string;

  @ApiProperty({ description: 'Variant price' })
  price!: number;

  @ApiProperty({ description: 'Portion multiplier' })
  portionMultiplier!: number;

  @ApiPropertyOptional({ description: 'Recipe ID override' })
  recipeId?: string | null;

  @ApiProperty({ description: 'Whether variant is active' })
  isActive!: boolean;
}

export class MenuItemResponseDto {
  @ApiProperty({ description: 'Menu item ID' })
  id!: string;

  @ApiProperty({ description: 'Menu item name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Description' })
  description?: string | null;

  @ApiPropertyOptional({ description: 'Image URL' })
  imageUrl?: string | null;

  @ApiPropertyOptional({ description: 'Category' })
  category?: string | null;

  @ApiProperty({ description: 'Base price' })
  basePrice!: number;

  @ApiProperty({ description: 'Portion multiplier' })
  portionMultiplier!: number;

  @ApiPropertyOptional({ description: 'Computed cost from recipe' })
  computedCost?: number | null;

  @ApiPropertyOptional({ description: 'Margin percentage' })
  margin?: number | null;

  @ApiProperty({ description: 'Total orders count' })
  totalOrders!: number;

  @ApiProperty({ description: 'Total revenue' })
  totalRevenue!: number;

  @ApiPropertyOptional({ description: 'Last ordered at' })
  lastOrderedAt?: Date | null;

  @ApiPropertyOptional({ description: 'Recipe ID' })
  recipeId?: string | null;

  @ApiProperty({ description: 'Company ID' })
  companyId!: string;

  @ApiProperty({ description: 'Whether menu item is active' })
  isActive!: boolean;

  @ApiProperty({
    description: 'Menu variants',
    type: [MenuVariantResponseDto],
  })
  variants?: MenuVariantResponseDto[];

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;
}
