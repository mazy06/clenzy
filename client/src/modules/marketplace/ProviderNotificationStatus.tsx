import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import { Button, Skeleton } from '../../components/ui';

interface Delivery { id: string; kind: string; status: string; attempts: number; createdAt: string; nextAttemptAt: string; sentAt?: string; expectedStatus?: string; actor?: string }
export default function ProviderNotificationStatus({ providerId }: { providerId: number }) {
  const { user } = useAuth();
  const { t, currentLanguage } = useTranslation();
  const query = useQuery({
    queryKey: ['marketplace-notifications', providerId, user?.id, user?.organizationId],
    queryFn: () => apiClient.get<Delivery[]>(`/admin/marketplace/providers/${providerId}/notifications`),
    enabled: !!user, refetchInterval: 30_000,
  });
  return <section className="flex flex-col gap-2 border-t border-border pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="m-0 text-sm font-medium">{t('marketplaceWorkflow.deliveries')}</h3>
      <Button size="sm" variant="ghost" disabled={query.isFetching} onClick={() => { void query.refetch(); }}>{t('marketplaceWorkflow.refresh')}</Button>
    </div>
    <p className="m-0 text-xs text-muted-foreground">{t('marketplaceWorkflow.deliveriesHelp')}</p>
    {query.isPending ? <Skeleton className="h-16 w-full" /> : query.isError
      ? <p role="alert" className="text-sm text-destructive-ink">{t('marketplaceWorkflow.loadFailed')}</p>
      : !query.data?.length ? <p className="text-xs text-muted-foreground">{t('marketplaceWorkflow.noDeliveries')}</p>
      : <ul className="m-0 flex max-h-80 list-none flex-col overflow-auto p-0">
        {query.data.map((delivery) => <li key={delivery.id} className="border-b border-border py-2 text-xs last:border-0">
          <div className="flex flex-wrap justify-between gap-2">
            <span>{t('marketplaceWorkflow.deliveryKinds.' + delivery.kind)}</span>
            <span>{t('marketplaceWorkflow.deliveryStatuses.' + delivery.status)}</span>
          </div>
          <p className="m-0 mt-1 tabular-nums text-muted-foreground">
            {new Date(delivery.createdAt).toLocaleString(currentLanguage)} · {t('marketplaceWorkflow.attempts', { count: delivery.attempts })}
          </p>
          {(delivery.status === 'PENDING' || delivery.status === 'RUNNING') && <p className="m-0 tabular-nums">
            {t('marketplaceWorkflow.nextAttempt')} {new Date(delivery.nextAttemptAt).toLocaleString(currentLanguage)}
          </p>}
        </li>)}
      </ul>}
  </section>;
}
