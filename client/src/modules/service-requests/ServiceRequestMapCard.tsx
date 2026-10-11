import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import StatusChip from '../../components/StatusChip';
import {
  MapCard,
  MapCardAction,
  MapCardError,
  MapCardFacts,
  MapCardFooter,
  MapCardHeader,
  MapCardPerson,
  MapCardSkeleton,
} from '../../components/map/MapCard';
import { Calendar, Home, Timer } from '../../icons';
import { useDateFormat } from '../../hooks/useDateFormat';
import { useTranslation } from '../../hooks/useTranslation';
import { serviceRequestsApi } from '../../services/api/serviceRequestsApi';
import { getInterventionTypeLabel, getServiceRequestStatusLabel } from '../../utils/statusUtils';
import { srStatusTokens } from './serviceRequestsListConstants';

/**
 * Fiche d'une demande de service dans la bulle de carte : la prestation, la
 * date souhaitée, le logement et le prestataire pressenti.
 */
export default function ServiceRequestMapCard({ requestId }: { requestId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fmt = useDateFormat();
  const query = useQuery({
    queryKey: ['service-requests', 'map-card', requestId],
    queryFn: () => serviceRequestsApi.getById(requestId),
    staleTime: 30_000,
  });

  if (query.isError) return <MapCardError onRetry={() => void query.refetch()} />;
  if (!query.data) return <MapCardSkeleton />;
  const request = query.data;
  const desired = request.desiredDate ? new Date(request.desiredDate) : null;

  return (
    <MapCard alt={request.propertyName ?? request.title}>
      <MapCardHeader
        eyebrow={getInterventionTypeLabel(request.serviceType, t)}
        title={request.title}
        status={<StatusChip pill tokens={srStatusTokens(request.status)} label={getServiceRequestStatusLabel(request.status, t)} />}
      />
      <MapCardFacts
        facts={[
          desired && {
            icon: <Calendar size={14} />,
            label: t('serviceRequests.dueDateLabel'),
            value: (
              <span className="tabular-nums">
                {fmt.formatFullDate(desired)} · {fmt.formatPattern(desired, 'HH:mm')}
              </span>
            ),
          },
          request.estimatedDurationHours > 0 && {
            icon: <Timer size={14} />,
            label: t('serviceRequests.estimatedDurationLabel'),
            value: <span className="tabular-nums">{request.estimatedDurationHours} h</span>,
          },
          {
            icon: <Home size={14} />,
            label: t('properties.address'),
            value: (
              <>
                <span className="font-medium">{request.propertyName}</span>
                {request.propertyAddress ? <span className="block text-muted-foreground">{request.propertyAddress}</span> : null}
              </>
            ),
          },
        ]}
      />
      <MapCardFooter>
        {request.assignedToName ? (
          <MapCardPerson
            name={request.assignedToName}
            role={
              request.assignedToType === 'team'
                ? t('baitlyMap.card.team', 'Équipe intervenante')
                : t('baitlyMap.card.assignee', 'Intervenant')
            }
          />
        ) : (
          <MapCardPerson role={t('interventions.notAssigned')} />
        )}
        <MapCardAction label={t('serviceRequests.viewDetails')} onClick={() => navigate(`/service-requests/${request.id}`)} />
      </MapCardFooter>
    </MapCard>
  );
}
