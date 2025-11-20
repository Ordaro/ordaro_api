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
import { Auth0Guard, RolesGuard } from '../auth/guards';
import type { UserPayload } from '../auth/interfaces';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

import { CreateRecipeDto, UpdateRecipeDto } from './dto';
import { RecipesService } from './recipes.service';

@ApiTags('Recipes')
@ApiBearerAuth('Auth0')
@Controller('recipes')
@UseGuards(Auth0Guard)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Create new recipe',
    description:
      'Creates a new recipe with ingredients and calculates costs automatically.',
  })
  @ApiResponse({ status: 201, description: 'Recipe created successfully' })
  create(
    @Body() createRecipeDto: CreateRecipeDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.recipesService.createRecipe(
      createRecipeDto,
      user.organizationId,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List all recipes',
    description: 'Returns paginated list of recipes',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of recipes' })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query() paginationQuery: PaginationQueryDto,
  ) {
    requiresOrganization(user);
    return this.recipesService.listRecipes(
      user.organizationId,
      paginationQuery,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get recipe details',
    description: 'Retrieve detailed recipe with ingredient snapshots',
  })
  @ApiParam({ name: 'id', description: 'Recipe UUID' })
  @ApiResponse({ status: 200, description: 'Recipe details' })
  @ApiResponse({ status: 404, description: 'Recipe not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.recipesService.getRecipeDetails(id, user.organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Update recipe',
    description:
      'Update recipe details. Recalculates costs if ingredients change.',
  })
  @ApiParam({ name: 'id', description: 'Recipe UUID' })
  @ApiResponse({ status: 200, description: 'Recipe updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updateRecipeDto: UpdateRecipeDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.recipesService.updateRecipe(
      id,
      updateRecipeDto,
      user.organizationId,
    );
  }

  @Post(':id/recalculate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Recalculate recipe cost',
    description:
      'Recalculates recipe cost using current ingredient prices and triggers menu updates',
  })
  @ApiParam({ name: 'id', description: 'Recipe UUID' })
  @ApiResponse({ status: 200, description: 'Recipe cost recalculated' })
  recalculate(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.recipesService.recalculateCost(id, user.organizationId);
  }

  @Post(':id/link-menu/:menuId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Link recipe to menu item',
    description: 'Links a recipe to a menu item and recalculates menu cost',
  })
  @ApiParam({ name: 'id', description: 'Recipe UUID' })
  @ApiParam({ name: 'menuId', description: 'Menu Item UUID' })
  @ApiResponse({ status: 200, description: 'Recipe linked successfully' })
  linkToMenu(
    @Param('id') id: string,
    @Param('menuId') menuId: string,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.recipesService.linkRecipeToMenu(
      id,
      menuId,
      user.organizationId,
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Delete recipe (soft delete)',
    description:
      'Marks recipe as inactive. Cannot delete if used in menu items.',
  })
  @ApiParam({ name: 'id', description: 'Recipe UUID' })
  @ApiResponse({ status: 200, description: 'Recipe deleted successfully' })
  remove(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.recipesService.deleteRecipe(id, user.organizationId);
  }
}
