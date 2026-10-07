import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, NativeSelect, Skeleton } from '../../components/ui';
import apiClient from '../../services/apiClient';
import type { MonthlyQuote } from '../../services/api/baitlySubscriptionApi';
import { BAITLY_BILLING_COUNTRIES } from '../../services/api/baitlySubscriptionApi';

export interface SignupProposal { phases: MonthlyQuote[]; firstInvoiceExcludingTaxCents: number; promoCode: string | null; key: string }
export const signupQuoteKey = (plan: string, country: string, count: number, promo: string) => `${plan}:${country}:${count}:${promo.trim()}`;
interface Props {
  plan: string; country: string; count: number; promo: string; disabled: boolean;
  onPlan: (value: string) => void; onCountry: (value: string) => void; onCount: (value: number) => void;
  onQuote: (value: SignupProposal | null) => void;
}

/** Le navigateur affiche les échéances calculées par le serveur, sans recalculer les remises. */
export default function BaitlySignupPricing({ plan, country, count, promo, disabled, onPlan, onCountry, onCount, onQuote }: Props) {
  const { t, i18n } = useTranslation();
  const [proposal, setProposal] = useState<SignupProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = signupQuoteKey(plan, country, count, promo);
  useEffect(() => {
    let cancelled = false;
    onQuote(null); setProposal(null); setError(null);
    const timeout = window.setTimeout(() => {
      const query = new URLSearchParams({ plan, country, properties: String(count) });
      if (promo.trim()) query.set('promoCode', promo.trim());
      apiClient.get<Omit<SignupProposal, 'key'>>(`/public/inscription/quote?${query}`, { skipAuth: true })
        .then(data => { if (!cancelled) { const value = { ...data, key }; setProposal(value); onQuote(value); } })
        .catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : t('monthlySubscription.error')); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [plan, country, count, promo, key, onQuote, t]);
  const regions = new Intl.DisplayNames([i18n.language], { type: 'region' });
  const money = (cents: number, currency: string) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(cents / 100);
  return <section aria-label={t('monthlySubscription.title')} className="space-y-4 border-y border-border py-4">
    <h2 className="text-base font-semibold text-balance">{t('monthlySubscription.title')}</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm">{t('monthlySubscription.plan')}<NativeSelect value={plan} disabled={disabled} onChange={e => onPlan(e.target.value)}>
        <option value="essential">Baitly Essentiel</option><option value="pro">Baitly Pro</option>
      </NativeSelect></label>
      <label className="space-y-1 text-sm">{t('signupMonthly.country')}<NativeSelect value={country} disabled={disabled} onChange={e => onCountry(e.target.value)}>
        {BAITLY_BILLING_COUNTRIES.map(code => <option key={code} value={code}>{regions.of(code)}</option>)}
      </NativeSelect></label>
      <label className="space-y-1 text-sm">{t('signupMonthly.properties')}<Input type="number" min={1} max={49} step={1} value={count || ''} disabled={disabled} onChange={e => onCount(Number(e.target.value))} /></label>
    </div>
    <p className="text-xs text-muted-foreground">{t('signupMonthly.largePortfolio')}</p>
    {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
    {!proposal && !error && <Skeleton className="h-32 w-full" />}
    {proposal && <>
      <table className="w-full text-sm tabular-nums"><thead><tr className="border-b border-border text-muted-foreground">
        <th className="py-2 text-start font-medium">{t('monthlySubscription.period')}</th><th className="py-2 text-end font-medium">{t('monthlySubscription.monthlyNet')}</th>
      </tr></thead><tbody>{proposal.phases.map((phase, index) => <tr key={phase.subscriptionMonth} className="border-b border-border">
        <td className="py-2">{t(`monthlySubscription.phases.${index}`)}</td><td className="py-2 text-end font-medium">{money(phase.totalCents, phase.currency)}</td>
      </tr>)}</tbody></table>
      <p className="text-sm font-medium tabular-nums">{t('monthlySubscription.firstInvoice', { amount: money(proposal.firstInvoiceExcludingTaxCents, proposal.phases[0].currency) })}</p>
      <p className="text-xs text-muted-foreground">{t('monthlySubscription.tax')}</p>
    </>}
  </section>;
}
