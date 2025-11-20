import { Injectable, NotFoundException, Logger } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { CustomerConsentDto, WithdrawConsentDto } from '../dto';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Record customer consent
   */
  async recordConsent(
    customerId: string,
    organizationId: string | null,
    dto: CustomerConsentDto,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<unknown> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Validate organization if provided
    if (organizationId) {
      const organization = await this.prismaService.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }
    }

    // Create or update consent record
    // Handle null organizationId for global consent
    const consentKey = organizationId ?? null;

    const existing = await this.prismaService.customerConsent.findFirst({
      where: {
        customerId,
        organizationId: consentKey,
      },
    });

    if (existing) {
      const consent = await this.prismaService.customerConsent.update({
        where: { id: existing.id },
        data: {
          marketingEmails: dto.marketingEmails,
          smsNotifications: dto.smsNotifications,
          whatsappMessages: dto.whatsappMessages,
          consentMethod: dto.consentMethod ?? 'POS',
          ipAddress: metadata?.ipAddress ?? null,
          userAgent: metadata?.userAgent ?? null,
          withdrawnAt: null, // Reset withdrawal if consenting again
        },
      });
      return consent;
    }

    const consent = await this.prismaService.customerConsent.create({
      data: {
        customerId,
        organizationId: consentKey,
        marketingEmails: dto.marketingEmails,
        smsNotifications: dto.smsNotifications,
        whatsappMessages: dto.whatsappMessages,
        dataProcessing: true, // Required for orders
        consentMethod: dto.consentMethod ?? 'POS',
        ipAddress: metadata?.ipAddress ?? null,
        userAgent: metadata?.userAgent ?? null,
      },
    });

    this.logger.log(
      `Consent recorded for customer ${customerId}, organization ${organizationId ?? 'global'}`,
    );

    return consent;
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(
    customerId: string,
    organizationId: string | null,
    dto: WithdrawConsentDto,
  ): Promise<unknown> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const consent = await this.prismaService.customerConsent.findFirst({
      where: {
        customerId,
        organizationId: organizationId ?? null,
      },
    });

    if (!consent) {
      throw new NotFoundException('Consent record not found');
    }

    // Update consent based on channel
    const updateData: {
      marketingEmails?: boolean;
      smsNotifications?: boolean;
      whatsappMessages?: boolean;
      withdrawnAt: Date;
    } = {
      withdrawnAt: new Date(),
    };

    if (dto.channel === 'ALL') {
      updateData.marketingEmails = false;
      updateData.smsNotifications = false;
      updateData.whatsappMessages = false;
    } else if (dto.channel === 'EMAIL') {
      updateData.marketingEmails = false;
    } else if (dto.channel === 'SMS') {
      updateData.smsNotifications = false;
    } else if (dto.channel === 'WHATSAPP') {
      updateData.whatsappMessages = false;
    }

    const updated = await this.prismaService.customerConsent.update({
      where: { id: consent.id },
      data: updateData,
    });

    this.logger.log(
      `Consent withdrawn for customer ${customerId}, channel: ${dto.channel}`,
    );

    return updated;
  }

  /**
   * Get consent status
   */
  async getConsentStatus(
    customerId: string,
    organizationId?: string,
  ): Promise<unknown> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const consent = await this.prismaService.customerConsent.findFirst({
      where: {
        customerId,
        organizationId: organizationId ?? null,
      },
    });

    return {
      customerId,
      organizationId: organizationId ?? null,
      consent: consent ?? null,
      globalPreferences: {
        emailOptIn: customer.emailOptIn,
        smsOptIn: customer.smsOptIn,
        whatsappOptIn: customer.whatsappOptIn,
      },
    };
  }
}
