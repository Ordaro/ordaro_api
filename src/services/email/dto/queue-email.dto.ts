import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsObject,
  ValidateNested,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class EmailAttachmentDto {
  @ApiProperty({ description: 'Attachment filename', example: 'document.pdf' })
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @ApiPropertyOptional({
    description: 'Attachment content as base64 encoded string',
    example: 'base64encodedcontent...',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'URL to remote file for attachment',
    example: 'https://example.com/document.pdf',
  })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({
    description: 'Attachment content type',
    example: 'application/pdf',
  })
  @IsOptional()
  @IsString()
  contentType?: string;
}

export class EmailTagDto {
  @ApiProperty({ description: 'Tag name', example: 'category' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Tag value', example: 'notification' })
  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class QueueEmailJobOptionsDto {
  @ApiPropertyOptional({
    description: 'Job priority (higher number = higher priority)',
    example: 1,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({
    description: 'Delay before processing job (in milliseconds)',
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  delay?: number;

  @ApiPropertyOptional({
    description: 'Number of retry attempts',
    example: 3,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  attempts?: number;
}

export class QueueEmailDto {
  @ApiProperty({
    description: 'Recipient email address(es)',
    example: 'user@example.com',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  @IsNotEmpty()
  to!: string | string[];

  @ApiProperty({ description: 'Email subject', example: 'Welcome to Ordaro' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiPropertyOptional({
    description: 'HTML email content',
    example: '<h1>Hello</h1><p>Welcome!</p>',
  })
  @IsOptional()
  @IsString()
  html?: string;

  @ApiPropertyOptional({
    description: 'Plain text email content',
    example: 'Hello, Welcome!',
  })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({
    description: 'Sender email address',
    example: 'Ordaro <noreply@notifications.ordaro.cloud>',
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({
    description: 'CC recipient email address(es)',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  @IsOptional()
  cc?: string | string[];

  @ApiPropertyOptional({
    description: 'BCC recipient email address(es)',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  @IsOptional()
  bcc?: string | string[];

  @ApiPropertyOptional({
    description: 'Reply-to email address(es)',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  @IsOptional()
  replyTo?: string | string[];

  @ApiPropertyOptional({
    description: 'Email attachments',
    type: [EmailAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailAttachmentDto)
  attachments?: EmailAttachmentDto[];

  @ApiPropertyOptional({
    description: 'Email tags for tracking and categorization',
    type: [EmailTagDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailTagDto)
  tags?: EmailTagDto[];

  @ApiPropertyOptional({
    description: 'Custom email headers',
    example: { 'X-Custom-Header': 'value' },
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Job options for queue processing',
    type: QueueEmailJobOptionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QueueEmailJobOptionsDto)
  options?: QueueEmailJobOptionsDto;
}

export class QueueBatchEmailDto {
  @ApiProperty({
    description: 'Array of emails to send',
    type: [QueueEmailDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueueEmailDto)
  emails!: QueueEmailDto[];

  @ApiPropertyOptional({
    description: 'Job options for batch email',
    type: QueueEmailJobOptionsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QueueEmailJobOptionsDto)
  options?: QueueEmailJobOptionsDto;
}

export class QueueEmailResponseDto {
  @ApiProperty({ description: 'Job ID', example: '123' })
  jobId!: string;

  @ApiProperty({ description: 'Job type', example: 'SEND_EMAIL' })
  jobType!: string;

  @ApiProperty({ description: 'Queue name', example: 'notifications' })
  queueName!: string;

  @ApiProperty({
    description: 'Job status',
    example: 'waiting',
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed'],
  })
  status!: string;
}
