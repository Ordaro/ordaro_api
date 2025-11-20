import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LinkCustomerOrgDto {
  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiPropertyOptional({ description: 'Branch ID (optional)' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
