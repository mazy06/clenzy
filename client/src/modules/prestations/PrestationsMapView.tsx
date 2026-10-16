import PagedMissionMap from '../../components/PagedMissionMap';
import type { MissionMapFilters } from '../../hooks/useMissionMap';
import InterventionMapCard from '../interventions/InterventionMapCard';
import ServiceRequestMapCard from '../service-requests/ServiceRequestMapCard';
import PrestationRows from './PrestationRows';
import type { PrestationRow } from './prestationFilters';

/** Une seule carte : les épingles des interventions et des demandes, et leur liste commune. */
export default function PrestationsMapView({ filters }: { filters: MissionMapFilters }) {
  return (
    <PagedMissionMap<PrestationRow>
      kind="prestations"
      filters={filters}
      renderPopup={(marker) => {
        if (!marker.id) return null;
        return marker.type === 'service_request'
          ? <ServiceRequestMapCard requestId={marker.id} />
          : <InterventionMapCard interventionId={marker.id} />;
      }}
      renderRows={(rows) => <PrestationRows rows={rows} />}
      renderRow={(row) => <PrestationRows key={row.id} rows={[row]} />}
    />
  );
}
