import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../hooks/useTranslation';
import { reservationsApi } from '../../../services/api/reservationsApi';
import { serviceRequestsApi } from '../../../services/api/serviceRequestsApi';
import { propertiesApi } from '../../../services/api/propertiesApi';
import { resolveMediaUrl } from '../../../config/api';
import { PropertyThumbnail } from '../../../components/baitly/PropertyThumbnail';
import GuestAvatar from '../../../components/GuestAvatar';
import { useFinanceIntervention } from './useFinanceIntervention';

export interface FinanceIdentitySource {
  interventionId?: number | null;
  reservationId?: number | null;
  serviceRequestId?: number | null;
  propertyId?: number | null;
  propertyName?: string | null;
  propertyPhoto?: string | null;
  actorName?: string | null;
  actorPhoto?: string | null;
}

/** Resolve only the source record the user can already consult; never guess by property name. */
export default function FinanceIdentity({ source, variant = 'compact' }: { source: FinanceIdentitySource; variant?: 'compact' | 'detail' }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const scope = `${user?.id}:${user?.organizationId}`;
  const kind = source.interventionId ? 'intervention' : source.reservationId ? 'reservation' : 'request';
  const id = source.interventionId || source.reservationId || source.serviceRequestId;
  const intervention = useFinanceIntervention(source.interventionId);
  const record = useQuery({ queryKey: ['finance-identity', scope, kind, id], enabled: kind !== 'intervention' && !!id && !!user,
    staleTime: 60_000, retry: false, queryFn: async () => {
      if (kind === 'reservation') {
        const item = await reservationsApi.getById(id!);
        return { propertyId: item.propertyId, propertyName: item.propertyName, propertyPhoto: undefined, actorName: undefined, actorPhoto: undefined };
      }
      const item = await serviceRequestsApi.getById(id!);
      return { propertyId: item.propertyId, propertyName: item.propertyName, propertyPhoto: undefined,
        actorName: item.assignedToName || item.assignedToTeam?.name || (item.assignedToUser ? `${item.assignedToUser.firstName} ${item.assignedToUser.lastName}` : undefined), actorPhoto: undefined };
    } });
  const data = kind === 'intervention' ? intervention.data && {
    propertyId: intervention.data.propertyId, propertyName: intervention.data.propertyName,
    propertyPhoto: intervention.data.propertyCoverPhotoUrl, actorName: intervention.data.assignedToName,
    actorPhoto: intervention.data.assignedToAvatarUrl,
  } : record.data;
  const propertyId = source.propertyId || data?.propertyId;
  const photo = source.propertyPhoto || data?.propertyPhoto;
  const property = useQuery({ queryKey: ['finance-property', scope, propertyId], enabled: !!propertyId && !photo && !!user,
    queryFn: () => propertiesApi.getById(propertyId!), staleTime: 300_000, retry: false });
  const propertyName = source.propertyName || data?.propertyName || property.data?.name || t('financeWorkspace.noProperty');
  const actorName = source.actorName || data?.actorName || (record.isError || intervention.isError ? t('financeWorkspace.unavailable') : t('financeWorkspace.noAssignee'));
  const actorPhoto = source.actorPhoto || (!source.actorName || source.actorName === data?.actorName ? data?.actorPhoto : undefined);
  return <span className="finance-identity" data-variant={variant}>
    <span className="finance-identity__part" title={propertyName}><PropertyThumbnail name={propertyName} src={photo || property.data?.coverPhotoUrl} /><span>{variant === 'detail' && <small>{t('paymentDetail.property')}</small>}{propertyName}</span></span>
    <span className="finance-identity__part" title={actorName}><GuestAvatar name={actorName} photoUrl={actorPhoto ? resolveMediaUrl(actorPhoto) : undefined} size={variant === 'detail' ? 40 : 28} sx={{ background: 'var(--bui-muted)', color: 'var(--bui-muted-foreground)', fontSize: 12 }} /><span>{variant === 'detail' && <small>{t(intervention.data?.assignedToType === 'team' ? 'paymentDetail.team' : 'paymentDetail.assignee')}</small>}{actorName}</span></span>
  </span>;
}
