import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'Paystack plan code',
    example: 'PLN_xxxxxxxxxxxxx',
  })
  @IsString()
  @IsNotEmpty()
  planCode!: string;

  @ApiProperty({
    description: 'Paystack authorization code from card authorization',
    example: 'AUTH_xxxxxxxxxxxxx',
  })
  @IsString()
  @IsNotEmpty()
  authorizationCode!: string;
}

