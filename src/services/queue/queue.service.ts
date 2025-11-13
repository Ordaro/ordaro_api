import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueOptions, Worker, WorkerOptions, Job } from 'bullmq';

import { ORDARO_JOB_TYPES } from './job-types.enum';

export interface JobData {
  [key: string]: unknown;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private readonly redisConnection: {
    host: string;
    port: number;
    password?: string;
  };

  constructor(private readonly configService: ConfigService) {
    const redisConfig = this.configService.get<{
      host?: string;
      port?: number;
      password?: string;
    }>('app.redis');

    const password = redisConfig?.password || process.env['REDIS_PASSWORD'];
    this.redisConnection = {
      host: redisConfig?.host || process.env['REDIS_HOST'] || 'localhost',
      port:
        redisConfig?.port || parseInt(process.env['REDIS_PORT'] || '6379', 10),
      ...(password && { password }),
    };
  }

  onModuleInit() {
    // Queues are created lazily when needed
    this.logger.log('Queue service initialized');
  }

  async onModuleDestroy() {
    // Close all workers
    for (const [name, worker] of this.workers.entries()) {
      await worker.close();
      this.logger.log(`Worker ${name} closed`);
    }

    // Close all queues
    for (const [name, queue] of this.queues.entries()) {
      await queue.close();
      this.logger.log(`Queue ${name} closed`);
    }
  }

  /**
   * Get or create a queue
   */
  getQueue(queueName: string, options?: QueueOptions): Queue {
    const existingQueue = this.queues.get(queueName);
    if (existingQueue) {
      return existingQueue;
    }

    const queue = new Queue(queueName, {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 24 * 3600, // Keep failed jobs for 24 hours
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
      ...options,
    });

    // Set up queue event listeners
    queue.on('error', (error: Error) => {
      this.logger.error(`Queue ${queueName} error:`, error);
    });

    this.queues.set(queueName, queue);
    this.logger.log(`Queue ${queueName} created`);
    return queue;
  }

  /**
   * Create a worker for a queue
   */
  createWorker(
    queueName: string,
    processor: (job: Job<JobData>) => Promise<unknown>,
    options?: WorkerOptions,
  ): Worker {
    if (this.workers.has(queueName)) {
      this.logger.warn(`Worker ${queueName} already exists, replacing...`);
      this.workers.get(queueName)?.close();
    }

    const worker = new Worker(
      queueName,
      async (job: Job<JobData>) => {
        this.logger.debug(
          `Processing job ${job.id ?? 'unknown'} of type ${job.name ?? 'unknown'} in queue ${queueName}`,
        );
        try {
          const result = await processor(job);
          this.logger.debug(
            `Job ${job.id ?? 'unknown'} completed successfully`,
          );
          return result;
        } catch (error) {
          this.logger.error(
            `Job ${job.id ?? 'unknown'} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          throw error;
        }
      },
      {
        connection: this.redisConnection,
        concurrency: 5, // Process 5 jobs concurrently
        ...options,
      },
    );

    // Set up worker event listeners
    worker.on('completed', (job: Job<JobData>) => {
      const attemptsMade = job.attemptsMade ?? 1;
      this.logger.log(
        `Job ${job.id ?? 'unknown'} completed successfully after ${attemptsMade} attempt(s)`,
      );
    });

    worker.on('failed', (job: Job<JobData> | undefined, err: Error) => {
      if (job) {
        const attemptsMade = job.attemptsMade ?? 0;
        const maxAttempts = job.opts.attempts ?? 3;
        this.logger.error(
          `Job ${job.id ?? 'unknown'} failed after ${attemptsMade}/${maxAttempts} attempts: ${err.message}`,
        );
      } else {
        this.logger.error(`Job failed: ${err.message}`);
      }
    });

    worker.on('active', (job: Job<JobData>) => {
      const attemptNumber = (job.attemptsMade ?? 0) + 1;
      this.logger.debug(
        `Job ${job.id ?? 'unknown'} is now active (attempt ${attemptNumber})`,
      );
    });

    worker.on('error', (err: Error) => {
      this.logger.error(`Worker ${queueName} error:`, err);
    });

    this.workers.set(queueName, worker);
    this.logger.log(`Worker ${queueName} created`);
    return worker;
  }

  /**
   * Add a job to a queue
   */
  async addJob(
    jobType: ORDARO_JOB_TYPES,
    data: JobData,
    options?: JobOptions,
  ): Promise<Job<JobData>> {
    const queueName = this.getQueueNameForJobType(jobType);
    const queue = this.getQueue(queueName);

    const jobOptions: {
      priority?: number;
      delay?: number;
      attempts?: number;
      removeOnComplete?: boolean | number;
      removeOnFail?: boolean | number;
    } = {};

    if (options?.priority !== undefined) {
      jobOptions.priority = options.priority;
    }
    if (options?.delay !== undefined) {
      jobOptions.delay = options.delay;
    }
    if (options?.attempts !== undefined) {
      jobOptions.attempts = options.attempts;
    }
    if (options?.removeOnComplete !== undefined) {
      jobOptions.removeOnComplete = options.removeOnComplete;
    }
    if (options?.removeOnFail !== undefined) {
      jobOptions.removeOnFail = options.removeOnFail;
    }

    const job = await queue.add(jobType, data, jobOptions);

    this.logger.debug(
      `Job ${job.id ?? 'unknown'} added to queue ${queueName} with type ${jobType}`,
    );
    return job;
  }

  /**
   * Get job status
   */
  async getJob(
    jobType: ORDARO_JOB_TYPES,
    jobId: string,
  ): Promise<Job<JobData> | undefined> {
    const queueName = this.getQueueNameForJobType(jobType);
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string) {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobType: ORDARO_JOB_TYPES, jobId: string): Promise<void> {
    const queueName = this.getQueueNameForJobType(jobType);
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    this.logger.log(`Job ${jobId} retried`);
  }

  /**
   * Remove a job
   */
  async removeJob(jobType: ORDARO_JOB_TYPES, jobId: string): Promise<void> {
    const queueName = this.getQueueNameForJobType(jobType);
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.remove();
    this.logger.log(`Job ${jobId} removed`);
  }

  /**
   * Clean old jobs from a queue
   */
  async cleanQueue(
    queueName: string,
    grace: number = 1000,
    limit: number = 100,
    status?: 'completed' | 'waiting' | 'active' | 'delayed' | 'failed',
  ): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.clean(grace, limit, status);
    this.logger.log(`Cleaned queue ${queueName}`);
  }

  /**
   * Get queue name for job type
   */
  private getQueueNameForJobType(jobType: ORDARO_JOB_TYPES): string {
    // Map job types to queue names
    if (jobType.startsWith('PROCESS_') || jobType.includes('ORDER')) {
      return 'orders';
    }
    if (jobType.startsWith('SEND_')) {
      return 'notifications';
    }
    if (jobType.startsWith('SYNC_')) {
      return 'sync';
    }
    if (jobType.includes('ANALYTICS') || jobType.includes('REPORT')) {
      return 'analytics';
    }
    return 'default';
  }
}
