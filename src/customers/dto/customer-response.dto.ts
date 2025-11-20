import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrganizationCustomerResponseDto {
  @ApiProperty({ description: 'Organization customer ID' })
  id!: string;

  @ApiProperty({ description: 'Loyalty points' })
  loyaltyPoints!: number;

  @ApiProperty({ description: 'Total orders' })
  totalOrders!: number;

  @ApiProperty({ description: 'Total spent' })
  totalSpent!: number;

  @ApiProperty({ description: 'Average order value' })
  averageOrderValue!: number;

  @ApiPropertyOptional({ description: 'Last order date' })
  lastOrderAt?: Date | null;

  @ApiPropertyOptional({ description: 'First order date' })
  firstOrderAt?: Date | null;

  @ApiProperty({ description: 'Is VIP customer' })
  isVIP!: boolean;

  @ApiPropertyOptional({ description: 'Staff notes' })
  notes?: string | null;

  @ApiProperty({ description: 'Organization ID' })
  organizationId!: string;

  @ApiPropertyOptional({ description: 'Branch ID' })
  branchId?: string | null;
}

export class CustomerResponseDto {
  @ApiProperty({ description: 'Customer ID' })
  id!: string;

  @ApiPropertyOptional({ description: 'Email address' })
  email?: string | null;

  @ApiPropertyOptional({ description: 'Phone number' })
  phone?: string | null;

  @ApiPropertyOptional({ description: 'First name' })
  firstName?: string | null;

  @ApiPropertyOptional({ description: 'Last name' })
  lastName?: string | null;

  @ApiPropertyOptional({ description: 'Full name' })
  fullName?: string | null;

  @ApiProperty({ description: 'Email verified' })
  emailVerified!: boolean;

  @ApiProperty({ description: 'Phone verified' })
  phoneVerified!: boolean;

  @ApiProperty({ description: 'Email opt-in' })
  emailOptIn!: boolean;

  @ApiProperty({ description: 'SMS opt-in' })
  smsOptIn!: boolean;

  @ApiProperty({ description: 'WhatsApp opt-in' })
  whatsappOptIn!: boolean;

  @ApiPropertyOptional({ description: 'Auth0 user ID (for online ordering)' })
  auth0UserId?: string | null;

  @ApiPropertyOptional({ description: 'Address' })
  address?: string | null;

  @ApiPropertyOptional({
    description: 'Organization relationships',
    type: [OrganizationCustomerResponseDto],
  })
  organizations?: OrganizationCustomerResponseDto[];

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt!: Date;
}
