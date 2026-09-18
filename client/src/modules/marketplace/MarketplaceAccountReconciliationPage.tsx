import { useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/PageHeader';
import { Button } from '../../components/ui';
import apiClient from '../../services/apiClient';

type Outcome = 'ACCOUNT_CREATED' | 'EXISTING_ACCOUNT_LINKED' | 'ALREADY_LINKED' | 'DEFERRED' | 'FAILED';

export default function MarketplaceAccountReconciliationPage() {
  const { providerId } = useParams();
  return <Reconciliation key={providerId} providerId={providerId} />;
}

function Reconciliation({ providerId }: { providerId?: string }) {
  const { t } = useTranslation();
  const validId = !!providerId && /^[1-9]\d*$/.test(providerId) && Number.isSafeInteger(Number(providerId));
  const reconcile = useMutation({
    mutationFn: () => apiClient.post<{ outcome: Outcome }>('/me/marketplace-reconciliation/' + providerId),
  });
  const outcome = reconcile.data?.outcome;
  const complete = outcome === 'ACCOUNT_CREATED' || outcome === 'EXISTING_ACCOUNT_LINKED' || outcome === 'ALREADY_LINKED';
  return <>
    <PageHeader title={t('marketplaceReconciliation.title')} />
    <section className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('marketplaceReconciliation.help')}</p>
      {!validId && <p role="alert">{t('marketplaceReconciliation.invalidLink')}</p>}
      {reconcile.isError && <p role="alert" className="text-sm text-destructive-ink">
        {t((reconcile.error as { status?: number }).status === 403
          ? 'marketplaceReconciliation.denied' : 'marketplaceReconciliation.error')}
      </p>}
      {outcome && <p role="status" className="text-sm">{t('marketplaceReconciliation.' + (complete ? 'success' : 'deferred'))}</p>}
      <div className="flex flex-wrap gap-2">
        {complete ? <Button onClick={() => window.location.assign('/account')}>{t('marketplaceReconciliation.account')}</Button>
          : <Button disabled={!validId || reconcile.isPending} onClick={() => reconcile.mutate()}>
            {t(reconcile.isPending ? 'marketplaceReconciliation.pending' : 'marketplaceReconciliation.confirm')}
          </Button>}
      </div>
    </section>
  </>;
}
