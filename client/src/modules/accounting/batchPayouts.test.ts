import { beforeEach, expect, it, vi } from 'vitest';
import { accountingApi, type OwnerPayout, type OwnerPayoutConfig } from '../../services/api/accountingApi';
import { executeOwnerBatch } from './batchPayouts';
vi.mock('../../services/api/accountingApi', () => ({ accountingApi: { getPayout: vi.fn(), getOwnerPayoutConfig: vi.fn(), executePayout: vi.fn(), approvePayout: vi.fn(), retryPayout: vi.fn() } }));
const payout = { id: 1, ownerId: 2, netAmount: 80, currency: 'EUR', fundingVersion: 1, status: 'APPROVED', retryCount: 0 } as OwnerPayout;
const item = { key: '1', label: 'Propriétaire', amount: 80, currency: 'EUR' };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(accountingApi.getOwnerPayoutConfig).mockResolvedValue({ payoutMethod: 'STRIPE_CONNECT', verified: true, stripeOnboardingComplete: true, stripeConnectedAccountId: 'acct_test' } as OwnerPayoutConfig); });
it('ne relance pas un transfert déjà envoyé depuis la sélection', async () => {
  vi.mocked(accountingApi.getPayout).mockResolvedValue({ ...payout, status: 'PAID', stripeTransferId: 'tr_existing' });
  expect((await executeOwnerBatch([item], false))[0].state).toBe('blocked');
  expect(accountingApi.executePayout).not.toHaveBeenCalled();
});
it('n’exécute pas un montant modifié depuis le récapitulatif', async () => {
  vi.mocked(accountingApi.getPayout).mockResolvedValue({ ...payout, netAmount: 100 });
  expect((await executeOwnerBatch([item], false))[0].state).toBe('blocked');
});
it('rapporte un échec métier même si la requête HTTP réussit', async () => {
  vi.mocked(accountingApi.getPayout).mockResolvedValue(payout);
  vi.mocked(accountingApi.executePayout).mockResolvedValue({ ...payout, status: 'FAILED', failureReason: 'Solde insuffisant' });
  expect((await executeOwnerBatch([item], false))[0]).toMatchObject({ state: 'blocked', message: 'Solde insuffisant' });
});
it('approuve sans appeler le PSP', async () => {
  vi.mocked(accountingApi.getPayout).mockResolvedValue({ ...payout, status: 'PENDING' });
  vi.mocked(accountingApi.approvePayout).mockResolvedValue(payout);
  expect((await executeOwnerBatch([item], true))[0].state).toBe('approved');
  expect(accountingApi.executePayout).not.toHaveBeenCalled();
});
