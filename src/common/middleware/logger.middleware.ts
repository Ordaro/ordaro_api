import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { createLogger } from '../services/logger.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = createLogger();

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const correlationIdHeader = req.headers['x-correlation-id'];
    const correlationId: string = Array.isArray(correlationIdHeader)
      ? correlationIdHeader[0] ||
        `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      : correlationIdHeader ||
        `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // Add correlation ID to request
    (req as Request & { correlationId?: string }).correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    // Log request
    this.logger.info(
      {
        correlationId,
        method: req.method,
        url: req.url,
        query: req.query,
        userAgent: req.get('user-agent'),
        ip: req.ip,
      },
      `→ ${req.method} ${req.url}`,
    );

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? 'error' : 'info';

      this.logger[logLevel](
        {
          correlationId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
        },
        `← ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`,
      );
    });

    next();
  }
}
