import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
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
import { PaginationQueryDto } from '../common/dto/pagination.dto';

import {
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateVariantDto,
  AttachRecipeDto,
} from './dto';
import { MenuService } from './menu.service';

@ApiTags('Menu Items')
@ApiBearerAuth('Auth0')
@Controller('menu-items')
@UseGuards(ClerkGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Create new menu item',
    description:
      'Creates a new menu item. Can optionally link a recipe for cost calculation.',
  })
  @ApiResponse({ status: 201, description: 'Menu item created successfully' })
  create(
    @Body() createMenuItemDto: CreateMenuItemDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.menuService.createMenuItem(
      createMenuItemDto,
      user.organizationId,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List all menu items',
    description:
      'Returns paginated list of menu items. Optionally filter by branch for overrides.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of menu items' })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query('branchId') branchId?: string,
    @Query() paginationQuery?: PaginationQueryDto,
  ) {
    requiresOrganization(user);
    return this.menuService.getAllMenuItems(
      user.organizationId,
      branchId,
      paginationQuery,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get menu item details',
    description:
      'Retrieve detailed menu item with variants and branch-specific data',
  })
  @ApiParam({ name: 'id', description: 'Menu Item UUID' })
  @ApiResponse({ status: 200, description: 'Menu item details' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload,
    @Query('branchId') branchId?: string,
  ) {
    requiresOrganization(user);
    return this.menuService.getMenuItemById(id, user.organizationId, branchId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Update menu item',
    description:
      'Update menu item details. Recalculates costs if recipe or price changes.',
  })
  @ApiParam({ name: 'id', description: 'Menu Item UUID' })
  @ApiResponse({ status: 200, description: 'Menu item updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateMenuItemDto: UpdateMenuItemDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.menuService.updateMenuItem(
      id,
      updateMenuItemDto,
      user.organizationId,
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Delete menu item (soft delete)',
    description: 'Marks menu item as inactive',
  })
  @ApiParam({ name: 'id', description: 'Menu Item UUID' })
  @ApiResponse({ status: 200, description: 'Menu item deleted successfully' })
  remove(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.menuService.deleteMenuItem(id, user.organizationId);
  }

  @Post(':id/variants')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Create menu variant',
    description: 'Creates a variant (e.g., Small, Large) for a menu item',
  })
  @ApiParam({ name: 'id', description: 'Menu Item UUID' })
  @ApiResponse({ status: 201, description: 'Variant created successfully' })
  createVariant(
    @Param('id') id: string,
    @Body() createVariantDto: CreateVariantDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.menuService.createVariant(
      id,
      createVariantDto,
      user.organizationId,
    );
  }

  @Post(':id/attach-recipe')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Attach recipe to menu item',
    description: 'Links a recipe to a menu item and recalculates cost',
  })
  @ApiParam({ name: 'id', description: 'Menu Item UUID' })
  @ApiResponse({ status: 200, description: 'Recipe attached successfully' })
  attachRecipe(
    @Param('id') id: string,
    @Body() attachRecipeDto: AttachRecipeDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.menuService.attachRecipe(
      id,
      attachRecipeDto,
      user.organizationId,
    );
  }
}
