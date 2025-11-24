import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { CurrentUser, Roles, requiresOrganization } from '../auth/decorators';
import { UserRole } from '../auth/enums/user-role.enum';
import { ClerkGuard, RolesGuard } from '../auth/guards';
import type { UserPayload } from '../auth/interfaces';

import { BranchMenuService } from './branch-menu.service';
import { CreateBranchMenuDto, UpdateBranchMenuDto } from './dto';

@ApiTags('Branch Menu')
@ApiBearerAuth('Auth0')
@Controller('branch')
@UseGuards(ClerkGuard)
export class BranchMenuController {
  constructor(private readonly branchMenuService: BranchMenuService) {}

  @Post(':branchId/menu')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Link menu item to branch',
    description: 'Creates a link between a menu item and a branch',
  })
  @ApiParam({ name: 'branchId', description: 'Branch UUID' })
  @ApiResponse({ status: 201, description: 'Menu item linked successfully' })
  create(
    @Param('branchId') branchId: string,
    @Body() createBranchMenuDto: CreateBranchMenuDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.branchMenuService.createBranchMenuLink(
      branchId,
      createBranchMenuDto.menuItemId,
      user.organizationId,
    );
  }

  @Get(':branchId/menu')
  @ApiOperation({
    summary: 'Get branch menu',
    description: 'Returns all menu items for a branch with overrides',
  })
  @ApiParam({ name: 'branchId', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch menu list' })
  findAll(
    @Param('branchId') branchId: string,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.branchMenuService.getBranchMenu(branchId, user.organizationId);
  }

  @Patch('menu/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Update branch menu override',
    description:
      'Updates branch-specific overrides. Price changes may require approval.',
  })
  @ApiParam({ name: 'id', description: 'Branch Menu UUID' })
  @ApiResponse({ status: 200, description: 'Branch menu updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateBranchMenuDto: UpdateBranchMenuDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.branchMenuService.updateBranchMenu(
      id,
      updateBranchMenuDto,
      user.organizationId,
    );
  }
}
