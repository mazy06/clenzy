import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { serviceAssignmentsApi } from '../../services/api/serviceAssignmentsApi';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { Button, Skeleton } from '../../components/ui';
import RequestCommercialDetails, { RequestCommercialBatch } from './RequestCommercialDetails';

/** Le dashboard reprend les propositions canoniques et leurs actions, sans second parcours. */
export default function DashboardServiceProposals() {
  const { user }=useAuth();
  const { t }=useTranslation();
  const query=useQuery({queryKey:['service-proposals',user?.id,user?.organizationId,0],
    queryFn:()=>serviceAssignmentsApi.inbox(0),enabled:!!user});
  if(query.isPending) return <Skeleton className="h-32" />;
  if(query.isError) return <p role="alert">{t('assignmentFlow.loadFailed')} <Button variant="link" onClick={()=>void query.refetch()}>{t('common.retry')}</Button></p>;
  if(!query.data?.length) return null;
  return <section className="space-y-3 rounded-xl border border-border p-4">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{t('assignmentFlow.inbox')}</h2>
      <Button variant="ghost" size="sm" asChild><Link to="/interventions?tab=service-requests&scope=inbox">{t('requestCommercial.viewProposals')}</Link></Button></div>
    <RequestCommercialBatch ids={query.data.map(item=>item.proposal.requestId)}>
      <div className="grid gap-3 lg:grid-cols-2">{query.data.map(item=><article key={item.proposal.id} className="space-y-3 rounded-lg border border-border p-3">
        <Link className="text-sm font-medium hover:underline" to={'/service-requests/'+item.proposal.requestId}>{item.title}</Link>
        {item.city && <p className="text-xs text-muted-foreground">{item.city}</p>}
        <RequestCommercialDetails id={item.proposal.requestId} status="ASSIGNED" />
      </article>)}</div>
    </RequestCommercialBatch>
  </section>;
}
