import BaitlySaleDocuments from '../payments/BaitlySaleDocuments';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight, FileText, RefreshCw } from '../../icons/glyphs';
import { Button, Input, NativeSelect, Skeleton } from '../../components/ui';
import { baitlySubscriptionApi as api, type MonthlyPlan } from '../../services/api/baitlySubscriptionApi';
import { useAuth } from '../../hooks/useAuth';
import BaitlyBillingCountry from './BaitlyBillingCountry';
import BaitlySubscriptionChange from './BaitlySubscriptionChange';

/** Surface de gestion : proposition lisible avant Checkout, contrat et factures séparés. */
export default function BaitlyMonthlySubscription() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const scope = [user?.id, user?.organizationId];
  const [plan, setPlan] = useState<MonthlyPlan>('essential');
  const [promo, setPromo] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [busy, setBusy] = useState(false);
  const [countryReady, setCountryReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const attempt = useRef<{ key: string; id: string } | null>(null);
  const contracts = useQuery({ queryKey: ['monthly-subscription', ...scope, 'contracts'], queryFn: api.contracts });
  const invoices = useQuery({ queryKey: ['monthly-subscription', ...scope, 'invoices'], queryFn: api.invoices });
  const proposal = useQuery({ queryKey: ['monthly-subscription', ...scope, 'proposal', plan, appliedPromo], queryFn: () => api.proposal(plan, appliedPromo), retry: false });
  const open = contracts.data?.find(c => ['PREPARED', 'CHECKOUT_OPEN', 'ACTIVATING'].includes(c.status));
  const current = contracts.data?.find(c => ['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'REVIEW_REQUIRED'].includes(c.status));
  const money = (cents: number, currency: string) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(cents / 100);
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await action(); await queryClient.invalidateQueries({ queryKey: ['monthly-subscription'] }); }
    catch (e) { setError(e instanceof Error ? e.message : t('monthlySubscription.error')); }
    finally { pending.current = false; setBusy(false); }
  };
  const checkout = () => run(async () => {
    const key = `${scope.join(':')}:${plan}:${appliedPromo}`;
    if (!attempt.current || attempt.current.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    const result = await api.checkout(open?.plan ?? plan, open?.requestId ?? attempt.current.id, open ? open.promoCode : appliedPromo);
    const url = new URL(result.checkoutUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error(t('monthlySubscription.error'));
    window.location.assign(url.href);
  });
  const data = proposal.data;
  return <section className="space-y-6 rounded-xl border border-border bg-card p-4 text-foreground sm:p-6" aria-label={t('monthlySubscription.title')}>
    <div>
      <h2 className="text-lg font-semibold tracking-tight text-balance">{t('monthlySubscription.title')}</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t('monthlySubscription.intro')}</p>
    </div>
    {(error || contracts.error || invoices.error) && <p role="alert" className="text-sm text-destructive-ink">{error || (contracts.error as Error)?.message || (invoices.error as Error)?.message}</p>}
    <BaitlyBillingCountry locked={contracts.isPending || contracts.isError || Boolean(open || current)} onReady={setCountryReady} />
    {contracts.isPending && <Skeleton className="h-12 w-full" />}
    {open && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary-soft p-3">
      <p className="text-sm">{t('monthlySubscription.pending', { plan: open.plan === 'pro' ? 'Pro' : 'Essentiel' })}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => run(() => api.refresh(open.id))}><RefreshCw />{t('monthlySubscription.verify')}</Button>
        {open.status !== 'ACTIVATING' && <>
          <Button disabled={busy} onClick={checkout}>{t('monthlySubscription.resume')}<ArrowRight /></Button>
          <Button variant="ghost" disabled={busy} onClick={() => run(() => api.abandon(open.id))}>{t('monthlySubscription.abandon')}</Button>
        </>}
      </div>
    </div>}
    {current && <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
      <div>
        <p className="font-medium">{current.plan === 'pro' ? 'Baitly Pro' : 'Baitly Essentiel'} · {t(`monthlySubscription.status.${current.status}`)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('monthlySubscription.properties', { count: current.properties })}
          {current.paidUntil && ` · ${t('monthlySubscription.paidUntil', { date: new Intl.DateTimeFormat(i18n.language).format(new Date(current.paidUntil)) })}`}</p>
        {current.cancelAtPeriodEnd && <p className="mt-1 text-sm text-muted-foreground">{t('monthlySubscription.cancellationScheduled')}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => run(() => api.refresh(current.id))}><RefreshCw />{t('monthlySubscription.verify')}</Button>
        {!current.cancelAtPeriodEnd && ['ACTIVE', 'PAST_DUE'].includes(current.status) && <Button variant="ghost" disabled={busy} onClick={() => run(() => api.cancel(current.id))}>{t('monthlySubscription.cancel')}</Button>}
      </div>
    </div>}
    {current && <BaitlySubscriptionChange key={current.id} contract={current} />}
    {!open && !current && <form onSubmit={e => { e.preventDefault(); if (countryReady && data && !proposal.isFetching && !proposal.isError) void checkout(); }} className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-48 flex-col gap-2 text-sm font-medium">{t('monthlySubscription.plan')}
          <NativeSelect value={plan} disabled={busy} onChange={e => setPlan(e.target.value as MonthlyPlan)}><option value="essential">Baitly Essentiel</option><option value="pro">Baitly Pro</option></NativeSelect>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-2 text-sm font-medium">{t('monthlySubscription.promo')}<Input maxLength={50} value={promo} disabled={busy} onChange={e => setPromo(e.target.value.toUpperCase())} /></label>
          <Button type="button" variant="outline" disabled={busy || proposal.isFetching} onClick={() => setAppliedPromo(promo.trim())}>{t('monthlySubscription.apply')}</Button>
        </div>
      </div>
      {proposal.isFetching && <Skeleton className="h-24 w-full" />}
      {proposal.isError && <p role="alert" className="text-sm text-destructive-ink">{proposal.error.message}</p>}
      {data && !proposal.isError && !proposal.isFetching && <>
        <p className="text-sm text-muted-foreground">{t('monthlySubscription.properties', { count: data.phases[0].properties })} · {t('monthlySubscription.tax')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm tabular-nums">
            <thead><tr className="border-b border-border text-muted-foreground"><th className="py-2 text-start font-medium">{t('monthlySubscription.period')}</th><th className="py-2 text-end font-medium">{t('monthlySubscription.loyalty')}</th><th className="py-2 text-end font-medium">{t('monthlySubscription.monthlyNet')}</th></tr></thead>
            <tbody>{data.phases.map((phase, index) => <tr key={phase.subscriptionMonth} className="border-b border-border"><td className="py-3">{t(`monthlySubscription.phases.${index}`)}</td><td className="py-3 text-end">{phase.loyaltyPercent} %</td><td className="py-3 text-end font-medium">{money(phase.totalCents, phase.currency)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm"><p className="font-medium tabular-nums">{t('monthlySubscription.firstInvoice', { amount: money(data.firstInvoiceExcludingTaxCents, data.phases[0].currency) })}</p><p className="mt-1 max-w-2xl text-muted-foreground">{t('monthlySubscription.preserve')}</p></div>
          <Button type="submit" disabled={busy || !countryReady || contracts.isPending || contracts.isError || promo.trim() !== appliedPromo}>{t('monthlySubscription.checkout')}<ArrowRight /></Button>
        </div>
      </>}
    </form>}
    {invoices.data && invoices.data.length > 0 && <div>
      <h3 className="mb-2 font-medium">{t('monthlySubscription.invoices')}</h3>
      <ul className="divide-y divide-border">{invoices.data.map(bill => <li key={bill.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <div><p>{new Intl.DateTimeFormat(i18n.language).format(new Date(bill.issuedAt))} · {t(`monthlySubscription.invoiceStatus.${bill.status}`, bill.status)}</p><p className="text-muted-foreground tabular-nums">{money(bill.totalCents, bill.currency)} {t('monthlySubscription.includingTax')}</p></div>
        <div className="flex gap-3">{bill.pdfUrl && <a className="inline-flex items-center gap-1 text-primary-ink underline underline-offset-4 focus-visible:outline focus-visible:outline-2" href={bill.pdfUrl} target="_blank" rel="noreferrer"><FileText size={16} />{t('monthlySubscription.invoice')}</a>}
          {bill.remainingCents > 0 && bill.hostedUrl && <a className="text-primary-ink underline underline-offset-4 focus-visible:outline focus-visible:outline-2" href={bill.hostedUrl} target="_blank" rel="noreferrer">{t('monthlySubscription.settle')}</a>}</div>
      </li>)}</ul>
    </div>}
    <BaitlySaleDocuments source="SUBSCRIPTION" />
  </section>;
}
