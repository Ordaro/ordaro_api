import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  formatErrorResponse,
  formatValidationErrorResponse,
  extractErrorInfo,
} from '../utils/format-errors.util';
import { ValidationError } from 'class-validator';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = request['correlationId'] || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ReturnType<typeof formatErrorResponse>['error'];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Handle validation errors
      if (
        status === HttpStatus.BAD_REQUEST &&
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse &&
        Array.isArray(exceptionResponse.message)
      ) {
        // Try to format as validation errors
        const messages = exceptionResponse.message as string[];
        const validationErrors: ValidationError[] = messages.map((msg, index) => ({
          property: `field_${index}`,
          constraints: { [msg]: msg },
          children: [],
        }));

        const formatted = formatValidationErrorResponse(validationErrors);
        errorResponse = formatted.error;
      } else {
        // Standard HTTP exception
        const message =
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as { message?: string }).message || exception.message;

        errorResponse = {
          message: Array.isArray(message) ? message.join(', ') : message,
          code: `HTTP_${status}`,
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
        };

        // Include error details in development
        if (process.env.NODE_ENV === 'development') {
          errorResponse.details = exceptionResponse;
        }
      }
    } else {
      // Unknown error
      const errorInfo = extractErrorInfo(exception);
      errorResponse = {
        message: errorInfo.message || 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      // Log full error details
      this.logger.error(
        {
          correlationId,
          error: errorInfo,
          stack: errorInfo.stack,
          url: request.url,
          method: request.method,
        },
        'Unhandled exception',
      );
    }

    // Log error with correlation ID
    this.logger.error(
      {
        correlationId,
        statusCode: errorResponse.statusCode,
        message: errorResponse.message,
        path: request.url,
        method: request.method,
      },
      `Request failed: ${request.method} ${request.url}`,
    );

    response.status(status).json({
      error: errorResponse,
      correlationId,
    });
  }
}

