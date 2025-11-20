import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import {
  Auth0EmailType,
  Auth0UserDto,
  Auth0ApplicationDto,
  Auth0OrganizationDto,
} from './dto/auth0-email.dto';
import { ClerkEmailType, ClerkEmailTemplateData } from './dto/clerk-email.dto';
import {
  getDefaultSpamPreventionHeaders,
  validateEmailContent,
  addUnsubscribeLink,
  isValidEmail,
} from './spam-prevention.util';
import { getAuth0EmailTemplate } from './templates/auth0-email.templates';
import { getClerkEmailTemplate } from './templates/clerk-email.templates';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: string | Buffer; // base64 encoded string or Buffer (will be converted)
    path?: string; // URL to remote file
    contentType?: string;
  }>;
  replyTo?: string | string[];
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
  unsubscribeUrl?: string; // Optional unsubscribe URL for spam prevention
  skipSpamValidation?: boolean; // Skip spam validation (not recommended)
}

export interface BatchEmailOptions {
  emails: Array<{
    from: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string | string[];
    attachments?: Array<{
      filename: string;
      content?: string | Buffer;
      path?: string;
      contentType?: string;
    }>;
    tags?: Array<{ name: string; value: string }>;
    headers?: Record<string, string>;
  }>;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    // Initialize Resend client
    const apiKey =
      this.configService.get<string>('app.email.apiKey') ||
      process.env['RESEND_API_KEY'] ||
      '';

    if (!apiKey) {
      this.logger.warn(
        'Resend API key not configured. Email functionality will be limited.',
      );
    }

    this.resend = new Resend(apiKey);

    // Get domain from config or use custom domain notifications.ordaro.cloud
    const domain =
      this.configService.get<string>('app.email.domain') ||
      process.env['RESEND_DOMAIN'] ||
      process.env['EMAIL_DOMAIN'] ||
      'notifications.ordaro.cloud';

    this.fromEmail =
      this.configService.get<string>('app.email.fromEmail') ||
      process.env['EMAIL_FROM'] ||
      process.env['RESEND_FROM_EMAIL'] ||
      `noreply@${domain}`;
    this.fromName =
      this.configService.get<string>('app.email.fromName') ||
      process.env['EMAIL_FROM_NAME'] ||
      process.env['RESEND_FROM_NAME'] ||
      'Ordaro';

    // Resend requires from in format: "Name <email@domain.com>" or "email@domain.com"
    // Using custom domain: notifications.ordaro.cloud
    this.defaultFrom = `${this.fromName} <${this.fromEmail}>`;
  }

  /**
   * Send email using Resend
   */
  async sendEmail(
    options: EmailOptions,
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      if (recipients.length === 0) {
        throw new Error('At least one recipient is required');
      }

      // Validate email addresses
      const invalidEmails = recipients.filter((email) => !isValidEmail(email));
      if (invalidEmails.length > 0) {
        this.logger.warn(
          `Invalid email addresses: ${invalidEmails.join(', ')}`,
        );
        throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      }

      // Validate email content for spam indicators (unless skipped)
      if (!options.skipSpamValidation) {
        const validation = validateEmailContent({
          subject: options.subject,
          ...(options.html && { html: options.html }),
          ...(options.text && { text: options.text }),
        });

        if (validation.warnings.length > 0) {
          this.logger.warn(
            `Email spam validation warnings: ${validation.warnings.join('; ')}`,
          );
        }

        if (validation.spamScore > 50) {
          this.logger.error(
            `Email has high spam score (${validation.spamScore}). Consider reviewing content.`,
          );
          // Don't block sending, but log warning
        }
      }

      // Prepare attachments for Resend format
      // Resend accepts:
      // 1. path: URL to remote file
      // 2. content: base64 encoded string (NOT Buffer)
      const attachments = options.attachments?.map((att) => {
        // If path is provided, use it (remote file)
        if (att.path) {
          return {
            path: att.path,
            filename: att.filename,
          };
        }

        // Otherwise, convert content to base64 string
        let contentBase64: string;
        if (att.content instanceof Buffer) {
          contentBase64 = att.content.toString('base64');
        } else if (typeof att.content === 'string') {
          // Check if it's already base64
          const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
          if (base64Regex.test(att.content)) {
            contentBase64 = att.content;
          } else {
            // Convert to base64
            contentBase64 = Buffer.from(att.content, 'utf-8').toString(
              'base64',
            );
          }
        } else {
          throw new Error('Attachment content must be a string or Buffer');
        }

        const attachment: {
          filename: string;
          content: string; // base64 string
        } = {
          filename: att.filename,
          content: contentBase64,
        };

        return attachment;
      });

      // Prepare Resend email payload
      // Construct payload object without explicit typing to avoid type conflicts
      const emailPayload: any = {
        from: options.from || this.defaultFrom,
        to: recipients,
        subject: options.subject,
      };

      // Add HTML content (preferred by Resend)
      let htmlContent = options.html;
      if (htmlContent) {
        // Add unsubscribe link if provided and not already present
        if (options.unsubscribeUrl) {
          htmlContent = addUnsubscribeLink(htmlContent, options.unsubscribeUrl);
        }
        emailPayload.html = htmlContent;
      }

      // Add text content (fallback) - Always include text version for better deliverability
      if (options.text) {
        emailPayload.text = options.text;
      } else if (options.html) {
        // Auto-generate text from HTML if not provided
        emailPayload.text = this.htmlToText(options.html);
      } else {
        // If no HTML or text, create minimal text version from subject
        emailPayload.text = options.subject;
      }

      // Add CC if provided
      if (options.cc) {
        emailPayload.cc = Array.isArray(options.cc) ? options.cc : [options.cc];
      }

      // Add BCC if provided
      if (options.bcc) {
        emailPayload.bcc = Array.isArray(options.bcc)
          ? options.bcc
          : [options.bcc];
      }

      // Add reply-to if provided (Resend uses 'reply_to' in API)
      if (options.replyTo) {
        emailPayload.reply_to = Array.isArray(options.replyTo)
          ? options.replyTo
          : [options.replyTo];
      }

      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        emailPayload.attachments = attachments;
      }

      // Add tags if provided
      if (options.tags && options.tags.length > 0) {
        emailPayload.tags = options.tags;
      }

      // Add spam prevention headers (merge with user-provided headers)
      const spamPreventionHeaders = getDefaultSpamPreventionHeaders({
        ...(options.unsubscribeUrl && {
          unsubscribeUrl: options.unsubscribeUrl,
        }),
        senderName: this.fromName,
      });

      // Merge headers: user headers override default headers
      emailPayload.headers = {
        ...spamPreventionHeaders,
        ...(options.headers || {}),
      };

      // Send email via Resend
      const { data, error } = await this.resend.emails.send(emailPayload);

      if (error) {
        this.logger.error(`Resend API error: ${JSON.stringify(error)}`);
        throw new Error(
          `Failed to send email: ${error.message || JSON.stringify(error)}`,
        );
      }

      if (!data) {
        throw new Error('No data returned from Resend API');
      }

      this.logger.log(
        `Email sent successfully to ${recipients.join(', ')} (ID: ${data.id})`,
      );
      return {
        success: true,
        messageId: data.id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Send batch emails using Resend
   */
  async sendBatchEmails(options: BatchEmailOptions): Promise<{
    success: boolean;
    messageIds?: string[];
    errors?: Array<{ index: number; error: string }>;
  }> {
    try {
      // Prepare batch emails
      const batchEmails = options.emails.map((email) => {
        const recipients = Array.isArray(email.to) ? email.to : [email.to];

        // Prepare attachments for each email
        const attachments = email.attachments?.map((att) => {
          if (att.path) {
            return {
              path: att.path,
              filename: att.filename,
            };
          }

          let contentBase64: string;
          if (att.content instanceof Buffer) {
            contentBase64 = att.content.toString('base64');
          } else if (typeof att.content === 'string') {
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (base64Regex.test(att.content)) {
              contentBase64 = att.content;
            } else {
              contentBase64 = Buffer.from(att.content, 'utf-8').toString(
                'base64',
              );
            }
          } else {
            throw new Error('Attachment content must be a string or Buffer');
          }

          return {
            filename: att.filename,
            content: contentBase64,
          };
        });

        // Construct payload using any to avoid type conflicts
        const emailPayload: any = {
          from: email.from || this.defaultFrom,
          to: recipients,
          subject: email.subject,
        };

        if (email.html) {
          emailPayload.html = email.html;
        }
        if (email.text) {
          emailPayload.text = email.text;
        }
        if (email.cc) {
          emailPayload.cc = Array.isArray(email.cc) ? email.cc : [email.cc];
        }
        if (email.bcc) {
          emailPayload.bcc = Array.isArray(email.bcc) ? email.bcc : [email.bcc];
        }
        if (email.replyTo) {
          emailPayload.reply_to = Array.isArray(email.replyTo)
            ? email.replyTo
            : [email.replyTo];
        }
        if (attachments && attachments.length > 0) {
          emailPayload.attachments = attachments;
        }
        if (email.tags && email.tags.length > 0) {
          emailPayload.tags = email.tags;
        }
        if (email.headers && Object.keys(email.headers).length > 0) {
          emailPayload.headers = email.headers;
        }

        return emailPayload;
      });

      // Send batch emails via Resend
      const { data, error } = await this.resend.batch.send(batchEmails as any);

      if (error) {
        this.logger.error(`Resend batch API error: ${JSON.stringify(error)}`);
        throw new Error(
          `Failed to send batch emails: ${error.message || JSON.stringify(error)}`,
        );
      }

      if (!data || !Array.isArray(data)) {
        throw new Error('No data returned from Resend batch API');
      }

      const messageIds: string[] = [];
      const errors: Array<{ index: number; error: string }> = [];

      data.forEach((result: any, index: number) => {
        if (result?.id) {
          messageIds.push(result.id);
        }
        if (result?.error) {
          errors.push({
            index,
            error: result.error?.message || JSON.stringify(result.error),
          });
        }
      });

      this.logger.log(
        `Batch emails sent: ${messageIds.length} successful, ${errors.length} failed`,
      );

      const response: {
        success: boolean;
        messageIds?: string[];
        errors?: Array<{ index: number; error: string }>;
      } = {
        success: errors.length === 0,
      };

      if (messageIds.length > 0) {
        response.messageIds = messageIds;
      }

      if (errors.length > 0) {
        response.errors = errors;
      }

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to send batch emails: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Retrieve email by ID
   */
  async getEmail(emailId: string): Promise<{ success: boolean; email?: any }> {
    try {
      const { data, error } = await this.resend.emails.get(emailId);

      if (error) {
        this.logger.error(`Resend API error: ${JSON.stringify(error)}`);
        throw new Error(
          `Failed to retrieve email: ${error.message || JSON.stringify(error)}`,
        );
      }

      return {
        success: true,
        email: data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve email: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Update email (e.g., schedule or reschedule)
   */
  async updateEmail(
    emailId: string,
    options: { scheduledAt?: string },
  ): Promise<{ success: boolean }> {
    try {
      const updatePayload: any = {
        id: emailId,
      };

      if (options.scheduledAt) {
        updatePayload.scheduledAt = options.scheduledAt;
      }

      const { error } = await this.resend.emails.update(updatePayload);

      if (error) {
        this.logger.error(`Resend API error: ${JSON.stringify(error)}`);
        throw new Error(
          `Failed to update email: ${error.message || JSON.stringify(error)}`,
        );
      }

      this.logger.log(`Email updated successfully: ${emailId}`);
      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update email: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Cancel scheduled email
   */
  async cancelEmail(emailId: string): Promise<{ success: boolean }> {
    try {
      const { error } = await this.resend.emails.cancel(emailId);

      if (error) {
        this.logger.error(`Resend API error: ${JSON.stringify(error)}`);
        throw new Error(
          `Failed to cancel email: ${error.message || JSON.stringify(error)}`,
        );
      }

      this.logger.log(`Email cancelled successfully: ${emailId}`);
      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel email: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * List emails
   */
  async listEmails(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ success: boolean; emails?: any[]; cursor?: string }> {
    try {
      const { data, error } = await this.resend.emails.list({
        ...(options?.limit && { limit: options.limit }),
        ...(options?.cursor && { cursor: options.cursor }),
      });

      if (error) {
        this.logger.error(`Resend API error: ${JSON.stringify(error)}`);
        throw new Error(
          `Failed to list emails: ${error.message || JSON.stringify(error)}`,
        );
      }

      return {
        success: true,
        emails: (data as any)?.data,
        cursor: (data as any)?.next_cursor || (data as any)?.nextCursor,
      };
    } catch (error) {
      this.logger.error(
        `Failed to list emails: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * List attachments for an email
   */
  async listAttachments(
    emailId: string,
  ): Promise<{ success: boolean; attachments?: any[] }> {
    try {
      const { data, error } = await this.resend.emails.attachments.list({
        emailId,
      });

      if (error) {
        this.logger.error(`Resend API error: ${JSON.stringify(error)}`);
        throw new Error(
          `Failed to list attachments: ${error.message || JSON.stringify(error)}`,
        );
      }

      return {
        success: true,
        attachments: data?.data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to list attachments: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Retrieve attachment
   */
  async getAttachment(
    emailId: string,
    attachmentId: string,
  ): Promise<{ success: boolean; attachment?: any }> {
    try {
      const { data, error } = await this.resend.emails.attachments.get({
        id: attachmentId,
        emailId,
      });

      if (error) {
        this.logger.error(`Resend API error: ${JSON.stringify(error)}`);
        throw new Error(
          `Failed to retrieve attachment: ${error.message || JSON.stringify(error)}`,
        );
      }

      return {
        success: true,
        attachment: data,
      };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve attachment: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Send email using template
   */
  async sendTemplateEmail(
    to: string | string[],
    template: EmailTemplate,
    variables?: Record<string, string>,
    options?: Partial<EmailOptions>,
  ): Promise<{ success: boolean; messageId?: string }> {
    let html = template.html;
    let text = template.text || this.htmlToText(html);
    let subject = template.subject;

    // Replace template variables
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        html = html.replace(regex, value);
        text = text.replace(regex, value);
        subject = subject.replace(regex, value);
      });
    }

    return this.sendEmail({
      to,
      subject,
      html,
      text,
      ...options,
    });
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(
    email: string,
    invitationUrl: string,
    inviterName: string,
    organizationName: string,
  ): Promise<{ success: boolean }> {
    const template: EmailTemplate = {
      subject: `Invitation to join ${organizationName} on Ordaro`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>You've been invited!</h2>
            <p>Hi there,</p>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Ordaro.</p>
            <p>Click the button below to accept the invitation:</p>
            <a href="${invitationUrl}" class="button">Accept Invitation</a>
            <p>Or copy and paste this link into your browser:</p>
            <p>${invitationUrl}</p>
            <p>This invitation will expire in 7 days.</p>
            <div class="footer">
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    return this.sendTemplateEmail(email, template);
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(
    email: string,
    userName: string,
    organizationName: string,
  ): Promise<{ success: boolean }> {
    const template: EmailTemplate = {
      subject: `Welcome to ${organizationName} on Ordaro!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Welcome to Ordaro, ${userName}!</h2>
            <p>You've successfully joined <strong>${organizationName}</strong> on Ordaro.</p>
            <p>Get started by exploring your dashboard and setting up your profile.</p>
            <a href="https://ordaro.com/login" class="button">Go to Dashboard</a>
            <p>If you have any questions, feel free to reach out to your organization admin.</p>
          </div>
        </body>
        </html>
      `,
    };

    return this.sendTemplateEmail(email, template);
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmationEmail(
    email: string,
    orderId: string,
    orderDetails: {
      total: number;
      items: Array<{ name: string; quantity: number; price: number }>;
      branchName: string;
    },
  ): Promise<{ success: boolean }> {
    const itemsHtml = orderDetails.items
      .map(
        (item) =>
          `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${item.price.toFixed(2)}</td></tr>`,
      )
      .join('');

    const template: EmailTemplate = {
      subject: `Order Confirmation - ${orderId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f4f4f4; }
            .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Order Confirmation</h2>
            <p>Thank you for your order!</p>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Branch:</strong> ${orderDetails.branchName}</p>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            <div class="total">Total: ${orderDetails.total.toFixed(2)}</div>
            <p>We'll notify you when your order is ready for pickup.</p>
          </div>
        </body>
        </html>
      `,
    };

    return this.sendTemplateEmail(email, template);
  }

  /**
   * Send Auth0 email (main method that routes to specific template methods)
   */
  async sendAuth0Email(
    type: Auth0EmailType,
    data: {
      to: string;
      user?: Auth0UserDto | undefined;
      application?: Auth0ApplicationDto | undefined;
      organization?: Auth0OrganizationDto | undefined;
      inviter?: Auth0UserDto | undefined;
      url?: string | undefined;
      code?: string | undefined;
      reason?: string | undefined;
    },
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      // Build template data object, only including defined properties
      const templateData: {
        user?: Auth0UserDto;
        application?: Auth0ApplicationDto;
        organization?: Auth0OrganizationDto;
        inviter?: Auth0UserDto;
        url?: string;
        code?: string;
        reason?: string;
      } = {};

      if (data.user) templateData.user = data.user;
      if (data.application) templateData.application = data.application;
      if (data.organization) templateData.organization = data.organization;
      if (data.inviter) templateData.inviter = data.inviter;
      if (data.url) templateData.url = data.url;
      if (data.code) templateData.code = data.code;
      if (data.reason) templateData.reason = data.reason;

      // Get template based on type
      const template = getAuth0EmailTemplate(type, templateData);

      // Send email using template
      return await this.sendTemplateEmail(data.to, template, undefined, {
        tags: [
          { name: 'source', value: 'auth0' },
          { name: 'type', value: type },
        ],
        skipSpamValidation: false, // Auth0 emails should still be validated
      });
    } catch (error) {
      this.logger.error(
        `Failed to send Auth0 email (type: ${type}): ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Send Clerk email (using branded templates)
   */
  async sendClerkEmail(
    type: ClerkEmailType,
    data: ClerkEmailTemplateData,
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      const template = getClerkEmailTemplate(type, data);

      return await this.sendTemplateEmail(data.to, template, undefined, {
        tags: [
          { name: 'source', value: 'clerk' },
          { name: 'slug', value: data.slug },
          { name: 'type', value: type },
        ],
        skipSpamValidation: false,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send Clerk email (type: ${type}, slug: ${data.slug}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(
    email: string,
    verificationUrl: string,
    user?: Auth0UserDto,
    application?: Auth0ApplicationDto,
  ): Promise<{ success: boolean; messageId?: string }> {
    const data: {
      to: string;
      url: string;
      user?: Auth0UserDto;
      application?: Auth0ApplicationDto;
    } = {
      to: email,
      url: verificationUrl,
    };
    if (user) data.user = user;
    if (application) data.application = application;
    return this.sendAuth0Email(Auth0EmailType.VERIFICATION_EMAIL, data);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    resetUrl: string,
    user?: Auth0UserDto,
    application?: Auth0ApplicationDto,
  ): Promise<{ success: boolean; messageId?: string }> {
    const data: {
      to: string;
      url: string;
      user?: Auth0UserDto;
      application?: Auth0ApplicationDto;
    } = {
      to: email,
      url: resetUrl,
    };
    if (user) data.user = user;
    if (application) data.application = application;
    return this.sendAuth0Email(Auth0EmailType.PASSWORD_RESET, data);
  }

  /**
   * Send welcome email (Auth0 version)
   */
  async sendAuth0WelcomeEmail(
    email: string,
    user?: Auth0UserDto,
    application?: Auth0ApplicationDto,
  ): Promise<{ success: boolean; messageId?: string }> {
    const data: {
      to: string;
      user?: Auth0UserDto;
      application?: Auth0ApplicationDto;
    } = {
      to: email,
    };
    if (user) data.user = user;
    if (application) data.application = application;
    return this.sendAuth0Email(Auth0EmailType.WELCOME_EMAIL, data);
  }

  /**
   * Send user invited email
   */
  async sendUserInvitedEmail(
    email: string,
    invitationUrl: string,
    inviter?: Auth0UserDto,
    organization?: Auth0OrganizationDto,
    application?: Auth0ApplicationDto,
  ): Promise<{ success: boolean; messageId?: string }> {
    const data: {
      to: string;
      url: string;
      inviter?: Auth0UserDto;
      organization?: Auth0OrganizationDto;
      application?: Auth0ApplicationDto;
    } = {
      to: email,
      url: invitationUrl,
    };
    if (inviter) data.inviter = inviter;
    if (organization) data.organization = organization;
    if (application) data.application = application;
    return this.sendAuth0Email(Auth0EmailType.USER_INVITED, data);
  }

  /**
   * Send change password email
   */
  async sendChangePasswordEmail(
    email: string,
    user?: Auth0UserDto,
    application?: Auth0ApplicationDto,
  ): Promise<{ success: boolean; messageId?: string }> {
    const data: {
      to: string;
      user?: Auth0UserDto;
      application?: Auth0ApplicationDto;
    } = {
      to: email,
    };
    if (user) data.user = user;
    if (application) data.application = application;
    return this.sendAuth0Email(Auth0EmailType.CHANGE_PASSWORD, data);
  }

  /**
   * Send block account email
   */
  async sendBlockAccountEmail(
    email: string,
    user?: Auth0UserDto,
    application?: Auth0ApplicationDto,
    reason?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const data: {
      to: string;
      user?: Auth0UserDto;
      application?: Auth0ApplicationDto;
      reason?: string;
    } = {
      to: email,
    };
    if (user) data.user = user;
    if (application) data.application = application;
    if (reason) data.reason = reason;
    return this.sendAuth0Email(Auth0EmailType.BLOCK_ACCOUNT, data);
  }

  /**
   * Send MFA code email
   */
  async sendMFACodeEmail(
    email: string,
    code: string,
    user?: Auth0UserDto,
    application?: Auth0ApplicationDto,
  ): Promise<{ success: boolean; messageId?: string }> {
    const data: {
      to: string;
      code: string;
      user?: Auth0UserDto;
      application?: Auth0ApplicationDto;
    } = {
      to: email,
      code,
    };
    if (user) data.user = user;
    if (application) data.application = application;
    return this.sendAuth0Email(Auth0EmailType.MFA_CODE, data);
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }
}
