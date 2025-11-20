import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CustomerAnalyticsService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Get branch customer analytics
   */
  async getBranchCustomerAnalytics(
    branchId: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<unknown> {
    const branch = await this.prismaService.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const where: Prisma.OrganizationCustomerWhereInput = {
      branchId,
      ...(dateRange && {
        firstOrderAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      }),
    };

    const totalCustomers = await this.prismaService.organizationCustomer.count({
      where,
    });

    const newCustomers = await this.prismaService.organizationCustomer.count({
      where: {
        branchId,
        firstOrderAt: {
          gte:
            dateRange?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const topCustomers = await this.prismaService.organizationCustomer.findMany(
      {
        where: { branchId },
        orderBy: { totalSpent: 'desc' },
        take: 10,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    );

    const avgOrderValue =
      await this.prismaService.organizationCustomer.aggregate({
        where: { branchId },
        _avg: {
          averageOrderValue: true,
        },
      });

    return {
      branchId,
      period: dateRange,
      totalCustomers,
      newCustomers,
      topCustomers: topCustomers.map((oc) => ({
        customer: oc.customer,
        loyaltyPoints: oc.loyaltyPoints.toString(),
        totalOrders: oc.totalOrders,
        totalSpent: oc.totalSpent.toString(),
        averageOrderValue: oc.averageOrderValue.toString(),
        lastOrderAt: oc.lastOrderAt,
      })),
      averageOrderValue:
        avgOrderValue._avg.averageOrderValue?.toString() ?? '0',
    };
  }

  /**
   * Get company customer analytics
   */
  async getCompanyCustomerAnalytics(
    organizationId: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const where: Prisma.OrganizationCustomerWhereInput = {
      organizationId,
      ...(dateRange && {
        firstOrderAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      }),
    };

    const totalCustomers = await this.prismaService.organizationCustomer.count({
      where,
    });

    const newCustomers = await this.prismaService.organizationCustomer.count({
      where: {
        organizationId,
        firstOrderAt: {
          gte:
            dateRange?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const topCustomers = await this.prismaService.organizationCustomer.findMany(
      {
        where: { organizationId },
        orderBy: { totalSpent: 'desc' },
        take: 10,
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    );

    const avgOrderValue =
      await this.prismaService.organizationCustomer.aggregate({
        where: { organizationId },
        _avg: {
          averageOrderValue: true,
        },
      });

    const totalRevenue =
      await this.prismaService.organizationCustomer.aggregate({
        where: { organizationId },
        _sum: {
          totalSpent: true,
        },
      });

    return {
      organizationId,
      period: dateRange,
      totalCustomers,
      newCustomers,
      topCustomers: topCustomers.map((oc) => ({
        customer: oc.customer,
        branch: oc.branch,
        loyaltyPoints: oc.loyaltyPoints.toString(),
        totalOrders: oc.totalOrders,
        totalSpent: oc.totalSpent.toString(),
        averageOrderValue: oc.averageOrderValue.toString(),
        lastOrderAt: oc.lastOrderAt,
      })),
      averageOrderValue:
        avgOrderValue._avg.averageOrderValue?.toString() ?? '0',
      totalRevenue: totalRevenue._sum.totalSpent?.toString() ?? '0',
    };
  }

  /**
   * Get customer insights
   */
  async getCustomerInsights(
    customerId: string,
    organizationId: string,
  ): Promise<unknown> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { id: customerId },
      include: {
        organizationCustomers: {
          where: { organizationId },
        },
        preferences: {
          where: { organizationId },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const orgCustomer = customer.organizationCustomers[0];

    if (!orgCustomer) {
      throw new NotFoundException(
        'Customer is not associated with this organization',
      );
    }

    // TODO: Get order history when Order model is created
    // const orders = await this.getCustomerOrders(customerId, organizationId);

    return {
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
      },
      organizationStats: {
        loyaltyPoints: orgCustomer.loyaltyPoints.toString(),
        totalOrders: orgCustomer.totalOrders,
        totalSpent: orgCustomer.totalSpent.toString(),
        averageOrderValue: orgCustomer.averageOrderValue.toString(),
        firstOrderAt: orgCustomer.firstOrderAt,
        lastOrderAt: orgCustomer.lastOrderAt,
        isVIP: orgCustomer.isVIP,
        notes: orgCustomer.notes,
      },
      preferences: customer.preferences[0] ?? null,
      // orderHistory: orders,
    };
  }
}
