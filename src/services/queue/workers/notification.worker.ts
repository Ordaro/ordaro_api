import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import {
  Auth0EmailType,
  Auth0UserDto,
  Auth0ApplicationDto,
  Auth0OrganizationDto,
} from '../../email/dto/auth0-email.dto';
import {
  ClerkEmailType,
  ClerkEmailTemplateData,
} from '../../email/dto/clerk-email.dto';
import { EmailService } from '../../email/email.service';
import { SMSService } from '../../sms/sms.service';
import { ORDARO_JOB_TYPES } from '../job-types.enum';
import { QueueService, JobData } from '../queue.service';

@Injectable()
export class NotificationWorker implements OnModuleInit {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly emailService: EmailService,
    private readonly smsService: SMSService,
  ) {}

  onModuleInit() {
    // Create worker for notifications queue
    this.queueService.createWorker(
      'notifications',
      async (job: Job<JobData>) => {
        return this.processNotificationJob(job);
      },
    );

    this.logger.log('Notification worker initialized');
  }

  private async processNotificationJob(job: Job<JobData>): Promise<unknown> {
    const attemptNumber = (job.attemptsMade ?? 0) + 1;
    const maxAttempts = job.opts.attempts ?? 3;

    this.logger.log(
      `Processing job ${job.id ?? 'unknown'} (${job.name ?? 'unknown'}) - Attempt ${attemptNumber}/${maxAttempts}`,
    );

    try {
      let result: unknown;

      const jobName = job.name as ORDARO_JOB_TYPES;
      switch (jobName) {
        case ORDARO_JOB_TYPES.SEND_EMAIL:
          result = await this.handleSendEmail(job.data);
          break;
        case ORDARO_JOB_TYPES.SEND_AUTH0_EMAIL:
          result = await this.handleSendAuth0Email(job.data);
          break;
        case ORDARO_JOB_TYPES.SEND_CLERK_EMAIL:
          result = await this.handleSendClerkEmail(job.data);
          break;
        case ORDARO_JOB_TYPES.SEND_SMS:
          result = await this.handleSendSMS(job.data);
          break;
        case ORDARO_JOB_TYPES.SEND_INVITATION_EMAIL:
          result = await this.handleSendInvitationEmail(job.data);
          break;
        case ORDARO_JOB_TYPES.SEND_WELCOME_EMAIL:
          result = await this.handleSendWelcomeEmail(job.data);
          break;
        default:
          throw new Error(
            `Unknown notification job type: ${job.name ?? 'unknown'}`,
          );
      }

      this.logger.log(
        `Job ${job.id ?? 'unknown'} completed successfully on attempt ${attemptNumber}`,
      );
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Job ${job.id ?? 'unknown'} failed on attempt ${attemptNumber}/${maxAttempts}: ${errorMessage}`,
      );

      if (attemptNumber < maxAttempts) {
        this.logger.log(
          `Job ${job.id ?? 'unknown'} will be retried. Next attempt: ${attemptNumber + 1}/${maxAttempts}`,
        );
      } else {
        this.logger.error(
          `Job ${job.id ?? 'unknown'} failed after ${maxAttempts} attempts. Marking as failed.`,
        );
      }

      throw error;
    }
  }

  private async handleSendEmail(data: JobData): Promise<unknown> {
    const {
      to,
      subject,
      html,
      text,
      from,
      cc,
      bcc,
      replyTo,
      attachments,
      tags,
      headers,
    } = data as {
      to: string | string[];
      subject: string;
      html?: string;
      text?: string;
      from?: string;
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
    };

    const emailOptions = {
      to,
      subject,
      ...(html && { html }),
      ...(text && { text }),
      ...(from && { from }),
      ...(cc && { cc }),
      ...(bcc && { bcc }),
      ...(replyTo && { replyTo }),
      ...(attachments && { attachments }),
      ...(tags && { tags }),
      ...(headers && { headers }),
    };

    return this.emailService.sendEmail(emailOptions);
  }

  private async handleSendSMS(data: JobData): Promise<unknown> {
    const { phoneNumber, message } = data as {
      phoneNumber: string;
      message: string;
    };
    return this.smsService.sendSMS(phoneNumber, message);
  }

  private async handleSendInvitationEmail(data: JobData): Promise<unknown> {
    const { email, invitationUrl, inviterName, organizationName } = data as {
      email: string;
      invitationUrl: string;
      inviterName: string;
      organizationName: string;
    };

    return this.emailService.sendInvitationEmail(
      email,
      invitationUrl,
      inviterName,
      organizationName,
    );
  }

  private async handleSendWelcomeEmail(data: JobData): Promise<unknown> {
    const { email, userName, organizationName } = data as {
      email: string;
      userName: string;
      organizationName: string;
    };

    return this.emailService.sendWelcomeEmail(
      email,
      userName,
      organizationName,
    );
  }

  private async handleSendAuth0Email(data: JobData): Promise<unknown> {
    const {
      type,
      to,
      user,
      application,
      organization,
      inviter,
      url,
      code,
      reason,
    } = data as {
      type: Auth0EmailType;
      to: string;
      user?: Auth0UserDto;
      application?: Auth0ApplicationDto;
      organization?: Auth0OrganizationDto;
      inviter?: Auth0UserDto;
      url?: string;
      code?: string;
      reason?: string;
    };

    this.logger.log(`Processing Auth0 email: Type: ${type}, To: ${to}`);

    return this.emailService.sendAuth0Email(type, {
      to,
      user,
      application,
      organization,
      inviter,
      url,
      code,
      reason,
    });
  }

  private async handleSendClerkEmail(data: JobData): Promise<unknown> {
    const { type, templateData } = data as {
      type: ClerkEmailType;
      templateData: ClerkEmailTemplateData;
    };

    this.logger.log(
      `Processing Clerk email: Slug: ${templateData.slug}, Type: ${type}, To: ${templateData.to}`,
    );

    return this.emailService.sendClerkEmail(type, templateData);
  }
}
