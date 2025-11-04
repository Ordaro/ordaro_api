import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino, { Logger } from 'pino';

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: Logger;
  private readonly isDevelopment: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isDevelopment =
      this.configService.get<string>('app.nodeEnv') === 'development';

    const logLevel =
      this.configService.get<string>('app.logging.level') ||
      (this.isDevelopment ? 'debug' : 'info');

    this.logger = pino({
      level: logLevel,
      transport: this.isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    });
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.logger.info({ context: optionalParams }, message);
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(
      {
        trace,
        context,
      },
      message,
    );
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.logger.warn({ context: optionalParams }, message);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.logger.debug({ context: optionalParams }, message);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.logger.trace({ context: optionalParams }, message);
  }

  /**
   * Get the underlying Pino logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }
}

/**
 * Create a Pino logger instance (for use outside of NestJS DI)
 */
export function createLogger(): Logger {
  const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging';
  const logLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');

  return pino({
    level: logLevel,
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
}

/**
 * Default logger instance (for use in utilities)
 */
export const logger = createLogger();

