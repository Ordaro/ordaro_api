export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | undefined;
  endCursor?: string | undefined;
  totalCount?: number; // Optional, expensive for large datasets
}

export interface PaginatedResponse<T> {
  data: T[];
  pageInfo: PageInfo;
}
