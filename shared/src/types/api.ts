export type AssignmentType = 'user' | 'team';

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Extract array from an API response that may be:
 * - a plain array: T[]
 * - a Spring Data paginated response: { content: T[] }
 */
export function extractApiList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'content' in data) {
    const paginated = data as { content: unknown };
    if (Array.isArray(paginated.content)) return paginated.content as T[];
  }
  return [];
}
