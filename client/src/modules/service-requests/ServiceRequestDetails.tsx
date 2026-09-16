import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ClipboardList, Pencil, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, Button, Skeleton } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useServiceRequestDetails } from '../../hooks/useServiceRequestDetails';
import { useTranslation } from '../../hooks/useTranslation';
import { MANAGER_ROLES } from '../../constants/roles';
import PageHeader from '../../components/PageHeader';
import StuckServiceDialog from '../../components/baitly/StuckServiceDialog';
import AssignmentHistory from './AssignmentHistory';
import ServiceRequestDetailContent from './ServiceRequestDetailContent';

export type { ServiceRequestDetailsData } from '../../hooks/useServiceRequestDetails';

export default function ServiceRequestDetails() {
  const { id } = useParams<{ id: string }>();
  const { hasPermissionAsync, hasAnyRole } = useAuth();
  const { t } = useTranslation();
  const { serviceRequest: sr, isLoading, isError, error } = useServiceRequestDetails(id);
  const [canEdit, setCanEdit] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const manager = hasAnyRole([...MANAGER_ROLES]);
  useEffect(() => {
    let active = true;
    void hasPermissionAsync('service-requests:edit').then(value => { if (active) setCanEdit(value); }).catch(() => { if (active) setCanEdit(false); });
    return () => { active = false; };
  }, [hasPermissionAsync]);

  if (isLoading) return <div className="space-y-5 p-4" aria-label={t('requestCommercial.loading')}>
    <Skeleton className="h-16 w-full" /><Skeleton className="h-40 w-full" />
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3"><Skeleton className="h-80 lg:col-span-2" /><Skeleton className="h-80" /></div>
  </div>;
  if (isError || !sr) return <Alert variant={isError ? 'destructive' : 'warning'} className="m-4"><TriangleAlert />
    <AlertDescription>{error || t(isError ? 'serviceRequests.loadError' : 'serviceRequests.notFound')}</AlertDescription>
  </Alert>;

  const canReschedule = canEdit && !sr.interventionId && !sr.marketplaceRequestId && ['PENDING', 'ASSIGNED'].includes(sr.status);
  return <div className="flex h-full min-h-0 flex-col">
    <div className="shrink-0"><PageHeader title={sr.title}
      subtitle={t('serviceRequests.detail.contextLabel', 'Demande de service')} iconBadge={<ClipboardList />}
      backPath="/service-requests" actions={canEdit && !sr.interventionId && !sr.marketplaceRequestId ? <>
        {canReschedule && <Button variant="outline" size="sm" onClick={() => setRescheduling(true)}>{t('dashboard.stuckService.reschedule', 'Replanifier')}</Button>}
        <Button variant="outline" size="sm" asChild><Link to={`/service-requests/${id}/edit`}><Pencil className="size-4" aria-hidden />{t('serviceRequests.modify')}</Link></Button>
      </> : undefined} /></div>
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 sm:px-4">
      {sr.marketplaceRequestId && <Alert className="mb-4"><AlertDescription>
        {t('serviceReference.commercialNeed', { id: sr.marketplaceRequestId })}
        <Button variant="link" asChild><Link to="/devis">{t('marketplaceQuotes.sent')}</Link></Button>
      </AlertDescription></Alert>}
      <ServiceRequestDetailContent request={sr} manager={manager} history={manager ?
        <AssignmentHistory requestId={Number(id)} allowResume={canReschedule} /> : undefined} />
    </div>
    <StuckServiceDialog schedulingOnly serviceRequestId={rescheduling ? Number(id) : null}
      onClose={() => setRescheduling(false)} service={{ title: sr.title, propertyId: sr.propertyId, propertyName: sr.propertyName }}
      invalidateKeys={[["service-request-details"], ["service-requests-list"]]} />
  </div>;
}
