import StatusChip, { STATUS_TONES } from '../../components/StatusChip';
import { convertServiceRequest } from '../../hooks/useServiceRequestsList';
import { useTranslation } from '../../hooks/useTranslation';
import { InterventionMissionRow } from '../interventions/InterventionsMapView';
import ServiceRequestMapRow from '../service-requests/ServiceRequestMapRow';
import type { PrestationRow } from './prestationFilters';
import { InterventionRowMenu, RequestRowMenu } from './PrestationRowMenu';

/** Une ligne de l'écran Prestations : la ligne habituelle de son type, marquée de ce type. */
export default function PrestationRowItem({ row }: { row: PrestationRow }) {
  const { t } = useTranslation();
  if (row.kind === 'intervention') {
    return (
      <InterventionMissionRow
        intervention={row.item}
        badge={<StatusChip pill tokens={STATUS_TONES.neutral} label={t('prestations.kind.intervention', 'Intervention')} />}
        actions={<InterventionRowMenu intervention={row.item} />}
      />
    );
  }
  const request = convertServiceRequest(row.item);
  return (
    <ServiceRequestMapRow
      request={request}
      badge={<StatusChip pill tokens={STATUS_TONES.info} label={t('prestations.kind.request', 'Demande')} />}
      menu={<RequestRowMenu request={request} />}
    />
  );
}
