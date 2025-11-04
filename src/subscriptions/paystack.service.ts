import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '../config/config.service';

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly client: AxiosInstance;
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly baseUrl: string;
  private readonly currency: string;

  constructor(private readonly configService: ConfigService) {
    const paystackConfig = this.configService.paystackConfig;
    this.secretKey = paystackConfig.secretKey || '';
    this.publicKey = paystackConfig.publicKey || '';
    this.baseUrl = paystackConfig.baseUrl || 'https://api.paystack.co';
    this.currency = paystackConfig.currency || 'GHS';

    if (!this.secretKey) {
      this.logger.warn('Paystack secret key not configured');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Initialize a transaction for card authorization
   */
  async initializeTransaction(data: {
    email: string;
    amount: number;
    callbackUrl: string;
    metadata?: Record<string, unknown>;
    currency?: string;
  }): Promise<{
    authorizationUrl: string;
    reference: string;
    accessCode: string;
  }> {
    try {
      // Amount must be in smallest currency unit (pesewas for GHS, kobo for NGN, etc.)
      // Minimum amount: 200 pesewas (2 GHS) for GHS currency
      const requestData: {
        email: string;
        amount: number;
        callback_url: string;
        currency?: string;
        metadata?: Record<string, unknown>;
      } = {
        email: data.email,
        amount: data.amount,
        callback_url: data.callbackUrl,
        currency: data.currency || this.currency,
        ...(data.metadata && { metadata: data.metadata }),
      };

      const response = await this.client.post('/transaction/initialize', requestData);

      const responseData = response.data.data;

      return {
        authorizationUrl: responseData.authorization_url,
        reference: responseData.reference,
        accessCode: responseData.access_code,
      };
    } catch (error: any) {
      this.logger.error('Failed to initialize Paystack transaction', {
        error: error.response?.data || error.message,
      });
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to initialize transaction',
      );
    }
  }

  /**
   * Verify a transaction
   * Returns transaction data including authorization and metadata
   */
  async verifyTransaction(reference: string): Promise<{
    status: string;
    amount: number;
    authorization: {
      authorizationCode: string;
      bin: string;
      last4: string;
      expMonth: string;
      expYear: string;
      cardType: string;
      bank: string;
      channel: string;
      signature: string;
      reusable: boolean;
      countryCode: string;
    };
    customer: {
      email: string;
      customerCode?: string;
    };
    metadata?: Record<string, unknown>;
  }> {
    try {
      const response = await this.client.get(`/transaction/verify/${reference}`);
      const data = response.data.data;
      
      // Paystack returns metadata at the transaction level
      return {
        status: data.status,
        amount: data.amount,
        authorization: data.authorization || {},
        customer: data.customer || { email: data.customer?.email || '' },
        metadata: data.metadata || {},
      };
    } catch (error: any) {
      this.logger.error('Failed to verify Paystack transaction', {
        reference,
        error: error.response?.data || error.message,
      });
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to verify transaction',
      );
    }
  }

  /**
   * Create a plan in Paystack
   */
  async createPlan(data: {
    name: string;
    interval: 'daily' | 'weekly' | 'monthly' | 'annually';
    amount: number;
    description?: string;
    currency?: string;
  }): Promise<{
    planCode: string;
    name: string;
    interval: string;
    amount: number;
  }> {
    try {
      // Amount must be in smallest currency unit (pesewas for GHS, kobo for NGN, etc.)
      // Minimum amount: 200 pesewas (2 GHS) for GHS currency
      const requestData: {
        name: string;
        interval: string;
        amount: number;
        currency?: string;
        description?: string;
      } = {
        name: data.name,
        interval: data.interval,
        amount: data.amount,
        currency: data.currency || this.currency,
        ...(data.description !== undefined && { description: data.description }),
      };

      const response = await this.client.post('/plan', requestData);

      const planData = response.data.data;

      return {
        planCode: planData.plan_code,
        name: planData.name,
        interval: planData.interval,
        amount: planData.amount,
      };
    } catch (error: any) {
      this.logger.error('Failed to create Paystack plan', {
        error: error.response?.data || error.message,
      });
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to create plan',
      );
    }
  }

  /**
   * Update a plan in Paystack
   */
  async updatePlan(
    planCode: string,
    data: {
      name?: string;
      description?: string;
    },
  ): Promise<{
    planCode: string;
    name: string;
    description?: string;
  }> {
    try {
      const response = await this.client.put(`/plan/${planCode}`, {
        name: data.name,
        description: data.description,
      });

      const planData = response.data.data;

      return {
        planCode: planData.plan_code,
        name: planData.name,
        description: planData.description,
      };
    } catch (error: any) {
      this.logger.error('Failed to update Paystack plan', {
        planCode,
        error: error.response?.data || error.message,
      });
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to update plan',
      );
    }
  }

  /**
   * Create a subscription in Paystack
   */
  async createSubscription(data: {
    customer: string;
    plan: string;
    authorization: string;
  }): Promise<{
    subscriptionCode: string;
    emailToken: string;
    status: string;
    customer: string;
    plan: string;
    start: number;
    nextPaymentDate: string;
  }> {
    try {
      const response = await this.client.post('/subscription', {
        customer: data.customer,
        plan: data.plan,
        authorization: data.authorization,
      });

      const subData = response.data.data;

      return {
        subscriptionCode: subData.subscription_code,
        emailToken: subData.email_token,
        status: subData.status,
        customer: subData.customer,
        plan: subData.plan,
        start: subData.start,
        nextPaymentDate: subData.next_payment_date,
      };
    } catch (error: any) {
      this.logger.error('Failed to create Paystack subscription', {
        error: error.response?.data || error.message,
      });
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to create subscription',
      );
    }
  }

  /**
   * Cancel a subscription in Paystack
   */
  async cancelSubscription(
    subscriptionCode: string,
    cancelToken?: string,
  ): Promise<{
    subscriptionCode: string;
    status: string;
  }> {
    try {
      // Paystack uses PUT method with code and token in body
      const body: { code: string; token?: string } = { code: subscriptionCode };
      if (cancelToken) {
        body.token = cancelToken;
      }

      const response = await this.client.put(`/subscription/disable`, body);

      return {
        subscriptionCode: response.data.data.subscription_code,
        status: response.data.data.status,
      };
    } catch (error: any) {
      this.logger.error('Failed to cancel Paystack subscription', {
        subscriptionCode,
        error: error.response?.data || error.message,
      });
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to cancel subscription',
      );
    }
  }

  /**
   * Reactivate a subscription in Paystack
   */
  async reactivateSubscription(
    subscriptionCode: string,
    token?: string,
  ): Promise<{
    subscriptionCode: string;
    status: string;
  }> {
    try {
      // Paystack uses PUT method with code and token in body
      const body: { code: string; token?: string } = { code: subscriptionCode };
      if (token) {
        body.token = token;
      }

      const response = await this.client.put(`/subscription/enable`, body);

      return {
        subscriptionCode: response.data.data.subscription_code,
        status: response.data.data.status,
      };
    } catch (error: any) {
      this.logger.error('Failed to reactivate Paystack subscription', {
        subscriptionCode,
        error: error.response?.data || error.message,
      });
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to reactivate subscription',
      );
    }
  }

  /**
   * Verify webhook signature
   * Paystack uses HMAC SHA512 with the secret key (not a separate webhook secret)
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Get public key (for frontend use)
   */
  getPublicKey(): string {
    return this.publicKey;
  }
}

