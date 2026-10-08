import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Skeleton } from '../../components/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { baitlyCommerceApi as api } from '../../services/api/baitlyCommerceApi';

export default function BaitlyCommercePayoutPanel({ source, sourceId }: { source: 'UPSELL' | 'AFFILIATE'; sourceId: number }) {
  const scope = useCommerceScope();
  const { t, currentLanguage } = useTranslation();
  const [proposal, setProposal] = useState<{ party: string; amount: number; requestId: string } | null>(null);
  const [busy, setBusy] = useState(false);const [error, setError] = useState('');const pending = useRef(false);
  const query = useQuery({ enabled: !!scope, queryKey: ['commerce-payouts', scope, source, sourceId], queryFn: () => api.payoutView(source, sourceId), retry: false,
    refetchInterval: state => state.state.data?.recoveries.some(row => row.state !== 'RECOVERED') ? 5000 : false });
  const data = query.data;
  const money = (amount: number) => new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: data?.currency || 'EUR' }).format(amount);
  async function cancelPreparation(id: number) {
    if (pending.current) return;pending.current = true;setBusy(true);setError('');
    try { await api.cancelPayout(id);setProposal(null); }
    catch (e) { setError(e instanceof Error ? e.message : t('commercePayouts.failed')); }
    finally { await query.refetch();pending.current = false;setBusy(false); }
  }
  async function pay() {
    if (!proposal || !data || pending.current) return;pending.current = true;setBusy(true);setError('');
    try { await api.payout({ source, sourceId, party: proposal.party, requestId: proposal.requestId, amount: proposal.amount, currency: data.currency });setProposal(null); }
    catch (e) { setError(e instanceof Error ? e.message : t('commercePayouts.failed')); }
    finally { await query.refetch();pending.current = false;setBusy(false); }
  }
  return <section className="space-y-3 border-t border-border pt-3">
    <h4 className="text-sm font-medium">{t('commercePayouts.title')}</h4>
    <p className="text-xs text-muted-foreground">{t('commercePayouts.hint')}</p>
    {query.isPending && <Skeleton className="h-16 w-full" />}
    {(error || query.error) && <p role="alert" className="text-sm text-destructive-ink">{error || query.error?.message}</p>}
    {data && <>
      {(['OWNER', 'CONCIERGE'] as const).map(party => {
        const amount = party === 'OWNER' ? data.ownerAvailable : data.conciergeAvailable;
        return amount > 0 && <div key={party} className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>{t(`commercePayouts.${party}`)} · <span className="tabular-nums">{money(amount)}</span></span>
          <Button variant="outline" size="sm" disabled={busy || !!proposal || data.recoveries.some(row => row.state !== 'RECOVERED')} onClick={() => setProposal({ party, amount, requestId: crypto.randomUUID() })}>{t('commercePayouts.prepare')}</Button>
        </div>;
      })}
      {data.transfers.map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>{t(`commercePayouts.${row.party}`)} · <span className="tabular-nums">{money(row.amount)}</span> · {t(`commercePayouts.states.${row.state}`, row.state)}</span>
        {row.journalId && <a href={`/billing?tab=payouts&view=tracking&transfer=${row.journalId}`} className="text-primary underline underline-offset-4">{t('commercePayouts.tracking')}</a>}
        {row.state === 'PREPARED' && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void cancelPreparation(row.id)}>{t('commercePayouts.cancelPreparation')}</Button>}
        {row.state === 'PREPARED' && <Button variant="ghost" size="sm" disabled={busy} onClick={() => setProposal({ party: row.party, amount: row.amount, requestId: row.requestId })}>{t('common.retry')}</Button>}
      </div>)}
      {data.recoveries.map(row => <p key={row.id} className="text-xs">{t('commercePayouts.recovery')} · <span className="tabular-nums">{money(row.amount)}</span> · {t(`commercePayouts.states.${row.state}`, row.state)}</p>)}
    </>}
    {proposal && <div className="space-y-2 rounded-lg bg-muted p-3">
      <p className="text-sm">{t('commercePayouts.confirmation', { amount: money(proposal.amount), party: t(`commercePayouts.${proposal.party}`) })}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void pay()}>{t('commercePayouts.confirm')}</Button><Button variant="ghost" disabled={busy} onClick={() => setProposal(null)}>{t('common.cancel')}</Button></div>
    </div>}
  </section>;
}
