import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class FindOrCreateCustomerDto {
  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Full name (if firstName/lastName not available)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ description: 'Organization ID' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiPropertyOptional({ description: 'Branch ID (optional)' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
