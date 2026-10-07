import type { PaymentRecord } from '../../services/api/paymentsApi';
import { paymentsApi } from '../../services/api/paymentsApi';
import { serviceRequestsApi } from '../../services/api/serviceRequestsApi';
import type { FinanceBatchItem, FinanceBatchResult } from './FinanceBatchPanel';

export function payableItems(records: PaymentRecord[]): FinanceBatchItem[] {
  return records.filter(record => (record.type === 'INTERVENTION' || record.type === 'SERVICE_REQUEST')
    && record.canCollect === true && ['PENDING', 'FAILED'].includes(record.status)
    && Number.isFinite(record.payableAmount ?? record.amount) && (record.payableAmount ?? record.amount) > 0)
    .map(record => ({ key: `${record.type}:${record.referenceId}`, label: record.description,
      amount: record.payableAmount ?? record.amount, currency: record.currency || 'EUR',
      individualCheckout: record.individualCheckout,
      identity: { propertyName: record.propertyName,
        interventionId: record.type === 'INTERVENTION' ? record.referenceId : undefined,
        serviceRequestId: record.type === 'SERVICE_REQUEST' ? record.referenceId : undefined },
    }));
}

/** Un checkout par devise pour les interventions ; une demande de service conserve son propre checkout. */
export async function prepareBatchPayments(items: FinanceBatchItem[]): Promise<FinanceBatchResult[]> {
  const groups = new Map<string, FinanceBatchItem[]>();
  for (const item of items) {
    const group = item.key.startsWith('INTERVENTION:') && !item.individualCheckout ? item.currency : item.key;
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  const results: FinanceBatchResult[] = [];
  // Borner la liste d'identifiants garde la clé d'idempotence et les métadonnées PSP valides,
  // même quand « Tous » couvre des centaines de dossiers.
  const batches: FinanceBatchItem[][] = [];
  for (const group of groups.values()) {
    let batch: FinanceBatchItem[] = [];
    for (const item of group) {
      if (batch.map(value => value.key.split(':')[1]).join('-').length + item.key.split(':')[1].length + 1 > 180) {
        batches.push(batch); batch = [];
      }
      batch.push(item);
    }
    if (batch.length) batches.push(batch);
  }
  for (const group of batches) {
    try {
      const first = group[0];
      let url: string;
      if (first.key.startsWith('INTERVENTION:') && first.individualCheckout) {
        url = (await paymentsApi.createSession({ interventionId: Number(first.key.split(':')[1]), amount: first.amount, purpose: 'FULL', returnUrl: `${window.location.origin}/billing?tab=payments` })).url;
      } else if (first.key.startsWith('INTERVENTION:')) {
        const session = await paymentsApi.createBatchSession({
          interventionIds: group.map(item => Number(item.key.split(':')[1])),
          totalAmount: Math.round(group.reduce((sum, item) => sum + item.amount, 0) * 100) / 100,
          returnUrl: `${window.location.origin}/billing?tab=payments`,
        });
        url = session.url;
      } else {
        url = (await serviceRequestsApi.createPaymentSession(Number(first.key.split(':')[1]))).checkoutUrl;
      }
      if (!url || !/^https:\/\//.test(url)) throw new Error('Le PSP n’a pas fourni de lien de paiement sécurisé.');
      results.push(...group.map(item => ({ key: item.key, state: 'ready' as const, url })));
    } catch (cause) {
      results.push(...group.map(item => ({ key: item.key, state: 'error' as const,
        message: cause instanceof Error ? cause.message : 'Préparation du paiement impossible.' })));
    }
  }
  return results;
}
