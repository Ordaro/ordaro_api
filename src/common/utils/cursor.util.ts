export interface CursorPayload {
  field: string;
  tieBreakerValue: CursorValue;
  value: CursorValue;
}

export type CursorValue = boolean | null | number | string;

/**
 * Decode cursor from base64url
 */
export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString();
    const payload: unknown = JSON.parse(decoded);

    // Basic validation to ensure it looks like a CursorPayload
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'field' in payload &&
      'value' in payload &&
      'tieBreakerValue' in payload
    ) {
      return payload as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Encode cursor to base64url
 */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}
