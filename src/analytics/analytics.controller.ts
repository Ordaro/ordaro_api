import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
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

import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth('Auth0')
@Controller('analytics')
@UseGuards(Auth0Guard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('cogs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'COGS Report',
    description:
      'Returns COGS report with total costs, revenue, and profit margins',
  })
  @ApiQuery({ name: 'from', required: false, type: Date })
  @ApiQuery({ name: 'to', required: false, type: Date })
  @ApiResponse({ status: 200, description: 'COGS report' })
  cogsReport(
    @CurrentUser() user: UserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    requiresOrganization(user);
    return this.analyticsService.cogsReport(
      user.organizationId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('inventory-value')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Inventory Valuation',
    description: 'Returns total inventory value by ingredient',
  })
  @ApiResponse({ status: 200, description: 'Inventory valuation report' })
  inventoryValuation(@CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.analyticsService.inventoryValuation(user.organizationId);
  }

  @Get('menu-margins')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Menu Margin Report',
    description: 'Returns margin analysis per menu item',
  })
  @ApiResponse({ status: 200, description: 'Menu margin report' })
  menuMarginReport(@CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.analyticsService.menuMarginReport(user.organizationId);
  }

  @Get('ingredient-costs/:ingredientId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Ingredient Cost Fluctuation',
    description: 'Returns cost trend analysis for an ingredient',
  })
  @ApiParam({ name: 'ingredientId', description: 'Ingredient UUID' })
  @ApiQuery({ name: 'periodDays', required: false, type: Number, default: 30 })
  @ApiResponse({ status: 200, description: 'Cost fluctuation report' })
  ingredientCostFluctuation(
    @Param('ingredientId') ingredientId: string,
    @CurrentUser() user: UserPayload,
    @Query('periodDays', new ParseIntPipe({ optional: true }))
    periodDays?: number,
  ) {
    requiresOrganization(user);
    return this.analyticsService.ingredientCostFluctuation(
      user.organizationId,
      ingredientId,
      periodDays ?? 30,
    );
  }
}
