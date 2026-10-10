import { afterEach, expect, it, vi } from 'vitest';
import { paymentsApi, type PaymentRecord, type PaymentHistoryResponse } from '../paymentsApi';

afterEach(() => vi.restoreAllMocks());

const record = (id: number) => ({ type: 'RESERVATION', referenceId: id }) as PaymentRecord;

it('loads the staging portfolio of 456 dossiers in one bounded request', async () => {
  const history = vi.spyOn(paymentsApi, 'getHistory').mockImplementation(async ({ page = 0, size = 10 } = {}) => ({
    content: Array.from({ length: 456 }, (_, i) => record(i + 1)).slice(page * size, (page + 1) * size),
    totalPages: Math.ceil(456 / size), totalElements: 456,
  }) as PaymentHistoryResponse);
  const records = await paymentsApi.getAllHistory({ hostId: 7, status: 'PENDING' });
  expect(records).toHaveLength(456);
  expect(history).toHaveBeenCalledTimes(1);
  expect(history).toHaveBeenCalledWith({ hostId: 7, status: 'PENDING', page: 0, size: 500 });
});

it('keeps all pages, filters and distinct source IDs beyond one batch', async () => {
  const history = vi.spyOn(paymentsApi, 'getHistory')
    .mockResolvedValueOnce({ content: [record(1)], totalPages: 2 } as PaymentHistoryResponse)
    .mockResolvedValueOnce({ content: [record(1), { type: 'INTERVENTION', referenceId: 1 }], totalPages: 2 } as PaymentHistoryResponse);
  expect(await paymentsApi.getAllHistory({ hostId: 7 })).toEqual([record(1), { type: 'INTERVENTION', referenceId: 1 }]);
  expect(history).toHaveBeenNthCalledWith(2, { hostId: 7, page: 1, size: 500 });
});

it('applies inclusive date filters even when the backend ignores these query parameters', async () => {
  const withDate = (id: number, transactionDate?: string) => ({ ...record(id), transactionDate });
  vi.spyOn(paymentsApi, 'getHistory')
    .mockResolvedValueOnce({ content: [withDate(1, '2026-09-30T12:00:00'), withDate(2, '2026-10-01T12:00:00')], totalPages: 2 } as PaymentHistoryResponse)
    .mockResolvedValueOnce({ content: [withDate(3, '2026-10-10T12:00:00'), withDate(4, '2026-10-11T12:00:00'), withDate(5)], totalPages: 2 } as PaymentHistoryResponse);
  expect((await paymentsApi.getAllHistory({ dateFrom: '2026-10-01', dateTo: '2026-10-10' })).map(row => row.referenceId)).toEqual([2, 3]);
});

it('rejects an incomplete history instead of returning partial financial totals', async () => {
  vi.spyOn(paymentsApi, 'getHistory')
    .mockResolvedValueOnce({ content: [record(1)], totalPages: 2 } as PaymentHistoryResponse)
    .mockRejectedValueOnce(new Error('network'));
  await expect(paymentsApi.getAllHistory()).rejects.toThrow('network');
});
