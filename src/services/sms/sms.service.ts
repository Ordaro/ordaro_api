import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface SMSProvider {
  send(phoneNumber: string, message: string): Promise<void>;
}

export interface SMSOptions {
  provider?: 'mnotify' | 'twilio' | 'nalo';
}

@Injectable()
export class SMSService {
  private readonly logger = new Logger(SMSService.name);
  private readonly provider: SMSProvider;
  private readonly defaultProvider: 'mnotify' | 'twilio' | 'nalo';

  constructor(private readonly configService: ConfigService) {
    this.defaultProvider =
      (this.configService.get<string>('app.sms.provider') as
        | 'mnotify'
        | 'twilio'
        | 'nalo') || 'mnotify';

    this.provider = this.createProvider(this.defaultProvider);
  }

  /**
   * Send SMS to a phone number
   */
  async sendSMS(
    phoneNumber: string,
    message: string,
    options?: SMSOptions,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
      const provider = options?.provider
        ? this.createProvider(options.provider)
        : this.provider;

      await provider.send(normalizedPhone, message);
      this.logger.log(`SMS sent to ${normalizedPhone}`);

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${phoneNumber}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send OTP SMS
   */
  async sendOTP(
    phoneNumber: string,
    otp: string,
  ): Promise<{ success: boolean }> {
    const message = `Your Ordaro verification code is: ${otp}. Valid for 10 minutes.`;
    return this.sendSMS(phoneNumber, message);
  }

  /**
   * Send order notification SMS
   */
  async sendOrderNotification(
    phoneNumber: string,
    orderId: string,
    status: string,
  ): Promise<{ success: boolean }> {
    const message = `Your order ${orderId} status: ${status}. Thank you for choosing Ordaro!`;
    return this.sendSMS(phoneNumber, message);
  }

  /**
   * Normalize phone number to international format
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle Ghana numbers (convert 0XXX to +233XXX)
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '233' + cleaned.substring(1);
    } else if (cleaned.startsWith('233') && cleaned.length === 12) {
      // Already in correct format
    } else if (!cleaned.startsWith('+') && cleaned.length === 9) {
      // Assume Ghana number without country code
      cleaned = '233' + cleaned;
    }

    return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
  }

  /**
   * Create SMS provider instance
   */
  private createProvider(provider: 'mnotify' | 'twilio' | 'nalo'): SMSProvider {
    switch (provider) {
      case 'mnotify':
        return new MnotifyProvider(this.configService, this.logger);
      case 'twilio':
        return new TwilioProvider(this.configService, this.logger);
      case 'nalo':
        return new NaloProvider(this.configService, this.logger);
      default:
        throw new Error(`Unsupported SMS provider: ${provider}`);
    }
  }
}

/**
 * Mnotify SMS Provider
 */
class MnotifyProvider implements SMSProvider {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly client: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.apiKey =
      this.configService.get<string>('app.sms.mnotify.apiKey') ||
      process.env['MNOTIFY_API_KEY'] ||
      '';
    this.apiUrl =
      this.configService.get<string>('app.sms.mnotify.apiUrl') ||
      'https://api.mnotify.com/api/sms/quick';

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  async send(phoneNumber: string, message: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Mnotify API key not configured');
    }

    try {
      const response = await this.client.post('/send', {
        key: this.apiKey,
        to: phoneNumber,
        msg: message,
        sender_id:
          this.configService.get<string>('app.sms.mnotify.senderId') ||
          'Ordaro',
      });

      if (response.data.status !== 'success') {
        throw new Error(`Mnotify API error: ${JSON.stringify(response.data)}`);
      }

      this.logger.debug(`Mnotify SMS sent: ${JSON.stringify(response.data)}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Mnotify API request failed: ${error.response?.data?.message || error.message}`,
        );
      }
      throw error;
    }
  }
}

/**
 * Twilio SMS Provider
 */
class TwilioProvider implements SMSProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly client: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.accountSid =
      this.configService.get<string>('app.sms.twilio.accountSid') ||
      process.env['TWILIO_ACCOUNT_SID'] ||
      '';
    this.authToken =
      this.configService.get<string>('app.sms.twilio.authToken') ||
      process.env['TWILIO_AUTH_TOKEN'] ||
      '';
    this.fromNumber =
      this.configService.get<string>('app.sms.twilio.fromNumber') ||
      process.env['TWILIO_FROM_NUMBER'] ||
      '';

    this.client = axios.create({
      baseURL: `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`,
      auth: {
        username: this.accountSid,
        password: this.authToken,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });
  }

  async send(phoneNumber: string, message: string): Promise<void> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      throw new Error('Twilio credentials not configured');
    }

    try {
      const params = new URLSearchParams({
        To: phoneNumber,
        From: this.fromNumber,
        Body: message,
      });

      const response = await this.client.post(
        '/Messages.json',
        params.toString(),
      );

      this.logger.debug(`Twilio SMS sent: ${response.data.sid}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Twilio API request failed: ${error.response?.data?.message || error.message}`,
        );
      }
      throw error;
    }
  }
}

/**
 * Nalo SMS Provider
 */
class NaloProvider implements SMSProvider {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly client: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.apiKey =
      this.configService.get<string>('app.sms.nalo.apiKey') ||
      process.env['NALO_API_KEY'] ||
      '';
    this.apiUrl =
      this.configService.get<string>('app.sms.nalo.apiUrl') ||
      'https://api.nalosolutions.com/api/send';

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  async send(phoneNumber: string, message: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Nalo API key not configured');
    }

    try {
      const response = await this.client.post('/sms', {
        key: this.apiKey,
        destination: phoneNumber,
        message: message,
        sender:
          this.configService.get<string>('app.sms.nalo.senderId') || 'Ordaro',
      });

      if (response.data.status !== 'success') {
        throw new Error(`Nalo API error: ${JSON.stringify(response.data)}`);
      }

      this.logger.debug(`Nalo SMS sent: ${JSON.stringify(response.data)}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Nalo API request failed: ${error.response?.data?.message || error.message}`,
        );
      }
      throw error;
    }
  }
}
