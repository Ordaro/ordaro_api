import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsEmail,
  ValidateNested,
} from 'class-validator';

/**
 * Auth0 email types that can be sent through the custom email provider
 */
export enum Auth0EmailType {
  VERIFICATION_EMAIL = 'verification_email',
  PASSWORD_RESET = 'password_reset',
  WELCOME_EMAIL = 'welcome_email',
  USER_INVITED = 'user_invited',
  CHANGE_PASSWORD = 'change_password',
  BLOCK_ACCOUNT = 'block_account',
  MFA_CODE = 'mfa_code',
}

/**
 * Auth0 user data structure
 */
export class Auth0UserDto {
  @ApiPropertyOptional({ description: 'User ID', example: 'auth0|123456789' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({
    description: 'User email',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'User name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'User nickname', example: 'johndoe' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({ description: 'User picture URL' })
  @IsOptional()
  @IsString()
  picture?: string;

  @ApiPropertyOptional({ description: 'Additional user metadata' })
  @IsOptional()
  @IsObject()
  user_metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Application metadata' })
  @IsOptional()
  @IsObject()
  app_metadata?: Record<string, any>;
}

/**
 * Auth0 application data structure
 */
export class Auth0ApplicationDto {
  @ApiPropertyOptional({ description: 'Application ID', example: 'abc123' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ description: 'Application name', example: 'My App' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Application logo URL' })
  @IsOptional()
  @IsString()
  logo?: string;
}

/**
 * Auth0 client data structure
 */
export class Auth0ClientDto {
  @ApiPropertyOptional({ description: 'Client ID', example: 'client123' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ description: 'Client name', example: 'My Client' })
  @IsOptional()
  @IsString()
  name?: string;
}

/**
 * Auth0 organization data structure
 */
export class Auth0OrganizationDto {
  @ApiPropertyOptional({ description: 'Organization ID', example: 'org_123' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({
    description: 'Organization name',
    example: 'My Organization',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Organization display name',
    example: 'My Org Display',
  })
  @IsOptional()
  @IsString()
  display_name?: string;
}

/**
 * Request DTO for Auth0 email endpoint
 */
export class Auth0EmailRequestDto {
  @ApiProperty({
    description: 'Auth0 email type',
    enum: Auth0EmailType,
    example: Auth0EmailType.VERIFICATION_EMAIL,
  })
  @IsEnum(Auth0EmailType)
  @IsNotEmpty()
  type!: Auth0EmailType;

  @ApiProperty({
    description: 'Recipient email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  to!: string;

  @ApiPropertyOptional({
    description: 'User data from Auth0',
    type: Auth0UserDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Auth0UserDto)
  user?: Auth0UserDto;

  @ApiPropertyOptional({
    description: 'Application data from Auth0',
    type: Auth0ApplicationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Auth0ApplicationDto)
  application?: Auth0ApplicationDto;

  @ApiPropertyOptional({
    description: 'Client data from Auth0',
    type: Auth0ClientDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Auth0ClientDto)
  client?: Auth0ClientDto;

  @ApiPropertyOptional({
    description: 'Organization data from Auth0',
    type: Auth0OrganizationDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Auth0OrganizationDto)
  organization?: Auth0OrganizationDto;

  @ApiPropertyOptional({
    description: 'URL for email action (verification, password reset, etc.)',
    example: 'https://app.example.com/verify?token=abc123',
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({
    description: 'Code for email (MFA code, verification code, etc.)',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Inviter user data (for user_invited type)',
    type: Auth0UserDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => Auth0UserDto)
  inviter?: Auth0UserDto;

  @ApiPropertyOptional({
    description: 'Reason for blocking account (for block_account type)',
    example: 'Suspicious activity detected',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Additional context data',
    example: { ip: '192.168.1.1', userAgent: 'Mozilla/5.0...' },
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}

/**
 * Response DTO for Auth0 email endpoint
 */
export class Auth0EmailResponseDto {
  @ApiProperty({ description: 'Job ID for tracking', example: '123' })
  jobId!: string;

  @ApiProperty({ description: 'Job type', example: 'SEND_AUTH0_EMAIL' })
  jobType!: string;

  @ApiProperty({ description: 'Queue name', example: 'notifications' })
  queueName!: string;

  @ApiProperty({
    description: 'Job status',
    example: 'waiting',
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed'],
  })
  status!: string;

  @ApiProperty({ description: 'Email type', enum: Auth0EmailType })
  emailType!: Auth0EmailType;

  @ApiProperty({ description: 'Recipient email', example: 'user@example.com' })
  recipient!: string;
}
