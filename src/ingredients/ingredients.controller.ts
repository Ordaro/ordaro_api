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

import { CreateIngredientDto, UpdateIngredientDto } from './dto';
import { IngredientsService } from './ingredients.service';

@ApiTags('Ingredients')
@ApiBearerAuth('Auth0')
@Controller('ingredients')
@UseGuards(Auth0Guard)
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  /**
   * Create a new ingredient
   * Only Owners and Managers can create ingredients
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Create new ingredient',
    description:
      'Creates a new ingredient. Owner and Manager roles only. Optionally set initial stock and cost.',
  })
  @ApiResponse({
    status: 201,
    description: 'Ingredient created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Ingredient name already exists',
  })
  create(
    @Body() createIngredientDto: CreateIngredientDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.ingredientsService.createIngredient(
      createIngredientDto,
      user.organizationId,
    );
  }

  /**
   * Get all ingredients accessible to the user
   */
  @Get()
  @ApiOperation({
    summary: 'List all ingredients',
    description: 'Returns paginated list of ingredients for the organization',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of ingredients',
  })
  findAll(
    @CurrentUser() user: UserPayload,
    @Query() paginationQuery: PaginationQueryDto,
  ) {
    requiresOrganization(user);
    return this.ingredientsService.listIngredients(
      user.organizationId,
      paginationQuery,
    );
  }

  /**
   * Get ingredient by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get ingredient details',
    description: 'Retrieve detailed information about a specific ingredient',
  })
  @ApiParam({ name: 'id', description: 'Ingredient UUID' })
  @ApiResponse({
    status: 200,
    description: 'Ingredient details',
  })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.ingredientsService.getIngredientById(id, user.organizationId);
  }

  /**
   * Update ingredient
   * Only Owners and Managers can update ingredients
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Update ingredient',
    description:
      'Update ingredient details. Owner and Manager roles only. Updating unitCost will trigger cost recalculation for all recipes using this ingredient.',
  })
  @ApiParam({ name: 'id', description: 'Ingredient UUID' })
  @ApiResponse({
    status: 200,
    description: 'Ingredient updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  update(
    @Param('id') id: string,
    @Body() updateIngredientDto: UpdateIngredientDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.ingredientsService.updateIngredient(
      id,
      updateIngredientDto,
      user.organizationId,
    );
  }

  /**
   * Delete ingredient (soft delete)
   * Only Owners can delete ingredients
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Delete ingredient (soft delete)',
    description:
      'Marks an ingredient as inactive. Owner role only. Cannot delete if ingredient is used in recipes.',
  })
  @ApiParam({ name: 'id', description: 'Ingredient UUID' })
  @ApiResponse({
    status: 200,
    description: 'Ingredient deleted successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  @ApiResponse({ status: 404, description: 'Ingredient not found' })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Ingredient is used in recipes',
  })
  remove(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.ingredientsService.deleteIngredient(id, user.organizationId);
  }
}
