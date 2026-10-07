import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Skeleton } from '../../../components/ui';
import PagePagination from '../../../components/PagePagination';
import { useTranslation } from '../../../hooks/useTranslation';
import { payoutTransfersApi } from '../../../services/api/payoutTransfersApi';

/** Les alertes sont recalculées côté serveur, jamais masquées par une préférence locale. */
export default function PayoutMonitoringPanel({ scope, onSelect }: {
  scope: string; onSelect: (id: number, button: HTMLButtonElement) => void;
}) {
  const { t, currentLanguage } = useTranslation();
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ['payout-transfers', scope, 'monitoring', page],
    queryFn: () => payoutTransfersApi.monitoring(page), refetchInterval: 60_000 });
  const data = query.data;
  useEffect(() => {
    if (data && page > 0 && page >= data.alerts.totalPages) setPage(Math.max(0, data.alerts.totalPages - 1));
  }, [data, page]);
  if (query.isPending) return <Skeleton className="h-14 w-full mb-4" aria-label={t('payoutTracking.monitoring.loading')} />;
  if (query.isError || !data) return <div className="payout-tracking__monitoring-error" role="alert">
    <p>{t('payoutTracking.monitoring.error')}</p><Button variant="outline" size="sm" onClick={() => { void query.refetch(); }}>{t('common.retry', 'Réessayer')}</Button>
  </div>;
  const mode = !data.recoveryEnabled ? 'disabled' : !data.providerConfigured ? 'unconfigured' : 'enabled';
  const count = new Intl.NumberFormat(currentLanguage).format(data.alerts.totalElements);
  return <section className="payout-tracking__monitoring" aria-label={t('payoutTracking.monitoring.title')}>
    <div className="payout-tracking__monitoring-status"><span>{t(`payoutTracking.monitoring.${mode}`)}</span><span>{t('payoutTracking.monitoring.readOnly')}</span></div>
    {data.alerts.totalElements === 0 ? <p className="payout-tracking__monitoring-empty">{t('payoutTracking.monitoring.empty')}</p>
      : <details>
        <summary><span>{t('payoutTracking.monitoring.title')} <b>{count}</b></span><ChevronDown size={16} aria-hidden="true" /></summary>
        <p className="payout-tracking__monitoring-hint">{t('payoutTracking.monitoring.hint')}</p>
        <ul>{data.alerts.content.map((alert) => <li key={alert.transferId}>
          <button className="payout-tracking__alert" onClick={(event) => onSelect(alert.transferId, event.currentTarget)}>
            <span><strong>{t(`payoutTracking.monitoring.codes.${alert.code}`)}</strong><span>{alert.description}</span>
              <small>{t(`payoutTracking.monitoring.advice.${alert.code}`)}</small></span>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </li>)}</ul>
        {data.alerts.totalPages > 1 && <PagePagination page={page} onPageChange={setPage} count={data.alerts.totalElements} rowsPerPage={6} />}
      </details>}
  </section>;
}
