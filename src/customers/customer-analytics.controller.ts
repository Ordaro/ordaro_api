import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { CurrentUser, Roles, requiresOrganization } from '../auth/decorators';
import { UserRole } from '../auth/enums/user-role.enum';
import { Auth0Guard, RolesGuard } from '../auth/guards';
import type { UserPayload } from '../auth/interfaces';

import { CustomerAnalyticsService } from './services/customer-analytics.service';

@ApiTags('Customer Analytics')
@ApiBearerAuth('Auth0')
@Controller('customers/analytics')
@UseGuards(Auth0Guard)
export class CustomerAnalyticsController {
  constructor(
    private readonly customerAnalyticsService: CustomerAnalyticsService,
  ) {}

  @Get('branch/:branchId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get branch customer analytics',
    description: 'Returns customer analytics for a specific branch',
  })
  @ApiParam({ name: 'branchId', description: 'Branch UUID' })
  @ApiQuery({ name: 'from', required: false, type: Date })
  @ApiQuery({ name: 'to', required: false, type: Date })
  @ApiResponse({ status: 200, description: 'Branch customer analytics' })
  getBranchAnalytics(
    @Param('branchId') branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.customerAnalyticsService.getBranchCustomerAnalytics(branchId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    } as { from: Date; to: Date } | undefined);
  }

  @Get('company')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get company customer analytics',
    description: 'Returns customer analytics aggregated across all branches',
  })
  @ApiQuery({ name: 'from', required: false, type: Date })
  @ApiQuery({ name: 'to', required: false, type: Date })
  @ApiResponse({ status: 200, description: 'Company customer analytics' })
  getCompanyAnalytics(
    @CurrentUser() user: UserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    requiresOrganization(user);
    return this.customerAnalyticsService.getCompanyCustomerAnalytics(
      user.organizationId,
      {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      } as { from: Date; to: Date } | undefined,
    );
  }

  @Get('customer/:customerId/insights')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get customer insights',
    description: 'Returns detailed insights for a specific customer',
  })
  @ApiParam({ name: 'customerId', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer insights' })
  getCustomerInsights(
    @Param('customerId') customerId: string,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.customerAnalyticsService.getCustomerInsights(
      customerId,
      user.organizationId,
    );
  }
}
