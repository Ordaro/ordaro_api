import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { ORDARO_JOB_TYPES } from '../../services/queue/job-types.enum';
import { QueueService } from '../../services/queue/queue.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Check if customer has consented to channel
   */
  async checkConsent(
    customerId: string,
    organizationId: string,
    channel: 'EMAIL' | 'SMS' | 'WHATSAPP',
  ): Promise<boolean> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { id: customerId },
      include: {
        organizationCustomers: {
          where: { organizationId },
        },
      },
    });

    if (!customer) {
      return false;
    }

    const orgCustomer = customer.organizationCustomers[0];

    // Check organization-specific preference first
    if (orgCustomer) {
      if (channel === 'EMAIL' && orgCustomer.emailOptIn !== null) {
        return orgCustomer.emailOptIn;
      }
      if (channel === 'SMS' && orgCustomer.smsOptIn !== null) {
        return orgCustomer.smsOptIn;
      }
      if (channel === 'WHATSAPP' && orgCustomer.whatsappOptIn !== null) {
        return orgCustomer.whatsappOptIn;
      }
    }

    // Fall back to global preference
    if (channel === 'EMAIL') {
      return customer.emailOptIn;
    }
    if (channel === 'SMS') {
      return customer.smsOptIn;
    }
    if (channel === 'WHATSAPP') {
      return customer.whatsappOptIn;
    }

    return false;
  }

  /**
   * Send order receipt
   */
  async sendOrderReceipt(
    orderId: string,
    customerId: string,
    organizationId: string,
  ): Promise<void> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { id: customerId },
      include: {
        organizationCustomers: {
          where: { organizationId },
        },
      },
    });

    if (!customer) {
      this.logger.warn(`Customer not found: ${customerId}`);
      return;
    }

    // TODO: Get order details when Order model is created
    // const order = await this.getOrderDetails(orderId);

    // Send via email if consented
    if (
      customer.email &&
      (await this.checkConsent(customerId, organizationId, 'EMAIL'))
    ) {
      await this.queueService.addJob(ORDARO_JOB_TYPES.SEND_EMAIL, {
        to: customer.email,
        subject: 'Order Receipt',
        template: 'order-receipt',
        variables: {
          customerName: customer.firstName ?? customer.fullName ?? 'Customer',
          orderId,
          // orderDetails: order,
        },
      });
    }

    // Send via SMS if consented
    if (
      customer.phone &&
      (await this.checkConsent(customerId, organizationId, 'SMS'))
    ) {
      await this.queueService.addJob(ORDARO_JOB_TYPES.SEND_SMS, {
        to: customer.phone,
        message: `Thank you for your order! Order ID: ${orderId}. Receipt sent to email.`,
      });
    }

    // TODO: WhatsApp integration when implemented
    // if (customer.phone && await this.checkConsent(customerId, organizationId, 'WHATSAPP')) {
    //   await this.sendWhatsAppReceipt(customer.phone, orderId);
    // }

    this.logger.log(
      `Order receipt sent to customer ${customerId} for order ${orderId}`,
    );
  }

  /**
   * Send order confirmation
   */
  async sendOrderConfirmation(
    orderId: string,
    customerId: string,
    organizationId: string,
  ): Promise<void> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return;
    }

    // Send via email if consented
    if (
      customer.email &&
      (await this.checkConsent(customerId, organizationId, 'EMAIL'))
    ) {
      await this.queueService.addJob(ORDARO_JOB_TYPES.SEND_EMAIL, {
        to: customer.email,
        subject: 'Order Confirmation',
        template: 'order-confirmation',
        variables: {
          customerName: customer.firstName ?? customer.fullName ?? 'Customer',
          orderId,
        },
      });
    }

    // Send via SMS if consented
    if (
      customer.phone &&
      (await this.checkConsent(customerId, organizationId, 'SMS'))
    ) {
      await this.queueService.addJob(ORDARO_JOB_TYPES.SEND_SMS, {
        to: customer.phone,
        message: `Order confirmed! Order ID: ${orderId}. We'll notify you when it's ready.`,
      });
    }
  }

  /**
   * Send order ready notification
   */
  async sendOrderReady(
    orderId: string,
    customerId: string,
    organizationId: string,
  ): Promise<void> {
    const customer = await this.prismaService.transactionCustomer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return;
    }

    // Send via SMS (most common for order ready)
    if (
      customer.phone &&
      (await this.checkConsent(customerId, organizationId, 'SMS'))
    ) {
      await this.queueService.addJob(ORDARO_JOB_TYPES.SEND_SMS, {
        to: customer.phone,
        message: `Your order ${orderId} is ready for pickup!`,
      });
    }

    // Send via email if consented
    if (
      customer.email &&
      (await this.checkConsent(customerId, organizationId, 'EMAIL'))
    ) {
      await this.queueService.addJob(ORDARO_JOB_TYPES.SEND_EMAIL, {
        to: customer.email,
        subject: 'Order Ready',
        template: 'order-ready',
        variables: {
          customerName: customer.firstName ?? customer.fullName ?? 'Customer',
          orderId,
        },
      });
    }
  }
}
