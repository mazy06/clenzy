import StatusChip from '../../components/StatusChip';
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
import type { MissionMapFilters } from "../../hooks/useMissionMap";

export default function InterventionsMapView({ filters }: { filters: MissionMapFilters }) {
  const { t } = useTranslation();
  return <PagedMissionMap<Intervention> kind="interventions" filters={filters}
      renderRow={intervention => {
        const progress = getProgress(intervention);
        return <ServiceMapRow key={intervention.id}
          request={{ ...intervention, dueDate: intervention.scheduledDate, durationHours: intervention.estimatedDurationHours }}
          serviceType={getInterventionTypeLabel(intervention.type, t)}
          to={'/interventions/' + intervention.id}
          badges={<>
            <StatusChip pill tokens={getStatusTokens(intervention.status)} label={getInterventionStatusLabel(intervention.status, t)} />
            {intervention.priority.toUpperCase() !== 'NORMAL' && <StatusChip pill tokens={getPriorityTokens(intervention.priority)} label={getInterventionPriorityLabel(intervention.priority, t)} />}
          </>}>
          {progress > 0 && <div className="mt-2 flex items-center gap-2">
            <Progress value={progress} className="h-1 flex-1" aria-label={t('interventions.fields.initialProgress')} />
            <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
          </div>}
        </ServiceMapRow>;
      }} />;
}
