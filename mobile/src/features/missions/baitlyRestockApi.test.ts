import { useBaitlyDataMode } from '@/config/baitlyDataMode';
import { useBaitlyDemoProfile } from '@/config/baitlyDemoProfileState';
import { restockApi } from './baitlyRestockApi';
jest.mock('@/api/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
afterEach(() => { useBaitlyDataMode.getState().setMode('real'); useBaitlyDemoProfile.getState().select(null); });
it('records a stock snapshot and cost once, even when a confirmation is retried', async () => {
  useBaitlyDataMode.getState().setMode('demo'); useBaitlyDemoProfile.getState().select('cleaning');
  const before = await restockApi.list(-600);
  const request = { requestKey: 'same-confirmation', lines: [{ itemId: -21, expected: 1, observed: 1, added: 2, unitPrice: 2.50 }] };
  const receipt = await restockApi.record(-600, request); await restockApi.record(-600, request);
  const after = await restockApi.list(-600);
  expect(receipt.entries[0]).toMatchObject({ before: 1, observed: 1, added: 2, after: 3, amount: 5 });
  expect(after.items[0].quantity).toBe(3); expect(after.history).toHaveLength(1);
  expect(before.items[0].quantity).toBe(1);
  await expect(restockApi.record(-600, { ...request, requestKey: 'stale-confirmation' })).rejects.toMatchObject({ status: 409 });
});
