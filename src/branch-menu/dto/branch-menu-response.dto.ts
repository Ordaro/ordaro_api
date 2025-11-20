import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BranchMenuResponseDto {
  @ApiProperty({ description: 'Branch menu ID' })
  id!: string;

  @ApiPropertyOptional({ description: 'Branch-specific price override' })
  localPrice?: number | null;

  @ApiProperty({ description: 'Availability status' })
  availability!: boolean;

  @ApiProperty({ description: 'Whether menu item is active for this branch' })
  isActive!: boolean;

  @ApiProperty({ description: 'Branch ID' })
  branchId!: string;

  @ApiProperty({ description: 'Menu item ID' })
  menuItemId!: string;

  @ApiProperty({ description: 'Menu item details' })
  menuItem!: {
    id: string;
    name: string;
    basePrice: number;
    description?: string | null;
    imageUrl?: string | null;
  };

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;
}
