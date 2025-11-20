import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { CurrentUser, Roles, requiresOrganization } from '../auth/decorators';
import { UserRole } from '../auth/enums/user-role.enum';
import { Auth0Guard, RolesGuard } from '../auth/guards';
import type { UserPayload } from '../auth/interfaces';

import { CompanySettingsService } from './company-settings.service';
import { UpdateSettingsDto } from './dto';

@ApiTags('Company Settings')
@ApiBearerAuth('Auth0')
@Controller('settings')
@UseGuards(Auth0Guard)
export class CompanySettingsController {
  constructor(
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get company settings',
    description: 'Returns menu management settings for the organization',
  })
  @ApiResponse({ status: 200, description: 'Company settings' })
  getSettings(@CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.companySettingsService.getSettings(user.organizationId);
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Update company settings',
    description: 'Updates menu management settings. Owner role only.',
  })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  update(
    @Body() updateSettingsDto: UpdateSettingsDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.companySettingsService.updateSettings(
      user.organizationId,
      updateSettingsDto,
    );
  }
}
