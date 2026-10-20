import type { ReactNode } from "react";
import ServiceMapIndicator, { ServiceMapStatus } from '../../components/ServiceMapIndicator';
import { Flag } from '../../icons/glyphs';
import { Progress } from '../../components/ui';
import ServiceMapRow from '../service-requests/ServiceMapRow';
import { useTranslation } from '../../hooks/useTranslation';
import type { Intervention } from './useInterventionsList';
import {
  getInterventionStatusLabel,
  getInterventionPriorityLabel,
  getInterventionTypeLabel,
} from '../../utils/statusUtils';
import { getStatusTokens, getPriorityTokens } from './interventionUtils';
import { getProgress } from './interventionsListConstants';

import PagedMissionMap from "../../components/PagedMissionMap";
import InterventionMapCard from "./InterventionMapCard";
import type { MissionMapFilters } from "../../hooks/useMissionMap";

export default function InterventionsMapView({ filters }: { filters: MissionMapFilters }) {
  return <PagedMissionMap<Intervention> kind="interventions" filters={filters}
      renderPopup={marker => marker.id ? <InterventionMapCard interventionId={marker.id} /> : null}
      renderRow={intervention => <InterventionMissionRow key={intervention.id} intervention={intervention} />} />;
}

/** Ligne d'une intervention dans la liste de la carte et dans l'écran Prestations. */
export function InterventionMissionRow({ intervention, badge, actions }: {
  intervention: Intervention; badge?: ReactNode; actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const progress = getProgress(intervention);
  return <ServiceMapRow
    request={{ ...intervention, dueDate: intervention.scheduledDate, durationHours: intervention.estimatedDurationHours }}
    serviceType={getInterventionTypeLabel(intervention.type, t)}
    to={'/interventions/' + intervention.id}
    menu={actions}
    badges={<>
      {badge}
      <ServiceMapStatus status={intervention.status} tokens={getStatusTokens(intervention.status)} label={getInterventionStatusLabel(intervention.status, t)} />
      {intervention.priority.toUpperCase() !== 'NORMAL' && <ServiceMapIndicator icon={Flag} tokens={getPriorityTokens(intervention.priority)} label={getInterventionPriorityLabel(intervention.priority, t)} />}
    </>}>
    {progress > 0 && <div className="mt-2 flex items-center gap-2">
      <Progress value={progress} className="h-1 flex-1" aria-label={t('interventions.fields.initialProgress')} />
      <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
    </div>}
  </ServiceMapRow>;
}
