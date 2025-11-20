import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * COGS Report
   */
  async cogsReport(
    companyId: string,
    from?: Date,
    to?: Date,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const where: Prisma.CogsLedgerWhereInput = {
      companyId: organization.id,
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const cogsEntries = await this.prismaService.cogsLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const totalCogs = cogsEntries.reduce(
      (sum, entry) => sum.add(entry.totalCost),
      new Prisma.Decimal(0),
    );

    // TODO: Calculate revenue from Order model when it's created
    const totalRevenue = new Prisma.Decimal(0);

    return {
      period: { from, to },
      totalEntries: cogsEntries.length,
      totalCogs: totalCogs.toString(),
      totalRevenue: totalRevenue.toString(),
      grossProfit: totalRevenue.sub(totalCogs).toString(),
      grossMargin: totalRevenue.gt(0)
        ? totalRevenue.sub(totalCogs).div(totalRevenue).toString()
        : '0',
      entries: cogsEntries.map((entry) => ({
        id: entry.id,
        orderId: entry.orderId,
        totalCost: entry.totalCost.toString(),
        revenue: '0', // TODO: Get from Order model when created
        createdAt: entry.createdAt,
      })),
    };
  }

  /**
   * Inventory Valuation
   */
  async inventoryValuation(companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const ingredients = await this.prismaService.ingredient.findMany({
      where: {
        companyId: organization.id,
        isActive: true,
      },
      include: {
        batches: {
          where: { isClosed: false },
        },
      },
    });

    const valuation = ingredients.map((ing) => {
      const totalValue = ing.batches.reduce(
        (sum, batch) => sum.add(batch.unitCost.mul(batch.remainingQty)),
        new Prisma.Decimal(0),
      );

      return {
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        totalStock: ing.totalStock.toString(),
        averageUnitCost: ing.averageUnitCost?.toString() ?? null,
        fifoUnitCost: ing.fifoUnitCost?.toString() ?? null,
        totalValue: totalValue.toString(),
        batchCount: ing.batches.length,
      };
    });

    const totalValuation = valuation.reduce(
      (sum, item) => sum.add(new Prisma.Decimal(item.totalValue)),
      new Prisma.Decimal(0),
    );

    return {
      totalValuation: totalValuation.toString(),
      ingredientCount: valuation.length,
      ingredients: valuation,
    };
  }

  /**
   * Menu Margin Report
   */
  async menuMarginReport(companyId: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const menuItems = await this.prismaService.menuItem.findMany({
      where: {
        companyId: organization.id,
        isActive: true,
      },
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
            totalCost: true,
            yieldQuantity: true,
          },
        },
      },
    });

    const report = menuItems.map((item) => {
      const margin = item.margin
        ? item.margin.mul(new Prisma.Decimal(100))
        : null;
      const marginPercent = margin?.toString() ?? null;

      return {
        menuItemId: item.id,
        name: item.name,
        basePrice: item.basePrice.toString(),
        computedCost: item.computedCost?.toString() ?? null,
        margin: marginPercent,
        marginValue: item.margin
          ? item.basePrice.sub(item.computedCost ?? new Prisma.Decimal(0))
          : null,
        totalOrders: item.totalOrders,
        totalRevenue: item.totalRevenue.toString(),
        recipeName: item.recipe?.name ?? null,
      };
    });

    // Calculate averages
    const itemsWithMargin = report.filter((r) => r.margin !== null);
    const avgMargin =
      itemsWithMargin.length > 0
        ? itemsWithMargin.reduce(
            (sum, r) => sum + Number.parseFloat(r.margin ?? '0'),
            0,
          ) / itemsWithMargin.length
        : 0;

    return {
      totalMenuItems: report.length,
      averageMargin: avgMargin.toFixed(2),
      items: report,
    };
  }

  /**
   * Ingredient Cost Fluctuation
   */
  async ingredientCostFluctuation(
    companyId: string,
    ingredientId: string,
    periodDays = 30,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { auth0OrgId: companyId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const ingredient = await this.prismaService.ingredient.findFirst({
      where: {
        id: ingredientId,
        companyId: organization.id,
      },
    });

    if (!ingredient) {
      throw new NotFoundException('Ingredient not found');
    }

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - periodDays);

    const costHistory = await this.prismaService.ingredientCostHistory.findMany(
      {
        where: {
          ingredientId,
          recordedAt: { gte: fromDate },
        },
        orderBy: { recordedAt: 'asc' },
      },
    );

    const currentCost = ingredient.fifoUnitCost ?? ingredient.averageUnitCost;

    const trend =
      costHistory.length > 1
        ? (() => {
            const firstEntry = costHistory[0];
            const lastEntry = costHistory[costHistory.length - 1];
            if (!firstEntry || !lastEntry) {
              return null;
            }
            const first = firstEntry.unitCost;
            const last = lastEntry.unitCost;
            const change = last.sub(first);
            const percentChange = first.gt(0)
              ? change.div(first).mul(100)
              : new Prisma.Decimal(0);
            return {
              change: change.toString(),
              percentChange: percentChange.toString(),
              direction: change.gt(0) ? 'up' : change.lt(0) ? 'down' : 'stable',
            };
          })()
        : null;

    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      currentCost: currentCost?.toString() ?? null,
      periodDays,
      history: costHistory.map((h) => ({
        id: h.id,
        unitCost: h.unitCost.toString(),
        recordedAt: h.recordedAt,
      })),
      trend,
    };
  }
}
