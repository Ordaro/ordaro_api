import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: 'Allow branches to create menu items',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  canBranchCreateMenu?: boolean;

  @ApiPropertyOptional({
    description: 'Require approval for menu proposals',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  requiresApprovalForProposals?: boolean;

  @ApiPropertyOptional({
    description: 'Allow branch price overrides',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  allowBranchPriceOverride?: boolean;

  @ApiPropertyOptional({
    description: 'Auto-propagate approved menus to all branches',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  autoPropagateApprovedMenus?: boolean;

  @ApiPropertyOptional({
    description: 'Target margin threshold (0-1, e.g., 0.30 for 30%)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  @Max(1)
  targetMarginThreshold?: number;
}
