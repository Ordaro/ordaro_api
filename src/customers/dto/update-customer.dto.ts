import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEmail,
  MaxLength,
  IsBoolean,
} from 'class-validator';

export class UpdateCustomerDto {
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

  @ApiPropertyOptional({ description: 'Full name' })
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

  @ApiPropertyOptional({ description: 'Address' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ description: 'Email opt-in preference' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  emailOptIn?: boolean;

  @ApiPropertyOptional({ description: 'SMS opt-in preference' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  smsOptIn?: boolean;

  @ApiPropertyOptional({ description: 'WhatsApp opt-in preference' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  whatsappOptIn?: boolean;
}
