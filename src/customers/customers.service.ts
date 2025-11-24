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

import {
  CreateCustomerDto,
  SearchCustomerDto,
  UpdateCustomerDto,
  FindOrCreateCustomerDto,
} from './dto';
import {
  normalizeEmail,
  normalizePhone,
  validateEmail,
  validatePhone,
} from './utils/customer-utils';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paginationService: PaginationService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Find or create customer (main POS flow)
   */
  async findOrCreateCustomer(dto: FindOrCreateCustomerDto): Promise<unknown> {
    const { organizationId, branchId, ...searchData } = dto;

    // Validate organization exists
    const organization = await this.prismaService.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Search for existing customer
    const foundCustomer = (await this.searchCustomer(searchData)) as {
      id: string;
    } | null;

    let customer: { id: string };
    if (!foundCustomer) {
      // Create new customer
      customer = (await this.createCustomer(searchData)) as { id: string };
    } else {
      customer = foundCustomer;
    }

    // Link to organization if not already linked
    await this.linkCustomerToOrganization(
      customer.id,
      organizationId,
      branchId,
    );

    // Return customer with organization relationship
    return this.getCustomerById(customer.id, organizationId);
  }

  /**
   * Search for customer by email or phone
   */

  async searchCustomer(
    searchData: SearchCustomerDto,
  ): Promise<null | Prisma.TransactionCustomerGetPayload<null>> {
    // Normalize search criteria
    const normalizedEmail = searchData.email
      ? normalizeEmail(searchData.email)
      : null;
    const normalizedPhone = searchData.phone
      ? normalizePhone(searchData.phone)
      : null;

    if (!normalizedEmail && !normalizedPhone) {
      return null;
    }

    // Search by email (exact match after normalization)
    if (normalizedEmail) {
      const customer = await this.prismaService.transactionCustomer.findUnique({
        where: { email: normalizedEmail },
      });

      if (customer) {
        return customer;
      }
    }

    // Search by phone (normalized)
    if (normalizedPhone) {
      // Find customers with phone numbers that match when normalized
      const customers = await this.prismaService.transactionCustomer.findMany({
        where: {
          phone: { not: null },
        },
      });

      // Filter by normalized phone match
      for (const customer of customers) {
        if (
          customer.phone &&
          normalizePhone(customer.phone) === normalizedPhone
        ) {
          return customer;
        }
      }
    }

    return null;
  }

  /**
   * Create new customer
   */
  async createCustomer(dto: CreateCustomerDto): Promise<unknown> {
    // Validate email if provided
    if (dto.email && !validateEmail(dto.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate phone if provided
    if (dto.phone && !validatePhone(dto.phone)) {
      throw new BadRequestException('Invalid phone format');
    }

    // At least email or phone must be provided
    if (!dto.email && !dto.phone) {
      throw new BadRequestException(
        'Either email or phone number must be provided',
      );
    }

    // Normalize email and phone
    const normalizedEmail = dto.email ? normalizeEmail(dto.email) : null;
    const normalizedPhone = dto.phone ? normalizePhone(dto.phone) : null;

    // Check for existing customer with same email or phone
    if (normalizedEmail) {
      const existing = await this.prismaService.transactionCustomer.findUnique({
        where: { email: normalizedEmail },
      });

      if (existing) {
        throw new ConflictException('Customer with this email already exists');
      }
    }

    if (normalizedPhone) {
      // Check for existing phone (need to normalize all and compare)
      const customers = await this.prismaService.transactionCustomer.findMany({
        where: { phone: { not: null } },
      });

      for (const customer of customers) {
        if (
          customer.phone &&
          normalizePhone(customer.phone) === normalizedPhone
        ) {
          throw new ConflictException(
            'Customer with this phone number already exists',
          );
        }
      }
    }

    // Create customer
    const customer = await this.prismaService.transactionCustomer.create({
      data: {
        email: normalizedEmail,
        phone: normalizedPhone,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        fullName: dto.fullName ?? null,
        emailOptIn: true, // Default opt-in for receipts
        smsOptIn: true, // Default opt-in for SMS
        whatsappOptIn: false, // Default opt-out for WhatsApp
      },
    });

    // Create default consent record
    await this.prismaService.customerConsent.create({
      data: {
        customerId: customer.id,
        marketingEmails: false,
        smsNotifications: true,
        whatsappMessages: false,
        dataProcessing: true, // Required for orders
        consentMethod: 'POS',
      },
    });

    this.logger.log(`Customer created: ${customer.id}`);

    return customer;
  }

  /**
   * Link customer to organization
   */
  async linkCustomerToOrganization(
    customerId: string,
    organizationId: string,
    branchId?: string,
  ): Promise<unknown> {
    // Check if link already exists
    const existing = await this.prismaService.organizationCustomer.findUnique({
      where: {
        customerId_organizationId: {
          customerId,
          organizationId,
        },
      },
    });

    if (existing) {
      // Update branch if provided and different
      if (branchId && existing.branchId !== branchId) {
        return this.prismaService.organizationCustomer.update({
          where: { id: existing.id },
          data: { branchId },
        });
      }

      return existing;
    }

    // Validate organization exists
    const organization = await this.prismaService.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Validate branch if provided
    if (branchId) {
      const branch = await this.prismaService.branch.findFirst({
        where: {
          id: branchId,
          organizationId,
        },
      });

      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
    }

    // Create link
    const link = await this.prismaService.organizationCustomer.create({
      data: {
        customerId,
        organizationId,
        branchId: branchId ?? null,
        loyaltyPoints: new Prisma.Decimal(0),
        totalOrders: 0,
        totalSpent: new Prisma.Decimal(0),
        averageOrderValue: new Prisma.Decimal(0),
      },
    });

    this.logger.log(
      `Customer ${customerId} linked to organization ${organizationId}`,
    );

    return link;
  }

  /**
   * Update customer
   */
  async updateCustomer(
    id: string,
    dto: UpdateCustomerDto,
    organizationId?: string,
  ): Promise<unknown> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Normalize email and phone if provided
    const normalizedEmail = dto.email
      ? normalizeEmail(dto.email)
      : customer.email;
    const normalizedPhone = dto.phone
      ? normalizePhone(dto.phone)
      : customer.phone;

    // Validate email if changed
    if (dto.email && normalizedEmail !== customer.email && normalizedEmail) {
      if (!validateEmail(dto.email)) {
        throw new BadRequestException('Invalid email format');
      }

      // Check for conflicts
      const existing = await this.prismaService.transactionCustomer.findUnique({
        where: { email: normalizedEmail },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Customer with this email already exists');
      }
    }

    // Validate phone if changed
    if (dto.phone && normalizedPhone !== customer.phone) {
      if (!validatePhone(dto.phone)) {
        throw new BadRequestException('Invalid phone format');
      }

      // Check for conflicts (normalize and compare)
      const customers = await this.prismaService.transactionCustomer.findMany({
        where: {
          phone: { not: null },
          id: { not: id },
        },
      });

      for (const existing of customers) {
        if (
          existing.phone &&
          normalizePhone(existing.phone) === normalizedPhone
        ) {
          throw new ConflictException(
            'Customer with this phone number already exists',
          );
        }
      }
    }

    // Update customer
    const updated = await this.prismaService.transactionCustomer.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && {
          firstName: dto.firstName ?? null,
        }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName ?? null }),
        ...(dto.fullName !== undefined && { fullName: dto.fullName ?? null }),
        ...(dto.email !== undefined && { email: normalizedEmail }),
        ...(dto.phone !== undefined && { phone: normalizedPhone }),
        ...(dto.address !== undefined && { address: dto.address ?? null }),
        ...(dto.emailOptIn !== undefined && { emailOptIn: dto.emailOptIn }),
        ...(dto.smsOptIn !== undefined && { smsOptIn: dto.smsOptIn }),
        ...(dto.whatsappOptIn !== undefined && {
          whatsappOptIn: dto.whatsappOptIn,
        }),
      },
    });

    this.logger.log(`Customer updated: ${id}`);

    // Invalidate cache
    if (organizationId) {
      await this.cacheService.invalidateOrganization(organizationId);
    }

    return updated;
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(id: string, organizationId?: string): Promise<unknown> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { id },
      include: {
        organizationCustomers: organizationId
          ? {
              where: { organizationId },
            }
          : true,
        preferences: organizationId
          ? {
              where: { organizationId },
            }
          : true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  /**
   * Get customer by Clerk user ID (for online ordering)
   */
  async getCustomerByClerk(
    clerkUserId: string,
  ): Promise<null | Prisma.TransactionCustomerGetPayload<{
    include: {
      organizationCustomers: true;
      preferences: true;
    };
  }>> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { clerkUserId },
      include: {
        organizationCustomers: true,
        preferences: true,
      },
    });

    return customer;
  }

  /**
   * Create customer from Clerk user (online ordering)
   */
  async createCustomerFromClerk(
    clerkUserId: string,
    clerkEmail: string,
    clerkName: string | undefined,
    organizationId: string,
  ): Promise<unknown> {
    // Check if customer already exists by email
    const normalizedEmail = normalizeEmail(clerkEmail);
    let customer = await this.prismaService.transactionCustomer.findUnique({
      where: { email: normalizedEmail },
    });

    if (customer) {
      // Link Clerk if not already linked
      if (!customer.clerkUserId) {
        customer = await this.prismaService.transactionCustomer.update({
          where: { id: customer.id },
          data: {
            clerkUserId,
            emailVerified: true,
          },
        });
      }

      // Link to organization
      await this.linkCustomerToOrganization(customer.id, organizationId);
      return customer;
    }

    // Check if customer exists by Clerk ID
    customer = await this.prismaService.transactionCustomer.findUnique({
      where: { clerkUserId },
    });

    if (customer) {
      // Link to organization
      await this.linkCustomerToOrganization(customer.id, organizationId);
      return customer;
    }

    // Parse name
    const nameParts = clerkName?.split(' ') ?? [];
    const firstName = nameParts[0] ?? null;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

    // Create new customer
    customer = await this.prismaService.transactionCustomer.create({
      data: {
        email: normalizedEmail,
        clerkUserId,
        firstName,
        lastName,
        fullName: clerkName ?? null,
        emailVerified: true,
        emailOptIn: true,
        smsOptIn: true,
        whatsappOptIn: false,
      },
    });

    // Create consent record
    await this.prismaService.customerConsent.create({
      data: {
        customerId: customer.id,
        marketingEmails: false,
        smsNotifications: true,
        whatsappMessages: false,
        dataProcessing: true,
        consentMethod: 'ONLINE',
      },
    });

    // Link to organization
    await this.linkCustomerToOrganization(customer.id, organizationId);

    this.logger.log(
      `Customer created from Clerk: ${customer.id} for organization ${organizationId}`,
    );

    return customer;
  }

  /**
   * Link Clerk to existing customer
   */
  async linkClerkToCustomer(
    clerkUserId: string,
    customerId: string,
  ): Promise<unknown> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check if Clerk ID already linked to another customer
    if (clerkUserId) {
      const existing = await this.prismaService.transactionCustomer.findUnique({
        where: { clerkUserId },
      });

      if (existing && existing.id !== customerId) {
        throw new ConflictException(
          'This Clerk account is already linked to another customer',
        );
      }
    }

    const updated = await this.prismaService.transactionCustomer.update({
      where: { id: customerId },
      data: {
        clerkUserId,
        emailVerified: true,
      },
    });

    this.logger.log(`Clerk ${clerkUserId} linked to customer ${customerId}`);

    return updated;
  }

  /**
   * List customers with pagination
   */
  async listCustomers(
    organizationId: string,
    paginationQuery?: PaginationQueryDto,
  ): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const { limit = 20, cursor, orderDir = 'desc' } = paginationQuery ?? {};

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

    const customers = await this.prismaService.transactionCustomer.findMany({
      where: {
        organizationCustomers: {
          some: {
            organizationId,
          },
        },
        ...cursorCondition,
      },
      include: {
        organizationCustomers: {
          where: { organizationId },
        },
      },
      orderBy: { createdAt: orderDir },
      take: limit + 1,
    });

    return this.paginationService.buildPaginatedResponse(customers, limit, {
      cursorField: 'id',
      additionalCursorFields: ['createdAt'],
    });
  }
}
