import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IngredientResponseDto {
  @ApiProperty({ description: 'Ingredient ID' })
  id!: string;

  @ApiProperty({ description: 'Ingredient name' })
  name!: string;

  @ApiProperty({ description: 'Unit of measurement' })
  unit!: string;

  @ApiPropertyOptional({ description: 'Reorder threshold' })
  reorderThreshold?: number | null;

  @ApiProperty({ description: 'Total stock quantity (cached)' })
  totalStock!: number;

  @ApiPropertyOptional({ description: 'Average unit cost (weighted average)' })
  averageUnitCost?: number | null;

  @ApiPropertyOptional({
    description: 'FIFO unit cost (cost of next available batch)',
  })
  fifoUnitCost?: number | null;

  @ApiProperty({ description: 'Whether ingredient is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Company ID' })
  companyId!: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;
}
