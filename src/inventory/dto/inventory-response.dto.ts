import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IngredientBatchResponseDto {
  @ApiProperty({ description: 'Batch ID' })
  id!: string;

  @ApiProperty({ description: 'Remaining quantity' })
  remainingQty!: number;

  @ApiProperty({ description: 'Unit cost' })
  unitCost!: number;

  @ApiProperty({ description: 'Total cost' })
  totalCost!: number;

  @ApiPropertyOptional({ description: 'Receipt reference' })
  receiptRef?: string | null;

  @ApiPropertyOptional({ description: 'Expiration date' })
  expiresAt?: Date | null;

  @ApiProperty({ description: 'Whether batch is closed' })
  isClosed!: boolean;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;
}

export class InventoryResponseDto {
  @ApiProperty({ description: 'Ingredient ID' })
  ingredientId!: string;

  @ApiProperty({ description: 'Ingredient name' })
  ingredientName!: string;

  @ApiProperty({ description: 'Total stock quantity' })
  totalStock!: number;

  @ApiPropertyOptional({ description: 'Average unit cost' })
  averageUnitCost?: number | null;

  @ApiPropertyOptional({ description: 'FIFO unit cost' })
  fifoUnitCost?: number | null;

  @ApiProperty({
    description: 'Active batches',
    type: [IngredientBatchResponseDto],
  })
  batches!: IngredientBatchResponseDto[];
}
