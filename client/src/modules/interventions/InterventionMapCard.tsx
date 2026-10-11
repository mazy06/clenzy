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
import { resolveMediaUrl } from '../../config/api';
import { Calendar, Home, Timer } from '../../icons';
import { useDateFormat } from '../../hooks/useDateFormat';
import { useTranslation } from '../../hooks/useTranslation';
import { interventionsApi } from '../../services/api/interventionsApi';
import { getInterventionStatusLabel, getInterventionTypeLabel } from '../../utils/statusUtils';
import { getStatusTokens, type InterventionDetailsData } from './interventionUtils';

/**
 * Fiche d'une intervention dans la bulle de carte : quoi, quand, où, et qui
 * intervient. Chargée au clic sur le marqueur.
 */
export default function InterventionMapCard({ interventionId }: { interventionId: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fmt = useDateFormat();
  const query = useQuery({
    queryKey: ['interventions', 'map-card', interventionId],
    queryFn: () => interventionsApi.getById(interventionId) as Promise<InterventionDetailsData>,
    staleTime: 30_000,
  });

  if (query.isError) return <MapCardError onRetry={() => void query.refetch()} />;
  if (!query.data) return <MapCardSkeleton />;
  const intervention = query.data;
  const scheduled = intervention.scheduledDate ? new Date(intervention.scheduledDate) : null;
  const photos = intervention.propertyCoverPhotoUrl
    ? [intervention.propertyCoverPhotoUrl]
    : (intervention.sourceIssue?.photoUrls ?? []);
  const where = [
    intervention.propertyName,
    [intervention.propertyAddress, [intervention.propertyPostalCode, intervention.propertyCity].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', '),
  ];

  return (
    <MapCard photos={photos} alt={intervention.propertyName}>
      <MapCardHeader
        eyebrow={getInterventionTypeLabel(intervention.type, t)}
        title={intervention.title}
        status={
          <StatusChip pill tokens={getStatusTokens(intervention.status)} label={getInterventionStatusLabel(intervention.status, t)} />
        }
      />
      <MapCardFacts
        facts={[
          scheduled && {
            icon: <Calendar size={14} />,
            label: t('interventions.scheduled'),
            value: (
              <span className="tabular-nums">
                {fmt.formatFullDate(scheduled)} · {fmt.formatPattern(scheduled, 'HH:mm')}
              </span>
            ),
          },
          intervention.estimatedDurationHours > 0 && {
            icon: <Timer size={14} />,
            label: t('interventions.duration'),
            value: <span className="tabular-nums">{intervention.estimatedDurationHours} h</span>,
          },
          {
            icon: <Home size={14} />,
            label: t('properties.address'),
            value: (
              <>
                <span className="font-medium">{where[0]}</span>
                {where[1] ? <span className="block text-muted-foreground">{where[1]}</span> : null}
              </>
            ),
          },
        ]}
      />
      <MapCardFooter>
        {intervention.assignedToName ? (
          <MapCardPerson
            name={intervention.assignedToName}
            role={
              intervention.assignedToType === 'team'
                ? t('baitlyMap.card.team', 'Équipe intervenante')
                : t('baitlyMap.card.assignee', 'Intervenant')
            }
            avatarUrl={resolveMediaUrl(intervention.assignedToAvatarUrl)}
          />
        ) : (
          <MapCardPerson role={t('interventions.notAssigned')} />
        )}
        <MapCardAction label={t('interventions.viewDetails')} onClick={() => navigate(`/interventions/${intervention.id}`)} />
      </MapCardFooter>
    </MapCard>
  );
}
