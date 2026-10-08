import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Input, Label, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { baitlyCommerceApi as api } from '../../services/api/baitlyCommerceApi';

export default function BaitlyCommerceRefundPanel({ source, sourceId, reference }: { source: string; sourceId: number; reference?: string }) {
  const scope = useCommerceScope();
  const { t, currentLanguage } = useTranslation();
  const [amount, setAmount] = useState('');const [reason, setReason] = useState('');const [busy, setBusy] = useState(false);const [error, setError] = useState('');
  const pending = useRef(false);const attempt = useRef<{ key: string; id: string } | null>(null);
  const query = useQuery({ enabled: !!scope, queryKey: ['commerce-refunds', scope, source, sourceId, reference], queryFn: () => api.refundView(source, sourceId, reference), retry: false,
    refetchInterval: state => state.state.data?.refunds.some(row => row.status === 'PROCESSING' || (row.status === 'COMPLETED' && !row.applied)) ? 3000 : false });
  const data = query.data;
  async function submit() {
    if (!data || pending.current) return;pending.current = true;setBusy(true);setError('');
    try {
      const body = { reference: data.reference, amount: Number(amount), reason: reason.trim() };
      const key = JSON.stringify(body);if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
      await api.refund({ ...body, requestId: attempt.current.id });await query.refetch();setAmount('');setReason('');
    } catch (e) { setError(e instanceof Error ? e.message : t('commerceRefunds.failed')); }
    finally { pending.current = false;setBusy(false); }
  }
  const money = (value: number) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: data?.currency || 'EUR' }).format(value);
  return <section className="w-full space-y-3 border-t border-border pt-3">
    <h4 className="text-sm font-medium">{t('commerceRefunds.title')}</h4>
    {query.isPending && <Skeleton className="h-20 w-full" />}
    {(error || query.error) && <div role="alert" className="text-sm text-destructive-ink">{error || query.error?.message}
      {query.error && <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>{t('common.retry')}</Button>}</div>}
    {data && <>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        {(['paid', 'refunded', 'reserved', 'available'] as const).map(key => <div key={key}><dt className="text-muted-foreground">{t(`commerceRefunds.${key}`)}</dt><dd className="mt-1 text-sm tabular-nums">{money(data[key])}</dd></div>)}
      </dl>
      {data.refunds.map(row => <p key={row.reference} className="text-xs tabular-nums">{money(row.amount)} · {t(`commerceRefunds.states.${row.status}`, row.status)}{row.reason ? ` · ${row.reason}` : ''}</p>)}
      {data.available > 0 && data.reserved === 0 && data.refunds.every(row => row.applied) && <form onSubmit={e => { e.preventDefault();void submit(); }} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <Label className="grid gap-1.5">{t('commerceRefunds.amount')} ({data.currency})<Input required type="number" min="0.01" max={data.available} step="0.01" disabled={busy} value={amount} onChange={e => setAmount(e.target.value)} /></Label>
          <Label className="grid gap-1.5">{t('commerceRefunds.reason')}<Input required maxLength={1000} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></Label>
        </div>
        <p className="text-xs text-muted-foreground">{t('commerceRefunds.hint')}</p>
        <Button type="submit" variant="outline" disabled={busy || !reason.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > data.available}>{t('commerceRefunds.confirm', { amount: money(Number(amount) || 0) })}</Button>
      </form>}
    </>}
  </section>;
}
