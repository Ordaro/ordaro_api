import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MenuProposalResponseDto {
  @ApiProperty({ description: 'Proposal ID' })
  id!: string;

  @ApiProperty({ description: 'Menu item name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Description' })
  description?: string | null;

  @ApiProperty({ description: 'Base price' })
  basePrice!: number;

  @ApiProperty({ description: 'Proposal status' })
  status!: string;

  @ApiPropertyOptional({ description: 'Notes' })
  notes?: string | null;

  @ApiProperty({ description: 'Company ID' })
  companyId!: string;

  @ApiProperty({ description: 'Branch ID' })
  branchId!: string;

  @ApiPropertyOptional({ description: 'Recipe ID' })
  recipeId?: string | null;

  @ApiPropertyOptional({ description: 'Created menu item ID (after approval)' })
  menuItemId?: string | null;

  @ApiPropertyOptional({ description: 'Approver ID' })
  approverId?: string | null;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Approved at timestamp' })
  approvedAt?: Date | null;

  @ApiPropertyOptional({ description: 'Rejected at timestamp' })
  rejectedAt?: Date | null;
}
