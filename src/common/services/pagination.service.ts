import { Injectable } from '@nestjs/common';

import { PaginatedResponse } from '../interfaces/paginated-response.interface';
import { decodeCursor, encodeCursor, type CursorPayload } from '../utils/cursor.util';

export interface CursorFields {
  id: string;
  [key: string]: unknown; // Additional fields like createdAt
}

export interface PaginationOptions {
  limit: number;
  cursor?: string;
  orderBy?: string;
  orderDir: 'asc' | 'desc';
  sortableFields?: string[];
}

@Injectable()
export class PaginationService {
  private getItem<T>(arr: T[], index: number): T {
    if (index < 0 || index >= arr.length) {
      throw new Error('Index out of bounds');
    }
    const value = arr[index];
    if (value === undefined) {
      throw new Error('Unexpected undefined array element');
    }
    return value;
  }

  /**
   * Decode cursor from base64url
   */
  decodeCursor(cursor: string): CursorPayload | null {
    return decodeCursor(cursor);
  }

  /**
   * Encode cursor to base64url
   */
  encodeCursor(payload: CursorPayload): string {
    return encodeCursor(payload);
  }

  /**
   * Build paginated response with metadata
   * Enhanced with field-specific sorting support
   */
  buildPaginatedResponse<T extends Record<string, unknown>>(
    items: T[],
    limit: number,
    options: {
      orderBy?: string;
      orderDir?: 'asc' | 'desc';
      cursorField?: keyof T;
      additionalCursorFields?: (keyof T)[];
    } = {},
  ): PaginatedResponse<T> {
    const { orderBy, orderDir = 'desc', cursorField = 'id' as keyof T, additionalCursorFields = [] } = options;

    const hasNextPage = items.length > limit;
    const data = hasNextPage ? items.slice(0, -1) : items;

    let startCursor: string | undefined;
    let endCursor: string | undefined;

    if (data.length > 0) {
      const firstItem = this.getItem(data, 0);
      const lastItem = this.getItem(data, data.length - 1);

      // Use orderBy field if specified, otherwise use cursorField
      const sortField = orderBy || String(cursorField);

      startCursor = this.encodeCursor(
        this.extractCursorFields(firstItem, sortField, cursorField, additionalCursorFields),
      );
      endCursor = this.encodeCursor(
        this.extractCursorFields(lastItem, sortField, cursorField, additionalCursorFields),
      );
    }

    return {
      data,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: false, // Can be enhanced for bidirectional pagination
        startCursor,
        endCursor,
      },
    };
  }

  /**
   * Extract cursor fields from item
   */
  private extractCursorFields<T extends Record<string, unknown>>(
    item: T,
    sortField: string,
    idField: keyof T,
    additionalFields: (keyof T)[],
  ): CursorPayload {
    const sortValue = item[sortField];
    const idValue = item[idField];

    // Build tie breaker fields object
    const tieBreakerFields: Record<string, unknown> = {
      id: String(idValue ?? ''),
    };

    additionalFields.forEach((field) => {
      tieBreakerFields[String(field)] = item[field] ?? null;
    });

    return {
      field: sortField,
      value: sortValue as CursorPayload['value'],
      tieBreakerValue: idValue as CursorPayload['tieBreakerValue'],
    };
  }

  /**
   * Validate sort field against allowed sortable fields
   */
  validateSortField(sortField: string | undefined, sortableFields: string[]): string {
    if (!sortField) {
      return sortableFields[0] || 'createdAt';
    }

    if (sortableFields.includes(sortField)) {
      return sortField;
    }

    // Default to first sortable field if invalid
    return sortableFields[0] || 'createdAt';
  }

  /**
   * Build Prisma orderBy clause from pagination options
   */
  buildPrismaOrderBy(
    orderBy: string | undefined,
    orderDir: 'asc' | 'desc',
    sortableFields: string[],
    defaultField: string = 'createdAt',
  ): Record<string, 'asc' | 'desc'> {
    const validField = this.validateSortField(orderBy, sortableFields.length > 0 ? sortableFields : [defaultField]);
    return {
      [validField]: orderDir,
      id: orderDir, // Always include id as tie-breaker
    };
  }

  /**
   * Build Prisma where clause for cursor-based pagination
   */
  buildPrismaCursorWhere(
    cursor: string | undefined,
    orderBy: string,
    orderDir: 'asc' | 'desc',
  ): Record<string, unknown> | undefined {
    if (!cursor) {
      return undefined;
    }

    const decoded = this.decodeCursor(cursor);
    if (!decoded || decoded.field !== orderBy) {
      return undefined;
    }

    const operator = orderDir === 'asc' ? 'gt' : 'lt';

    // Prisma where clause for cursor pagination
    // (field > value) OR (field = value AND id > tieBreakerValue)
    return {
      OR: [
        {
          [orderBy]: {
            [operator]: decoded.value,
          },
        },
        {
          AND: [
            {
              [orderBy]: decoded.value,
            },
            {
              id: {
                [operator]: decoded.tieBreakerValue,
              },
            },
          ],
        },
      ],
    };
  }
}
