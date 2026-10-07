import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { Button, Skeleton } from '../../components/ui';
import PageTabs from '../../components/PageTabs';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { useCommerceScope } from '../../hooks/useCommerceScope';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import SettingsSection from './components/SettingsSection';

type CheckState = 'CONFIGURED' | 'MISSING' | 'NOT_CHECKED' | 'UNAVAILABLE' | 'NOT_CONNECTED' | 'EXEMPTION_DECLARED';
export type CommerceReadinessReport = {
  checkedAt: string;
  remoteVerification: boolean;
  countries: { country: string; checks: { key: string; state: CheckState }[] }[];
  providers: { provider: string; settingsPresent: boolean; implemented: boolean }[];
};
const key = (scope: string | null) => ['commerce-readiness', scope] as const;

export function useCommerceReadiness(enabled = true) {
  const scope = useCommerceScope();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: key(scope), enabled: enabled && !!scope, retry: false, refetchOnWindowFocus: false,
    queryFn: () => apiClient.get<CommerceReadinessReport>('/payment-configs/diagnostic'),
  });
  const verification = useMutation({
    mutationFn: (_scope: string) => apiClient.get<CommerceReadinessReport>('/payment-configs/diagnostic?verify=true'),
    onSuccess: (report, checkedScope) => client.setQueryData(key(checkedScope), report),
  });
  const currentVerification = verification.variables === scope;
  const error = query.isError || (currentVerification && verification.isError);
  return {
    // Une vérification en erreur ne laisse pas affiché un précédent résultat favorable.
    report: error ? undefined : query.data,
    error,
    pending: query.isFetching || (currentVerification && verification.isPending),
    verify: () => { if (scope) verification.mutate(scope); },
    refresh: () => { verification.reset(); return query.refetch(); },
  };
}

const tones: Record<CheckState, StatusTone> = {
  CONFIGURED: 'ok', MISSING: 'warn', NOT_CHECKED: 'neutral', UNAVAILABLE: 'warn',
  NOT_CONNECTED: 'neutral', EXEMPTION_DECLARED: 'neutral',
};

export default function BaitlyCommerceReadiness({ diagnostic }: { diagnostic: ReturnType<typeof useCommerceReadiness> }) {
  const { t } = useTranslation();
  const [country, setCountry] = useState('FR');
  const report = diagnostic.report;
  return <SettingsSection icon={ClipboardCheck} title={t('commerceReadiness.title')} description={t('commerceReadiness.scope')}>
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('commerceReadiness.hint')}</p>
      <PageTabs trail={false} size="compact" value={country} onChange={setCountry}
        ariaLabel={t('commerceReadiness.country')}
        options={['FR', 'MA', 'SA'].map(value => ({ value, label: t(`commerceReadiness.countries.${value}`) }))} />
      {diagnostic.pending && !report && <Skeleton className="h-40 w-full" />}
      {diagnostic.error && <p role="alert" className="text-sm text-destructive-ink">{t('commerceReadiness.error')}</p>}
      {report && <>
        <dl className="divide-y divide-border" aria-label={t('commerceReadiness.checks')}>
          {report.countries.find(row => row.country === country)?.checks.map(check => <div key={check.key}
            className="flex flex-wrap items-start justify-between gap-2 py-2.5">
            <dt className="min-w-0 flex-1 basis-48 text-sm">
              {t(`commerceReadiness.items.${check.key}.title`)}
              <p className="mt-0.5 text-xs text-muted-foreground">{t(`commerceReadiness.items.${check.key}.hint`)}</p>
            </dt>
            <dd><StatusChip tone={tones[check.state]} label={t(`commerceReadiness.states.${check.state}`)} /></dd>
          </div>)}
        </dl>
        <p className="text-xs text-muted-foreground tabular-nums">
          {t(report.remoteVerification ? 'commerceReadiness.remoteDate' : 'commerceReadiness.localDate', {
            date: new Date(report.checkedAt).toLocaleString(),
          })}
        </p>
      </>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={diagnostic.pending} onClick={diagnostic.verify}>
          {t('commerceReadiness.verify')}
        </Button>
        <Button variant="ghost" size="sm" disabled={diagnostic.pending} onClick={() => void diagnostic.refresh()}>
          {t('common.refresh')}
        </Button>
      </div>
    </div>
  </SettingsSection>;
}
