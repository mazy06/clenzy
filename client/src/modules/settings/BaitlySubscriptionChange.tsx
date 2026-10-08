import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarClock, CreditCard } from '../../icons/glyphs';
import { Button, NativeSelect, Skeleton } from '../../components/ui';
import { baitlySubscriptionApi as api, type MonthlyContract, type MonthlyPlan } from '../../services/api/baitlySubscriptionApi';
import type { SubscriptionChangeProposal } from '../../../../shared/src/types/baitlySubscription';

export default function BaitlySubscriptionChange({ contract }: { contract: MonthlyContract }) {
  const { t, i18n } = useTranslation();const cache = useQueryClient();
  const [plan, setPlan] = useState<MonthlyPlan>(contract.plan);
  const [proposal, setProposal] = useState<SubscriptionChangeProposal | null>(null);
  const [error, setError] = useState<string | null>(null);const [busy, setBusy] = useState(false);
  const pending = useRef(false);const attempt = useRef<{ key: string; id: string } | null>(null);
  const changes = useQuery({ queryKey: ['monthly-subscription', contract.id, 'changes'], queryFn: () => api.changes(contract.id), retry: false });
  const open = changes.data?.find(c => c.status === 'PREPARED' || c.status === 'SCHEDULED');
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return;pending.current = true;setBusy(true);setError(null);
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : t('monthlySubscription.error')); }
    finally { pending.current = false;setBusy(false); }
  };
  const send = () => run(async () => {
    const terms = open?.terms ?? proposal?.terms;if (!terms) return;
    const key = JSON.stringify(terms);
    if (!attempt.current || attempt.current.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    await api.scheduleChange(contract.id, terms.plan, open?.requestId ?? attempt.current.id, terms);
    setProposal(null);await cache.invalidateQueries({ queryKey: ['monthly-subscription'] });
  });
  const money = (cents: number, currency: string) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(cents / 100);
  const terms = open?.terms ?? proposal?.terms;
  return <div className="space-y-3 border-b border-border pb-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-medium">{t('monthlySubscription.change.title')}</h3>
      <Button variant="outline" disabled={busy} onClick={() => run(async () => {
        const { url } = await api.paymentMethod(contract.id);const target = new URL(url);
        if (target.protocol !== 'https:' || target.hostname !== 'billing.stripe.com' || target.username || target.password) throw new Error(t('monthlySubscription.error'));
        window.location.assign(target.href);
      })}><CreditCard />{t('monthlySubscription.change.paymentMethod')}</Button>
    </div>
    {(error || changes.error) && <p role="alert" className="text-sm text-destructive-ink">{error ?? changes.error?.message}</p>}
    {changes.isPending && <Skeleton className="h-10 w-full" />}
    {!open && changes.isSuccess && contract.status === 'ACTIVE' && !contract.cancelAtPeriodEnd && <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-2 text-sm">{t('monthlySubscription.plan')}
        <NativeSelect value={plan} disabled={busy} onChange={e => { setPlan(e.target.value as MonthlyPlan);setProposal(null); }}>
          <option value="essential">Baitly Essentiel</option><option value="pro">Baitly Pro</option>
        </NativeSelect>
      </label>
      <Button variant="outline" disabled={busy} onClick={() => run(async () => { setProposal(null);setProposal(await api.changeProposal(contract.id, plan)); })}>{t('monthlySubscription.change.preview')}</Button>
    </div>}
    {terms && <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-primary-soft p-4">
      <div className="space-y-1 text-sm">
        <p className="font-medium">{terms.plan === 'pro' ? 'Baitly Pro' : 'Baitly Essentiel'} · {t('monthlySubscription.properties', { count: terms.properties })}</p>
        <p className="tabular-nums">{t('monthlySubscription.change.effective', { date: new Intl.DateTimeFormat(i18n.language).format(new Date(terms.effectiveAt * 1000)), amount: money(terms.subscriptionMonth <= 3 ? terms.monthOne : terms.subscriptionMonth <= 6 ? terms.monthFour : terms.subscriptionMonth <= 12 ? terms.monthSeven : terms.monthThirteen, terms.currency) })}</p>
        <p className="text-muted-foreground">{t('monthlySubscription.change.noProration')}</p>
        {open?.status === 'SCHEDULED' && <p role="status">{t('monthlySubscription.change.scheduled')}</p>}
      </div>
      {open?.status !== 'SCHEDULED' && <Button disabled={busy} onClick={send}><CalendarClock />{t(open ? 'monthlySubscription.resume' : 'monthlySubscription.change.confirm')}</Button>}
    </div>}
  </div>;
}
