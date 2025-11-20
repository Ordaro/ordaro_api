import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CustomerConsentDto {
  @ApiProperty({ description: 'Marketing emails consent' })
  @IsBoolean()
  @Type(() => Boolean)
  marketingEmails!: boolean;

  @ApiProperty({ description: 'SMS notifications consent' })
  @IsBoolean()
  @Type(() => Boolean)
  smsNotifications!: boolean;

  @ApiProperty({ description: 'WhatsApp messages consent' })
  @IsBoolean()
  @Type(() => Boolean)
  whatsappMessages!: boolean;

  @ApiPropertyOptional({
    description: 'Consent method (POS, ONLINE, EMAIL, etc.)',
  })
  @IsOptional()
  @IsString()
  consentMethod?: string;

  @ApiPropertyOptional({ description: 'IP address' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User agent' })
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class WithdrawConsentDto {
  @ApiProperty({ description: 'Channel to withdraw consent from' })
  @IsString()
  @IsNotEmpty()
  channel!: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'ALL';
}
