import { ValidationError } from 'class-validator';

export interface FormattedError {
  message: string;
  code?: string;
  field?: string;
  details?: Record<string, unknown>;
}

/**
 * Format class-validator validation errors
 */
export function formatValidationErrors(errors: ValidationError[]): FormattedError[] {
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
  return formatValidationErrors([error])[0];
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
      stack: error.stack,
      name: error.name,
      code: (error as Error & { code?: string }).code,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    return {
      message: String(errorObj.message || 'Unknown error'),
      stack: errorObj.stack as string | undefined,
      name: errorObj.name as string | undefined,
      code: errorObj.code as string | undefined,
    };
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
  const isDevelopment = process.env.NODE_ENV === 'development';

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
      code: errorInfo.code,
      timestamp: new Date().toISOString(),
      ...(options?.context?.path && { path: options.context.path as string }),
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

