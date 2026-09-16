import { useTranslation } from 'react-i18next';
import { Button, Card, Skeleton } from '../../components/ui';
import { useProviderProvisioning, useRetryProviderProvisioning } from '../../hooks/useMarketplaceProviders';
import type { ProviderDetailDto } from '../../services/api/marketplaceProvidersApi';
import ProviderInvitationStatus from './ProviderInvitationStatus';

export default function ProviderProvisioningPanel({ provider }: {
  provider: Pick<ProviderDetailDto, 'id' | 'status' | 'emailConfirmedAt'>;
}) {
  const { t, i18n } = useTranslation();
  const query = useProviderProvisioning(provider.id);
  const retry = useRetryProviderProvisioning();
  const state = query.data;
  const eligible = provider.status === 'ACTIVE' && !!provider.emailConfirmedAt;
  const canRetry = state?.requiresReview && eligible && !query.isError;

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold text-foreground [text-wrap:balance]">
          {t('marketplaceProvisioning.title')}
        </h3>
        <Button variant="ghost" size="sm" disabled={query.isFetching || retry.isPending}
          onClick={() => { void query.refetch(); }}>
          {t('marketplaceProvisioning.refresh')}
        </Button>
      </div>
      {query.isPending ? <Skeleton className="h-16 w-full" /> : query.isError ? (
        <p role="alert" className="m-0 text-sm text-foreground">{t('marketplaceProvisioning.loadError')}</p>
      ) : !state ? (
        <p className="m-0 text-sm text-muted-foreground">{t('marketplaceProvisioning.empty')}</p>
      ) : (
        <>
          <div aria-live="polite">
            <p className="m-0 text-sm font-medium text-foreground">
              {t(`marketplaceProvisioning.status.${state.status}`)}
            </p>
            <p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground">
              {t(state.requiresReview ? 'marketplaceProvisioning.review' : `marketplaceProvisioning.hint.${state.status}`)}
            </p>
          </div>
          <dl className="m-0 flex flex-col gap-1 text-xs">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">{t('marketplaceProvisioning.attempts')}</dt>
              <dd className="m-0 tabular-nums">{state.attempts}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-muted-foreground">{t('marketplaceProvisioning.updated')}</dt>
              <dd className="m-0 tabular-nums"><time dateTime={state.updatedAt}>
                {new Date(state.updatedAt).toLocaleString(i18n.language)}
              </time></dd>
            </div>
          </dl>
          {state.requiresReview && !eligible && (
            <p className="m-0 text-xs text-muted-foreground">{t('marketplaceProvisioning.ineligible')}</p>
          )}
          {canRetry && (
            <Button variant="outline" size="sm" disabled={retry.isPending}
              onClick={() => retry.mutate(provider.id)}>
              {t(retry.isPending ? 'marketplaceProvisioning.retrying' : 'marketplaceProvisioning.retry')}
            </Button>
          )}
        </>
      )}
      {retry.isError && <p role="alert" className="m-0 text-xs text-foreground">
        {t((retry.error as { status?: number })?.status === 409
          ? 'marketplaceProvisioning.conflict' : 'marketplaceProvisioning.retryError')}
      </p>}
      {retry.isSuccess && <p role="status" className="m-0 text-xs text-muted-foreground">
        {t('marketplaceProvisioning.queued')}
      </p>}
      {state?.requiresReview && eligible && <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('marketplaceReconciliation.ownerLink')}
        <input readOnly aria-label={t('marketplaceReconciliation.ownerLink')}
          className="w-full rounded-md border border-border bg-background p-2 text-foreground focus-visible:ring-2 focus-visible:ring-primary"
          value={`${window.location.origin}/marketplace/account-reconciliation/${provider.id}`} />
      </label>}
      <ProviderInvitationStatus providerId={provider.id} />
    </Card>
  );
}
