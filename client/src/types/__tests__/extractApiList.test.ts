import { describe, it, expect } from 'vitest';
import { extractApiList, type PaginatedResponse } from '../index';

describe('extractApiList', () => {
  // ─── Direct array input ──────────────────────────────────────────────────

  it('returns the array as-is when input is already an array', () => {
    const input = [{ id: 1 }, { id: 2 }];
    expect(extractApiList(input)).toEqual(input);
  });

  it('returns empty array for empty array input', () => {
    expect(extractApiList([])).toEqual([]);
  });

  // ─── Paginated response (Spring Data format) ─────────────────────────────

  it('extracts content from a Spring Data paginated response', () => {
    const paginated: PaginatedResponse<{ id: number }> = {
      content: [{ id: 1 }, { id: 2 }, { id: 3 }],
      totalElements: 3,
      totalPages: 1,
      size: 20,
      number: 0,
    };
    expect(extractApiList(paginated)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('returns empty array when paginated content is empty', () => {
    const paginated: PaginatedResponse<{ id: number }> = {
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 20,
      number: 0,
    };
    expect(extractApiList(paginated)).toEqual([]);
  });

  it('extracts content from a minimal object with content array', () => {
    const input = { content: [{ name: 'Alice' }] };
    expect(extractApiList(input)).toEqual([{ name: 'Alice' }]);
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  it('returns empty array for null input', () => {
    expect(extractApiList(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(extractApiList(undefined)).toEqual([]);
  });

  it('returns empty array for string input', () => {
    expect(extractApiList('not an array')).toEqual([]);
  });

  it('returns empty array for number input', () => {
    expect(extractApiList(42)).toEqual([]);
  });

  it('returns empty array for object without content property', () => {
    expect(extractApiList({ data: [1, 2, 3] })).toEqual([]);
  });

  it('returns empty array when content is not an array', () => {
    expect(extractApiList({ content: 'not an array' })).toEqual([]);
  });

  it('returns empty array for empty object', () => {
    expect(extractApiList({})).toEqual([]);
  });
});
