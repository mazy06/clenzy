import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2 } from '../../icons/glyphs';
import { Alert, AlertDescription, Button, Input, Skeleton } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { baitlyExternalBatchRefundsApi as api, type ExternalBatchRefund } from '../../services/api/baitlyExternalBatchRefundsApi';

export default function BaitlyExternalBatchRefundPanel({ interventionId, label }: { interventionId: number; label: string }) {
  const { user, hasRole } = useAuth();
  if (!user || !(hasRole('SUPER_ADMIN') || hasRole('SUPER_MANAGER'))) return null;
  const scope = `${user.id}:${user.organizationId}:${interventionId}`;
  return <Panel key={scope} scope={scope} interventionId={interventionId} label={label} />;
}

function Panel({ scope, interventionId, label }: { scope: string; interventionId: number; label: string }) {
  const { t, currentLanguage } = useTranslation();
  const rows = useQuery({ queryKey: ['external-batch-refunds', scope], queryFn: () => api.list(interventionId),
    refetchInterval: query => query.state.data?.some(row => !row.confirmed && (row.assigned || !row.assignable)) ? 5000 : false });
  const [selected, setSelected] = useState<ExternalBatchRefund | null>(null);
  const [reason, setReason] = useState(''); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [distribute, setDistribute] = useState(false);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const targets = useQuery({ queryKey: ['external-batch-refund-targets', scope], queryFn: () => api.targets(interventionId), enabled: distribute && !!selected });
  const portions = (targets.data ?? []).map(target => ({ interventionId: target.interventionId, amount: Number((amounts[target.interventionId] ?? '').replace(',', '.')) }))
    .filter(portion => portion.amount !== 0);
  const allocatedCents = portions.reduce((total, portion) => total + Math.round(portion.amount * 100), 0);
  const exactDistribution = !!targets.data?.length && !targets.isFetching && !targets.isError && portions.length > 0
    && portions.every(part => Number.isFinite(part.amount) && part.amount > 0 && /^\d+(?:[.,]\d{1,2})?$/.test(amounts[part.interventionId] ?? '')
      && part.amount <= (targets.data.find(target => target.interventionId === part.interventionId)?.remaining ?? 0))
    && allocatedCents === Math.round((selected?.amount ?? 0) * 100);
  const money = (value: number, currency: string) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency }).format(value);
  if (rows.isPending) return <Skeleton className="h-10 w-full" />;
  if (!rows.isError && !rows.data?.length) return null;
  return <section className="border-t border-border pt-4 text-sm" aria-label={t('externalBatchRefund.title')}>
    <h3 className="font-semibold">{t('externalBatchRefund.title')}</h3>
    <p className="mt-2 max-w-[70ch] text-muted-foreground">{t('externalBatchRefund.help')}</p>
    {rows.isError ? <div role="alert" className="mt-3"><p>{t('externalBatchRefund.loadError')}</p>
      <Button variant="ghost" onClick={() => void rows.refetch()}>{t('common.retry')}</Button></div> :
      <ul className="mt-2 divide-y divide-border">{rows.data?.map(row => <li key={row.reference} className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 break-all text-muted-foreground">{row.stripeReference}</span>
          <strong className="tabular-nums">{new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: row.currency }).format(row.amount)}</strong>
        </div>
        {row.assigned ? <p className="mt-2" role="status">{t(row.confirmed ? 'externalBatchRefund.confirmed' : row.reviewRequired ? 'externalBatchRefund.review' : 'externalBatchRefund.pending')}</p> : row.assignable ?
          <Button variant="outline" size="sm" className="mt-2" disabled={busy || rows.isFetching} onClick={() => { setSelected(row); setReason(''); setError(''); setDistribute(false); setAmounts({}); }}>
            <Link2 size={16} />{t('externalBatchRefund.choose')}</Button> : <p className="mt-2 text-muted-foreground">{t('externalBatchRefund.awaitingStripe')}</p>}
      </li>)}</ul>}
    {selected && !rows.isError && <form className="mt-3 space-y-3 rounded-lg bg-muted p-3" onSubmit={event => {
      event.preventDefault(); if (lock.current || !reason.trim() || (distribute && !exactDistribution)) return;
      lock.current = true; setBusy(true); setError('');
      void (distribute ? api.distribute(interventionId, selected, reason.trim(), portions) : api.assign(interventionId, selected, reason.trim())).then(async () => { setSelected(null); await rows.refetch(); })
        .catch(e => setError(getErrorMessage(e))).finally(() => { lock.current = false; setBusy(false); });
    }}>
      <p className="font-medium">{t('externalBatchRefund.target', { label, id: interventionId })}</p>
      <p className="text-muted-foreground">{t('externalBatchRefund.confirmHelp')}</p>
      <Button type="button" variant="ghost" disabled={busy} aria-pressed={distribute} onClick={() => setDistribute(value => !value)}>
        {t(distribute ? 'externalBatchRefund.single' : 'externalBatchRefund.multiple')}
      </Button>
      {distribute && <fieldset disabled={busy} className="min-w-0 space-y-2">
        <legend className="mb-2 font-medium">{t('externalBatchRefund.allocationTitle')}</legend>
        {targets.isPending ? <Skeleton className="h-16 w-full" /> : targets.isError ?
          <div role="alert"><p>{t('externalBatchRefund.loadError')}</p><Button type="button" variant="ghost" onClick={() => void targets.refetch()}>{t('common.retry')}</Button></div> :
          targets.data?.map(target => <label key={target.interventionId} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border py-2">
            <span className="min-w-0 flex-1"><span className="block">{target.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{t('externalBatchRefund.available', { amount: money(target.remaining, target.currency) })}</span></span>
            <Input className="w-28 text-end tabular-nums" inputMode="decimal" aria-label={t('externalBatchRefund.portionAmount', { id: target.interventionId })}
              value={amounts[target.interventionId] ?? ''} disabled={busy || target.remaining <= 0} placeholder="0,00"
              onChange={event => setAmounts(previous => ({ ...previous, [target.interventionId]: event.target.value }))} />
          </label>)}
        <p role="status" className="text-sm tabular-nums">{t('externalBatchRefund.remaining', { amount: money(Number.isFinite(allocatedCents) ? selected.amount - allocatedCents / 100 : selected.amount, selected.currency) })}</p>
      </fieldset>}
      <label className="block">{t('externalBatchRefund.reason')}<Input className="mt-1" value={reason} required maxLength={500} disabled={busy}
        onChange={event => setReason(event.target.value)} /></label>
      {error && <Alert><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex flex-wrap gap-2"><Button className="baitly-hitl-primary" disabled={busy || !reason.trim() || (distribute && !exactDistribution)}>{t(busy ? 'externalBatchRefund.saving' : 'externalBatchRefund.confirm')}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => setSelected(null)}>{t('common.cancel')}</Button></div>
    </form>}
  </section>;
}
