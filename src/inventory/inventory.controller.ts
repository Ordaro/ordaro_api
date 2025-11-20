import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { Prisma } from '../../generated/prisma';
import { CurrentUser, Roles, requiresOrganization } from '../auth/decorators';
import { UserRole } from '../auth/enums/user-role.enum';
import { Auth0Guard, RolesGuard } from '../auth/guards';
import type { UserPayload } from '../auth/interfaces';
import { PrismaService } from '../database/prisma.service';

import { StockEntryDto, AdjustStockDto, DeductStockDto } from './dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth('Auth0')
@Controller('inventory')
@UseGuards(Auth0Guard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly prismaService: PrismaService,
  ) {}

  @Post('stock-entry')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Record stock entry (purchase)',
    description: 'Records a stock purchase and creates a new batch',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock entry recorded successfully',
  })
  recordStockEntry(
    @Body() stockEntryDto: StockEntryDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.inventoryService.recordStockEntry(
      stockEntryDto,
      user.organizationId,
    );
  }

  @Post('adjust')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Adjust stock manually',
    description: 'Manually adjust stock quantity (positive or negative)',
  })
  @ApiResponse({ status: 200, description: 'Stock adjusted successfully' })
  adjustStock(
    @Body() adjustStockDto: AdjustStockDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.inventoryService.adjustStock(
      adjustStockDto,
      user.organizationId,
    );
  }

  @Post('deduct')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.CHEF)
  @ApiOperation({
    summary: 'Deduct stock (FIFO)',
    description:
      'Deducts stock using FIFO algorithm. Used for orders or consumption.',
  })
  @ApiResponse({ status: 200, description: 'Stock deducted successfully' })
  deductStock(
    @Body() deductStockDto: DeductStockDto,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    const options: {
      orderId?: string;
      recipeId?: string;
      reason?: string;
    } = {};
    if (deductStockDto.orderId) {
      options.orderId = deductStockDto.orderId;
    }
    if (deductStockDto.recipeId) {
      options.recipeId = deductStockDto.recipeId;
    }
    if (deductStockDto.reason) {
      options.reason = deductStockDto.reason;
    }
    return this.inventoryService.deductStock(
      deductStockDto.ingredientId,
      new Prisma.Decimal(deductStockDto.qty),
      options,
      user.organizationId,
    );
  }

  @Get('ingredient/:ingredientId')
  @ApiOperation({
    summary: 'Get ingredient stock status',
    description: 'Returns stock information with active batches',
  })
  @ApiParam({ name: 'ingredientId', description: 'Ingredient UUID' })
  @ApiResponse({ status: 200, description: 'Ingredient stock status' })
  getIngredientStock(
    @Param('ingredientId') ingredientId: string,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    return this.inventoryService.getIngredientStock(
      ingredientId,
      user.organizationId,
    );
  }

  @Get('alerts')
  @ApiOperation({
    summary: 'Get low stock alerts',
    description: 'Returns ingredients below reorder threshold',
  })
  @ApiResponse({ status: 200, description: 'Low stock alerts' })
  getLowStockAlerts(@CurrentUser() user: UserPayload) {
    requiresOrganization(user);
    return this.inventoryService.getLowStockAlerts(user.organizationId);
  }

  @Get('batches/:ingredientId')
  @ApiOperation({
    summary: 'List batches for ingredient',
    description: 'Returns all batches (including closed) for an ingredient',
  })
  @ApiParam({ name: 'ingredientId', description: 'Ingredient UUID' })
  @ApiResponse({ status: 200, description: 'Ingredient batches' })
  async listBatches(
    @Param('ingredientId') ingredientId: string,
    @CurrentUser() user: UserPayload,
  ) {
    requiresOrganization(user);
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: user.organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const ingredient = await this.prismaService.ingredient.findFirst({
      where: {
        id: ingredientId,
        companyId: organization.id,
      },
      include: {
        batches: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    return ingredient.batches;
  }
}
