import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SettingsResponseDto {
  @ApiProperty({ description: 'Settings ID' })
  id!: string;

  @ApiProperty({ description: 'Allow branches to create menu items' })
  canBranchCreateMenu!: boolean;

  @ApiProperty({ description: 'Require approval for menu proposals' })
  requiresApprovalForProposals!: boolean;

  @ApiProperty({ description: 'Allow branch price overrides' })
  allowBranchPriceOverride!: boolean;

  @ApiProperty({ description: 'Auto-propagate approved menus to all branches' })
  autoPropagateApprovedMenus!: boolean;

  @ApiPropertyOptional({ description: 'Target margin threshold' })
  targetMarginThreshold?: number | null;

  @ApiProperty({ description: 'Company ID' })
  companyId!: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;
}
