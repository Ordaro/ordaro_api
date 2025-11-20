import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PaginationService } from '../common/services/pagination.service';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../services/cache';
import { ORDARO_JOB_TYPES } from '../services/queue/job-types.enum';
import { QueueService } from '../services/queue/queue.service';

import { CreateIngredientDto, UpdateIngredientDto } from './dto';

@Injectable()
export class IngredientsService {
  private readonly logger = new Logger(IngredientsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly cacheService: CacheService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Create a new ingredient
   */
  async createIngredient(
    dto: CreateIngredientDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Check if ingredient name already exists in this organization
    const existing = await this.prismaService.ingredient.findFirst({
      where: {
        companyId: organization.id,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        'An ingredient with this name already exists in your organization',
      );
    }

    // Validate initial stock and cost
    if (
      (dto.initialStock !== undefined && dto.initialCost === undefined) ||
      (dto.initialCost !== undefined && dto.initialStock === undefined)
    ) {
      throw new BadRequestException(
        'Both initialStock and initialCost must be provided together',
      );
    }

    // Create ingredient
    const ingredient = await this.prismaService.ingredient.create({
      data: {
        name: dto.name,
        unit: dto.unit,
        reorderThreshold: dto.reorderThreshold
          ? new Prisma.Decimal(dto.reorderThreshold)
          : null,
        companyId: organization.id,
        totalStock: dto.initialStock
          ? new Prisma.Decimal(dto.initialStock)
          : new Prisma.Decimal(0),
        averageUnitCost: dto.initialCost
          ? new Prisma.Decimal(dto.initialCost)
          : null,
        fifoUnitCost: dto.initialCost
          ? new Prisma.Decimal(dto.initialCost)
          : null,
      },
    });

    // If initial stock provided, create cost history entry
    if (dto.initialStock && dto.initialCost) {
      await this.prismaService.ingredientCostHistory.create({
        data: {
          ingredientId: ingredient.id,
          unitCost: new Prisma.Decimal(dto.initialCost),
          reason: 'Initial Setup',
        },
      });
    }

    this.logger.log(
      `Ingredient created: ${ingredient.id} in organization ${organization.id}`,
    );

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return ingredient;
  }

  /**
   * Update ingredient
   */
  async updateIngredient(
    id: string,
    dto: UpdateIngredientDto,
    companyId: string,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const ingredient = await this.prismaService.ingredient.findFirst({
      where: {
        id,
        companyId: organization.id,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    // If name is being updated, check for conflicts
    if (dto.name && dto.name !== ingredient.name) {
      const existing = await this.prismaService.ingredient.findFirst({
        where: {
          companyId: organization.id,
          name: dto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(
          'An ingredient with this name already exists in your organization',
        );
      }
    }

    // Track if unit cost changed
    const oldUnitCost = ingredient.averageUnitCost;
    const newUnitCost = dto.unitCost
      ? new Prisma.Decimal(dto.unitCost)
      : ingredient.averageUnitCost;

    const costChanged =
      dto.unitCost !== undefined &&
      oldUnitCost !== null &&
      newUnitCost !== null &&
      !oldUnitCost.equals(newUnitCost);

    // Update ingredient
    const updated = await this.prismaService.ingredient.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.unit && { unit: dto.unit }),
        ...(dto.reorderThreshold !== undefined && {
          reorderThreshold: new Prisma.Decimal(dto.reorderThreshold),
        }),
        ...(dto.unitCost !== undefined && {
          averageUnitCost: newUnitCost,
          fifoUnitCost: newUnitCost,
        }),
      },
    });

    // If cost changed, create cost history entry and enqueue cost update job
    if (costChanged && newUnitCost) {
      await this.prismaService.ingredientCostHistory.create({
        data: {
          ingredientId: ingredient.id,
          unitCost: newUnitCost,
          reason: 'Manual Price Update',
        },
      });

      // Enqueue ingredient cost update job
      await this.queueService.addJob(ORDARO_JOB_TYPES.INGREDIENT_COST_UPDATE, {
        ingredientId: ingredient.id,
      });
    }

    this.logger.log(`Ingredient updated: ${id}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return updated;
  }

  /**
   * List all ingredients for a company
   */
  async listIngredients(
    companyId: string,
    paginationQuery: PaginationQueryDto,
  ): Promise<unknown> {
    const { limit = 20, cursor, orderDir = 'desc' } = paginationQuery;

    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    let cursorCondition = {};
    if (cursor) {
      const decodedCursor = this.paginationService.decodeCursor(cursor);
      if (decodedCursor && typeof decodedCursor.tieBreakerValue === 'string') {
        cursorCondition = {
          id:
            orderDir === 'desc'
              ? { lt: decodedCursor.tieBreakerValue }
              : { gt: decodedCursor.tieBreakerValue },
        };
      }
    }

    const ingredients = await this.prismaService.ingredient.findMany({
      where: {
        companyId: organization.id,
        isActive: true,
        ...cursorCondition,
      },
      orderBy: { createdAt: orderDir },
      take: limit + 1,
    });

    return this.paginationService.buildPaginatedResponse(ingredients, limit, {
      cursorField: 'id',
      additionalCursorFields: ['createdAt'],
    });
  }

  /**
   * Get ingredient by ID with full details
   */
  async getIngredientById(id: string, companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const ingredient = await this.prismaService.ingredient.findFirst({
      where: {
        id,
        companyId: organization.id,
      },
      include: {
        batches: {
          where: { isClosed: false },
          orderBy: { createdAt: 'asc' },
          take: 10,
        },
        costHistory: {
          orderBy: { recordedAt: 'desc' },
          take: 20,
        },
        _count: {
          select: {
            recipeIngredients: true,
          },
        },
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    return ingredient;
  }

  /**
   * Delete ingredient (soft delete)
   */
  async deleteIngredient(id: string, companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const ingredient = await this.prismaService.ingredient.findFirst({
      where: {
        id,
        companyId: organization.id,
      },
      include: {
        _count: {
          select: {
            recipeIngredients: true,
          },
        },
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    // Check if ingredient is used in recipes
    if (ingredient._count.recipeIngredients > 0) {
      throw new ConflictException(
        'Cannot delete ingredient that is used in recipes',
      );
    }

    // Soft delete
    const result = await this.prismaService.ingredient.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Ingredient deleted: ${id}`);

    // Invalidate cache
    await this.cacheService.invalidateOrganization(companyId);

    return result;
  }
}
