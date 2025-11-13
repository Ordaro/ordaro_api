import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  HttpException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators';
import { ApiKeyGuard } from '../../auth/guards';
import type { UserPayload } from '../../auth/interfaces';
import { ORDARO_JOB_TYPES } from '../queue/job-types.enum';
import { QueueService } from '../queue/queue.service';

import {
  QueueEmailDto,
  QueueBatchEmailDto,
  QueueEmailResponseDto,
  Auth0EmailRequestDto,
  Auth0EmailResponseDto,
} from './dto';

@ApiTags('Emails')
@Controller('emails')
export class EmailsController {
  private readonly logger = new Logger(EmailsController.name);

  constructor(private readonly queueService: QueueService) {}

  /**
   * Queue a single email for sending
   */
  @Post('queue')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Queue email for sending',
    description:
      'Adds an email to the queue for asynchronous processing. Returns immediately with job details.',
  })
  @ApiResponse({
    status: 202,
    description: 'Email queued successfully',
    type: QueueEmailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email data',
  })
  async queueEmail(
    @Body() queueEmailDto: QueueEmailDto,
    @CurrentUser() _user?: UserPayload,
  ): Promise<QueueEmailResponseDto> {
    // Prepare job data
    const jobData = {
      to: queueEmailDto.to,
      subject: queueEmailDto.subject,
      html: queueEmailDto.html,
      text: queueEmailDto.text,
      from: queueEmailDto.from,
      cc: queueEmailDto.cc,
      bcc: queueEmailDto.bcc,
      replyTo: queueEmailDto.replyTo,
      attachments: queueEmailDto.attachments,
      tags: queueEmailDto.tags,
      headers: queueEmailDto.headers,
    };

    // Prepare job options - only include defined values
    const jobOptions: {
      priority?: number;
      delay?: number;
      attempts?: number;
    } = {};

    if (queueEmailDto.options?.priority !== undefined) {
      jobOptions.priority = queueEmailDto.options.priority;
    }
    if (queueEmailDto.options?.delay !== undefined) {
      jobOptions.delay = queueEmailDto.options.delay;
    }
    if (queueEmailDto.options?.attempts !== undefined) {
      jobOptions.attempts = queueEmailDto.options.attempts;
    }

    // Add job to queue (QueueService handles empty options object)
    const job = await this.queueService.addJob(
      ORDARO_JOB_TYPES.SEND_EMAIL,
      jobData,
      queueEmailDto.options ? jobOptions : undefined,
    );

    // Ensure job ID is always a string (BullMQ always returns an ID)
    if (!job.id) {
      this.logger.error('Job created but ID is missing');
      throw new HttpException(
        'Failed to create job: Job ID is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const jobState = await job.getState();
    const jobId = job.id ?? 'unknown';

    this.logger.log(
      `Email queued successfully: Job ID ${jobId}, Status: ${jobState}`,
    );

    return {
      jobId, // Job ID for tracking
      jobType: ORDARO_JOB_TYPES.SEND_EMAIL,
      queueName: 'notifications',
      status: jobState,
    };
  }

  /**
   * Queue multiple emails for sending (batch)
   */
  @Post('queue/batch')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Queue batch emails for sending',
    description:
      'Adds multiple emails to the queue for asynchronous processing. Each email is processed as a separate job.',
  })
  @ApiResponse({
    status: 202,
    description: 'Emails queued successfully',
    type: [QueueEmailResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email data',
  })
  async queueBatchEmails(
    @Body() batchDto: QueueBatchEmailDto,
    @CurrentUser() _user?: UserPayload,
  ): Promise<QueueEmailResponseDto[]> {
    const jobs: QueueEmailResponseDto[] = [];

    // Prepare batch job options - only include defined values
    const batchJobOptions: {
      priority?: number;
      delay?: number;
      attempts?: number;
    } = {};

    if (batchDto.options?.priority !== undefined) {
      batchJobOptions.priority = batchDto.options.priority;
    }
    if (batchDto.options?.delay !== undefined) {
      batchJobOptions.delay = batchDto.options.delay;
    }
    if (batchDto.options?.attempts !== undefined) {
      batchJobOptions.attempts = batchDto.options.attempts;
    }

    // Queue each email as a separate job
    for (const email of batchDto.emails) {
      const jobData = {
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        from: email.from,
        cc: email.cc,
        bcc: email.bcc,
        replyTo: email.replyTo,
        attachments: email.attachments,
        tags: email.tags,
        headers: email.headers,
      };

      // QueueService handles empty options object
      const job = await this.queueService.addJob(
        ORDARO_JOB_TYPES.SEND_EMAIL,
        jobData,
        batchDto.options ? batchJobOptions : undefined,
      );

      // Ensure job ID is always a string (BullMQ always returns an ID)
      if (!job.id) {
        this.logger.error(
          `Job created but ID is missing for email to ${email.to}`,
        );
        throw new HttpException(
          `Failed to create job for email to ${email.to}: Job ID is missing`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const jobState = await job.getState();
      const jobId = job.id ?? 'unknown';

      this.logger.log(
        `Email queued in batch: Job ID ${jobId}, To: ${email.to}, Status: ${jobState}`,
      );

      jobs.push({
        jobId, // Job ID for tracking
        jobType: ORDARO_JOB_TYPES.SEND_EMAIL,
        queueName: 'notifications',
        status: jobState,
      });
    }

    return jobs;
  }

  /**
   * Get email job status
   */
  @Get('queue/:jobId')
  @ApiOperation({
    summary: 'Get email job status',
    description: 'Retrieves the status of a queued email job',
  })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.queueService.getJob(
      ORDARO_JOB_TYPES.SEND_EMAIL,
      jobId,
    );

    if (!job) {
      throw new HttpException(`Job ${jobId} not found`, HttpStatus.NOT_FOUND);
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;
    const failedReason = job.failedReason;

    // Ensure jobId is always a string
    const jobIdString = job.id ?? jobId;

    return {
      jobId: jobIdString, // Job ID for tracking (always returned)
      jobType: job.name,
      status: state,
      progress,
      data: job.data,
      returnValue,
      failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  /**
   * Get queue statistics
   */
  @Get('queue/stats')
  @ApiOperation({
    summary: 'Get email queue statistics',
    description: 'Retrieves statistics about the email queue',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
  })
  async getQueueStats() {
    const stats = await this.queueService.getQueueStats('notifications');
    return {
      queueName: 'notifications',
      ...stats,
    };
  }

  /**
   * Retry a failed email job
   */
  @Post('queue/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry failed email job',
    description: 'Retries a failed email job',
  })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job retried successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async retryJob(@Param('jobId') jobId: string) {
    await this.queueService.retryJob(ORDARO_JOB_TYPES.SEND_EMAIL, jobId);
    return {
      message: 'Job retried successfully',
      jobId,
    };
  }

  /**
   * Cancel a queued email job
   */
  @Post('queue/:jobId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel queued email job',
    description:
      'Cancels a queued email job (only works for jobs that are not yet processed)',
  })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({
    status: 200,
    description: 'Job cancelled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async cancelJob(@Param('jobId') jobId: string) {
    await this.queueService.removeJob(ORDARO_JOB_TYPES.SEND_EMAIL, jobId);
    return {
      message: 'Job cancelled successfully',
      jobId,
    };
  }

  /**
   * Queue Auth0 email for sending
   * This endpoint is called by Auth0 Actions when a custom email provider is configured
   */
  @Post('auth0')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ApiKeyGuard)
  @ApiOperation({
    summary: 'Queue Auth0 email for sending',
    description:
      'Endpoint for Auth0 Actions to queue emails through the custom email provider. Requires API key authentication.',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API key for authenticating Auth0 requests',
    required: true,
  })
  @ApiBody({
    type: Auth0EmailRequestDto,
    description: 'Auth0 email request data',
    examples: {
      verification: {
        summary: 'Verification Email',
        value: {
          type: 'verification_email',
          to: 'user@example.com',
          user: {
            id: 'auth0|123456789',
            email: 'user@example.com',
            name: 'John Doe',
          },
          application: {
            id: 'abc123',
            name: 'My App',
          },
          url: 'https://app.example.com/verify?token=abc123',
        },
      },
      passwordReset: {
        summary: 'Password Reset Email',
        value: {
          type: 'password_reset',
          to: 'user@example.com',
          user: {
            id: 'auth0|123456789',
            email: 'user@example.com',
            name: 'John Doe',
          },
          application: {
            id: 'abc123',
            name: 'My App',
          },
          url: 'https://app.example.com/reset?token=abc123',
        },
      },
      mfaCode: {
        summary: 'MFA Code Email',
        value: {
          type: 'mfa_code',
          to: 'user@example.com',
          user: {
            id: 'auth0|123456789',
            email: 'user@example.com',
            name: 'John Doe',
          },
          application: {
            id: 'abc123',
            name: 'My App',
          },
          code: '123456',
        },
      },
    },
  })
  @ApiResponse({
    status: 202,
    description: 'Auth0 email queued successfully',
    type: Auth0EmailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing API key',
  })
  async queueAuth0Email(
    @Body() auth0EmailDto: Auth0EmailRequestDto,
  ): Promise<Auth0EmailResponseDto> {
    // Prepare job data
    const jobData = {
      type: auth0EmailDto.type,
      to: auth0EmailDto.to,
      user: auth0EmailDto.user,
      application: auth0EmailDto.application,
      client: auth0EmailDto.client,
      organization: auth0EmailDto.organization,
      url: auth0EmailDto.url,
      code: auth0EmailDto.code,
      inviter: auth0EmailDto.inviter,
      reason: auth0EmailDto.reason,
      context: auth0EmailDto.context,
    };

    // Add job to queue
    const job = await this.queueService.addJob(
      ORDARO_JOB_TYPES.SEND_AUTH0_EMAIL,
      jobData,
    );

    // Ensure job ID is always a string
    if (!job.id) {
      this.logger.error('Job created but ID is missing');
      throw new HttpException(
        'Failed to create job: Job ID is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const jobState = await job.getState();
    const jobId = job.id ?? 'unknown';

    this.logger.log(
      `Auth0 email queued successfully: Type: ${auth0EmailDto.type}, To: ${auth0EmailDto.to}, Job ID: ${jobId}, Status: ${jobState}`,
    );

    return {
      jobId,
      jobType: ORDARO_JOB_TYPES.SEND_AUTH0_EMAIL,
      queueName: 'notifications',
      status: jobState,
      emailType: auth0EmailDto.type,
      recipient: auth0EmailDto.to,
    };
  }
}
