import { accountingApi, type OwnerPayout, type OwnerPayoutConfig } from '../../services/api/accountingApi';
import { getPayoutWorkflow } from './payoutWorkflow';
import type { FinanceBatchItem, FinanceBatchResult } from '../payments/FinanceBatchPanel';

export function ownerBatchItems(payouts: OwnerPayout[], configs: Map<number, OwnerPayoutConfig>, approve: boolean): FinanceBatchItem[] {
  return payouts.filter(payout => {
    const workflow = getPayoutWorkflow(payout, configs.get(payout.ownerId));
    return approve ? workflow.canApprove : workflow.canSend || workflow.canRetry;
  }).map(payout => ({ key: String(payout.id), label: `${payout.ownerName || `#${payout.ownerId}`} · ${payout.periodStart} → ${payout.periodEnd}`,
    amount: payout.netAmount, currency: payout.currency ?? 'EUR' }));
}

export async function executeOwnerBatch(items: FinanceBatchItem[], approve: boolean): Promise<FinanceBatchResult[]> {
  const results: FinanceBatchResult[] = [];
  for (const item of items) {
    try {
      // Relecture après le récapitulatif : un autre utilisateur peut avoir traité le dossier.
      const current = await accountingApi.getPayout(Number(item.key));
      const config = approve ? undefined : await accountingApi.getOwnerPayoutConfig(current.ownerId);
      const workflow = getPayoutWorkflow(current, config);
      if (current.netAmount !== item.amount || (current.currency ?? 'EUR') !== item.currency
          || !(approve ? workflow.canApprove : workflow.canSend || workflow.canRetry)) {
        results.push({ key: item.key, state: 'blocked' }); continue;
      }
      const result = approve ? await accountingApi.approvePayout(current.id)
        : workflow.canRetry ? await accountingApi.retryPayout(current.id) : await accountingApi.executePayout(current.id);
      results.push({ key: item.key, state: approve && result.status === 'APPROVED' ? 'approved'
        : ['PAID', 'PROCESSING'].includes(result.status) ? 'sent' : 'blocked', message: result.failureReason || undefined });
    } catch (cause) {
      results.push({ key: item.key, state: 'error', message: cause instanceof Error ? cause.message : undefined });
    }
  }
  return results;
}
