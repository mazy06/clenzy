import { useEffect } from 'react';
import { interventionsApi } from '../../services/api/interventionsApi';
import { paymentsApi } from '../../services/api/paymentsApi';
const NO_SERIES: Record<number,string> = {};

/** Le PSP peut confirmer avant le consumer Baitly : relire le métier, sans réémettre d'ordre. */
export function useRefundFollowUp(ids: number[], onConfirmed: (ids: number[]) => void, series: Record<number,string> = NO_SERIES) {
  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let remaining = ids;

    const refresh = async () => {
      const results = await Promise.allSettled(remaining.map(async id => series[id]
        ? (await paymentsApi.refundInstallmentStatus(series[id])).reconciled
        : (await interventionsApi.getById(id)).paymentStatus === 'REFUNDED'));
      if (cancelled) return;
      const confirmed = remaining.filter((_, index) => {
        const result = results[index];
        return result.status === 'fulfilled' && result.value;
      });
      remaining = remaining.filter(id => !confirmed.includes(id));
      if (confirmed.length > 0) onConfirmed(confirmed);
      // Les erreurs de lecture ne prouvent ni échec ni succès du remboursement.
      if (remaining.length > 0) timer = setTimeout(refresh, ++attempts < 15 ? 2000 : 15000);
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ids, onConfirmed, series]);
}
