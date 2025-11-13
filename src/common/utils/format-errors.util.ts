import type { ValidationError } from 'class-validator';

export interface FormattedError {
  message: string;
  code?: string;
  field?: string;
  details?: Record<string, unknown>;
}

/**
 * Format class-validator validation errors
 */
export function formatValidationErrors(
  errors: ValidationError[],
): FormattedError[] {
  return errors.map((error) => {
    const formatted: FormattedError = {
      message: error.constraints
        ? Object.values(error.constraints).join(', ')
        : 'Validation failed',
      field: error.property,
    };

    if (error.constraints) {
      formatted.details = error.constraints;
    }

    // Recursively format nested errors
    if (error.children && error.children.length > 0) {
      formatted.details = {
        ...formatted.details,
        nested: formatValidationErrors(error.children),
      };
    }

    return formatted;
  });
}

/**
 * Format a single validation error
 */
export function formatValidationError(error: ValidationError): FormattedError {
  const formatted = formatValidationErrors([error]);
  if (formatted.length === 0) {
    throw new Error('Failed to format validation error');
  }
  const result = formatted[0];
  if (!result) {
    throw new Error('Failed to format validation error');
  }
  return result;
}

/**
 * Extract error information from unknown error type
 */
export function extractErrorInfo(error: unknown): {
  message: string;
  stack?: string;
  name?: string;
  code?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      ...(error.stack && { stack: error.stack }),
      ...(error.name && { name: error.name }),
      ...((error as Error & { code?: string }).code && {
        code: (error as Error & { code?: string }).code,
      }),
    };
  }

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    const messageValue = errorObj['message'];
    let message: string;
    if (typeof messageValue === 'string') {
      message = messageValue;
    } else if (messageValue == null) {
      message = 'Unknown error';
    } else if (
      typeof messageValue === 'number' ||
      typeof messageValue === 'boolean'
    ) {
      message = String(messageValue);
    } else {
      message = 'Unknown error';
    }

    const result: {
      message: string;
      stack?: string;
      name?: string;
      code?: string;
    } = {
      message,
    };

    const stack = errorObj['stack'];
    if (typeof stack === 'string') {
      result.stack = stack;
    }

    const name = errorObj['name'];
    if (typeof name === 'string') {
      result.name = name;
    }

    const code = errorObj['code'];
    if (typeof code === 'string') {
      result.code = code;
    }

    return result;
  }

  return {
    message: String(error),
  };
}

/**
 * Format error for API response
 */
export function formatErrorResponse(
  error: unknown,
  options?: {
    includeStack?: boolean;
    includeDetails?: boolean;
    context?: Record<string, unknown>;
  },
): {
  error: {
    message: string;
    code?: string;
    statusCode?: number;
    details?: unknown;
    timestamp: string;
    path?: string;
  };
} {
  const errorInfo = extractErrorInfo(error);
  const isDevelopment = process.env['NODE_ENV'] === 'development';

  const response: {
    error: {
      message: string;
      code?: string;
      statusCode?: number;
      details?: unknown;
      timestamp: string;
      path?: string;
      stack?: string;
    };
  } = {
    error: {
      message: errorInfo.message,
      ...(errorInfo.code && { code: errorInfo.code }),
      timestamp: new Date().toISOString(),
      ...(options?.context &&
      typeof options.context === 'object' &&
      options.context !== null &&
      'path' in options.context &&
      options.context['path']
        ? (() => {
            const pathValue = options.context['path'];
            let path: string;
            if (typeof pathValue === 'string') {
              path = pathValue;
            } else if (
              typeof pathValue === 'number' ||
              typeof pathValue === 'boolean'
            ) {
              path = String(pathValue);
            } else {
              path = '';
            }
            return { path };
          })()
        : {}),
    },
  };

  // Include stack trace in development
  if (options?.includeStack && isDevelopment && errorInfo.stack) {
    response.error.stack = errorInfo.stack;
  }

  // Include details if requested
  if (options?.includeDetails) {
    response.error.details = errorInfo;
  }

  return response;
}

/**
 * Format validation errors for API response
 */
export function formatValidationErrorResponse(errors: ValidationError[]): {
  error: {
    message: string;
    code: string;
    statusCode: number;
    errors: FormattedError[];
    timestamp: string;
  };
} {
  return {
    error: {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      errors: formatValidationErrors(errors),
      timestamp: new Date().toISOString(),
    },
  };
}
