import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, NativeSelect, Skeleton } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { baitlySubscriptionApi as api, BAITLY_BILLING_COUNTRIES } from '../../services/api/baitlySubscriptionApi';

/** Paramètre métier persisté sur l'organisation, jamais dérivé de la devise d'affichage ou d'un logement. */
export default function BaitlyBillingCountry({ locked, onReady }: { locked: boolean; onReady: (ready: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const cache = useQueryClient();
  const [selection, setSelection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = useQuery({ queryKey: ['monthly-subscription', user?.id, user?.organizationId, 'billing-country'], queryFn: api.billingCountry });
  const names = new Intl.DisplayNames([i18n.language], { type: 'region' });
  const value = selection ?? profile.data?.billingCountry ?? '';
  useEffect(() => { onReady(!profile.isPending && !profile.isError && !busy && Boolean(value) && value === profile.data?.billingCountry); }, [profile.isPending, profile.isError, busy, value, profile.data?.billingCountry, onReady]);
  const save = async () => {
    if (busy || !value) return;
    setBusy(true); setError(null);
    try { await api.updateBillingCountry(value); await cache.invalidateQueries({ queryKey: ['monthly-subscription'] }); setSelection(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : t('monthlySubscription.error')); }
    finally { setBusy(false); }
  };
  if (profile.isPending) return <Skeleton className="h-16 w-full" />;
  return <div className="space-y-2 border-b border-border pb-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-2 text-sm font-medium">{t('signupMonthly.country')}
        <NativeSelect value={value} disabled={locked || busy || profile.isError} onChange={e => setSelection(e.target.value)}>
          <option value="">{t('monthlySubscription.chooseCountry')}</option>
          {BAITLY_BILLING_COUNTRIES.map(country => <option key={country} value={country}>{names.of(country)}</option>)}
        </NativeSelect>
      </label>
      {!locked && <Button type="button" variant="outline" disabled={busy || !value || value === profile.data?.billingCountry || profile.isError} onClick={save}>{t('common.save')}</Button>}
    </div>
    <p className="max-w-3xl text-xs text-muted-foreground">{t('monthlySubscription.countryScope')}
      {profile.data?.sellerCountry && ` ${t('monthlySubscription.sellerCountry', { country: names.of(profile.data.sellerCountry) })}`}
    </p>
    {locked && <p className="text-xs text-muted-foreground">{t('monthlySubscription.countryLocked')}</p>}
    {(error || profile.isError) && <p role="alert" className="text-sm text-destructive-ink">{error ?? profile.error?.message}</p>}
  </div>;
}
