import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';

export class SearchCustomerDto {
  @ApiPropertyOptional({ description: 'Email address to search' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number to search' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'First name (for fuzzy matching)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name (for fuzzy matching)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
