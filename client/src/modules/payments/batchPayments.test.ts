import { beforeEach, expect, it, vi } from 'vitest';
import { paymentsApi, type PaymentRecord } from '../../services/api/paymentsApi';
import { serviceRequestsApi } from '../../services/api/serviceRequestsApi';
import { payableItems, prepareBatchPayments } from './batchPayments';
vi.mock('../../services/api/paymentsApi', () => ({ paymentsApi: { createBatchSession: vi.fn() } }));
vi.mock('../../services/api/serviceRequestsApi', () => ({ serviceRequestsApi: { createPaymentSession: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
it('exclut les réservations, paiements incertains, déjà payés et non éligibles', () => {
  const record = { id: 1, referenceId: 1, description: 'Ménage', propertyName: 'Maison', type: 'INTERVENTION', status: 'PENDING', canCollect: true, amount: 20, currency: 'EUR' } as PaymentRecord;
  expect(payableItems([record, { ...record, type: 'RESERVATION' }, { ...record, status: 'PAID' }, { ...record, status: 'UNKNOWN' }, { ...record, canCollect: undefined }])).toHaveLength(1);
  expect(payableItems([{ ...record, payableAmount: 12 }])[0].amount).toBe(12);
  expect(payableItems([{ ...record, payableAmount: 0 }])).toEqual([]);
});
it('découpe une sélection volumineuse sans perdre ni répéter de dossier', async () => {
  vi.mocked(paymentsApi.createBatchSession).mockResolvedValue({ sessionId: 's1', url: 'https://checkout.stripe.com/test' });
  const items = Array.from({ length: 100 }, (_, index) => ({ key: `INTERVENTION:${10000 + index}`, label: 'Mission', amount: 20, currency: 'EUR' }));
  const results = await prepareBatchPayments(items);
  expect(results).toHaveLength(100);
  const calls = vi.mocked(paymentsApi.createBatchSession).mock.calls.map(([data]) => data);
  expect(calls.length).toBeGreaterThan(1);
  expect(calls.flatMap(data => data.interventionIds)).toEqual(items.map(item => Number(item.key.split(':')[1])));
  expect(calls.every(data => data.interventionIds.join('-').length <= 180)).toBe(true);
});
it('regroupe par devise, conserve les demandes séparées et continue après un échec', async () => {
  vi.mocked(paymentsApi.createBatchSession).mockResolvedValueOnce({ sessionId: 's1', url: 'https://checkout.stripe.com/test1' }).mockRejectedValueOnce(new Error('Devise indisponible'));
  vi.mocked(serviceRequestsApi.createPaymentSession).mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/service' });
  const result = await prepareBatchPayments([
    { key: 'INTERVENTION:1', label: 'A', amount: 20, currency: 'EUR' },
    { key: 'INTERVENTION:2', label: 'B', amount: 30, currency: 'EUR' },
    { key: 'INTERVENTION:3', label: 'C', amount: 40, currency: 'MAD' },
    { key: 'SERVICE_REQUEST:4', label: 'D', amount: 50, currency: 'EUR' },
  ]);
  expect(paymentsApi.createBatchSession).toHaveBeenCalledWith(expect.objectContaining({ interventionIds: [1, 2], totalAmount: 50 }));
  expect(result.map(value => value.state)).toEqual(['ready', 'ready', 'error', 'ready']);
});
