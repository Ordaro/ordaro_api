import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class UpdateBranchMenuDto {
  @ApiPropertyOptional({
    description: 'Branch-specific price override',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  localPrice?: number;

  @ApiPropertyOptional({
    description: 'Availability status',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  availability?: boolean;

  @ApiPropertyOptional({
    description: 'Whether menu item is active for this branch',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
