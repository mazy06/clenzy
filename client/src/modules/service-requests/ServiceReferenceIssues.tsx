import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import apiClient from '../../services/apiClient';
import { Button } from '../../components/ui';

interface Issue { sourceType: string; sourceId: number; legacyType: string; reason: string }
export default function ServiceReferenceIssues() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ['service-reference-issues', user?.organizationId],
    queryFn: () => apiClient.get<Issue[]>('/service-reference/issues'),
  });
  if (query.isPending) return null;
  if (query.isError) return <p role="alert" className="text-sm">
    {t('serviceReference.loadError')} <Button variant="ghost" onClick={() => void query.refetch()}>{t('serviceReference.retry')}</Button>
  </p>;
  if (!query.data.length) return null;
  return <details className="mb-3 shrink-0 rounded-md border border-border p-3 text-sm">
    <summary className="cursor-pointer font-medium focus-visible:outline-2">{t('serviceReference.issuesTitle', { count: query.data.length })}</summary>
    <p className="my-2 text-muted-foreground">{t('serviceReference.issuesHelp')}</p>
    <ul className="max-h-48 overflow-y-auto divide-y divide-border">
      {query.data.map(row => <li key={row.sourceType + row.sourceId + row.reason} className="flex flex-wrap justify-between gap-2 py-2">
        <span>{row.sourceType === 'SERVICE_REQUEST' ? t('serviceRequests.title') : t('interventions.title')} #{row.sourceId} · {row.legacyType}</span>
        <Link className="cursor-pointer underline underline-offset-2 focus-visible:outline-2"
          to={row.sourceType === 'SERVICE_REQUEST' ? '/service-requests/' + row.sourceId + '/edit' : '/interventions/' + row.sourceId}>
          {t('serviceReference.inspect')}
        </Link>
      </li>)}
    </ul>
  </details>;
}
