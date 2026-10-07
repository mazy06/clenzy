import BaitlySaleDocuments from '../../payments/BaitlySaleDocuments';
import { useCommerceScope } from '../../../hooks/useCommerceScope';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { baitlyCommerceApi } from '../../../services/api/baitlyCommerceApi';
import BaitlyCommerceRefundPanel from '../../payments/BaitlyCommerceRefundPanel';

export default function BaitlyCreditPurchases() {
  const scope = useCommerceScope();
  const { t, currentLanguage } = useTranslation();const [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({ enabled: !!scope, queryKey: ['credit-purchases', scope], queryFn: baitlyCommerceApi.creditPurchases, retry: false });
  return <section className="space-y-3 border-t border-border pt-3">
    <h3 className="text-sm font-medium">{t('aiCredits.purchases')}</h3>
    {query.isPending && <Skeleton className="h-12 w-full" />}
    {query.error && <p role="alert" className="text-sm text-destructive-ink">{query.error.message}</p>}
    {query.data?.map(row => <div key={row.reference}>
      <Button variant="ghost" className="w-full justify-between gap-2" aria-expanded={selected === row.reference} onClick={() => setSelected(selected === row.reference ? null : row.reference)}>
        <span className="truncate">{row.reference}</span><span className="tabular-nums">{new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: row.currency }).format(row.amount)}</span>
      </Button>
      {selected === row.reference && <><BaitlyCommerceRefundPanel key={row.reference} source="AI_CREDIT_TOPUP" sourceId={0} reference={row.reference} /><BaitlySaleDocuments source="AI_CREDIT_TOPUP" reference={row.reference} /></>}
    </div>)}
    {query.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('aiCredits.noPurchases')}</p>}
  </section>;
}
