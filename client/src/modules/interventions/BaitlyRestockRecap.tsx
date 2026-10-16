import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { baitlyRestockApi } from '../../services/api/baitlyRestockApi';
import { StockThumbnail } from '../stock/StockThumbnail';
import { activeIntlLocale } from '../../utils/activeLocale';
import { useTranslation } from '../../hooks/useTranslation';
export function BaitlyRestockRecap({ id }: { id: number }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['baitly-restock-recap', id], queryFn: () => baitlyRestockApi.history(id) });
  const entries = query.data?.flatMap(receipt => receipt.entries).filter(entry => entry.added > 0) ?? [];
  if (query.isError) return <p role="status" className="text-sm text-muted-foreground">{t('paymentDetail.expensesUnavailable')}</p>;
  if (!entries.length) return null;
  return <section className="my-3 space-y-2" aria-label={t('paymentDetail.restockExpenses')}>
    <h4 className="text-sm font-semibold">{t('paymentDetail.restockExpenses')}</h4>
    {entries.map((entry,index) => <div key={index} className="flex items-center gap-3">
      <StockThumbnail name={entry.name} size={44} />
      <div className="flex-1 text-sm"><p>{entry.name} · +{entry.added}</p><p className="text-muted-foreground tabular-nums">{entry.before} → {entry.observed} + {entry.added} = {entry.after}</p></div>
      <span className="text-sm tabular-nums">{new Intl.NumberFormat(activeIntlLocale(),{ style: 'currency', currency: entry.currency }).format(entry.amount)}</span>
    </div>)}
  </section>;
}
