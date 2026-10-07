export type FinanceAmountKind = 'payments' | 'invoices' | 'payouts' | 'expenses' | 'tracking';
export interface FinanceAmountRecord {
  status: string;
  amount: number | null | undefined;
  currency: string | null | undefined;
  /** Remaining amount confirmed by the API; never infer it from a partial-payment status. */
  dueAmount?: number | null;
  paidToOta?: boolean;
  refundedAmount?: number;
  creditAppliedAmount?: number;
  refundReviewRequired?: boolean;
}

export function sumFinanceAmounts(records: FinanceAmountRecord[]) {
  const totals = new Map<string, number>();
  let unavailable = 0;
  for (const record of records) {
    const currency = record.currency?.trim().toUpperCase();
    if (record.amount == null || !Number.isFinite(record.amount) || !currency || !/^[A-Z]{3}$/.test(currency)) {
      unavailable++;
      continue;
    }
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
    const factor = 10 ** digits;
    // Sum minor units so, for example, 0.1 + 0.2 is exactly 0.3.
    totals.set(currency, (Math.round((totals.get(currency) ?? 0) * factor) + Math.round(record.amount * factor)) / factor);
  }
  return { totals: [...totals].sort(([a], [b]) => a.localeCompare(b)), unavailable };
}

export function financeAmountGroups(records: FinanceAmountRecord[], kind: FinanceAmountKind) {
  const active = records.filter(r => !['CANCELLED', 'REFUNDED', 'CREDIT_NOTE', 'NOT_REQUIRED'].includes(r.status))
    .map(r => kind === 'payments' && r.status === 'PARTIALLY_REFUNDED' ? { ...r,
      amount: Number.isFinite(r.refundedAmount) && r.refundedAmount! > 0 && r.amount != null
        && Number.isFinite(r.creditAppliedAmount ?? 0) && (r.creditAppliedAmount ?? 0) >= 0
        && r.refundedAmount! <= r.amount - (r.creditAppliedAmount ?? 0)
        ? Math.round((r.amount - (r.creditAppliedAmount ?? 0) - r.refundedAmount!) * 100) / 100 : null,
    } : r);
  const pending = ['PENDING', 'DRAFT', 'ISSUED', 'APPROVED', 'PROCESSING', 'SUBMITTING', 'PARTIALLY_PAID'];
  // SENT means an unpaid invoice, but an executed provider transfer.
  if (kind === 'invoices') pending.push('SENT');
  // Une retenue propriétaire reste due au prestataire jusqu'à sa preuve PSP.
  if (kind === 'expenses') pending.push('INCLUDED');
  const done = ['PAID', 'TRANSFERRED', ...(kind === 'payments' ? ['PARTIALLY_REFUNDED'] : []), ...(kind === 'payouts' ? ['SENT'] : [])];
  const groups = [
    { key: 'all', artwork: 'documents' as const, records: active },
    { key: 'pending', artwork: 'pending' as const, records: active.filter(r => pending.includes(r.status)).map(r => ({ ...r,
      amount: kind === 'payments' ? r.dueAmount ?? (r.status === 'PARTIALLY_PAID' ? null : r.amount) : r.amount,
    })) },
    { key: 'done', artwork: 'transfer' as const, records: active.filter(r => done.includes(r.status)) },
    ...(kind === 'payments' ? [{ key: 'ota', artwork: 'received' as const, records: active.filter(r => r.status === 'PAID' && r.paidToOta === true) }] : []),
    { key: 'review', artwork: 'received' as const, records: active.filter(r => r.refundReviewRequired || ['UNKNOWN', 'FAILED', 'BLOCKED', 'OVERDUE', 'RECONCILIATION_REQUIRED'].includes(r.status)) },
  ];
  const currencies = sumFinanceAmounts(active).totals.map(([currency]) => currency);
  return groups.map(group => {
    const amounts = sumFinanceAmounts(group.records);
    return { ...group, count: group.records.length, ...amounts,
      // Empty groups still show an explicit zero in the actual currencies of this list.
      totals: group.records.length === 0 ? currencies.map(currency => [currency, 0] as [string, number]) : amounts.totals,
    };
  });
}
