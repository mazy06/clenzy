import PagedMissionMap from "../../components/PagedMissionMap";
import { convertServiceRequest } from "../../hooks/useServiceRequestsList";
import type { MissionMapFilters } from "../../hooks/useMissionMap";
import type { ServiceRequestApiResponse } from "./serviceRequestsUtils";
import ServiceRequestMapRow from "./ServiceRequestMapRow";
import { RequestCommercialBatch } from './RequestCommercialDetails';

export default function ServiceRequestsMapView({ filters }: { filters: MissionMapFilters }) {
  return <PagedMissionMap<ServiceRequestApiResponse> kind="service-requests" filters={filters}
    renderRows={rows => Array.from({length:Math.ceil(rows.length/20)},(_,index)=>{
      const batch=rows.slice(index*20,index*20+20);
      return <RequestCommercialBatch key={batch.map(row=>row.id).join(',')} ids={batch.map(row=>Number(row.id))}>
        {batch.map(request=><ServiceRequestMapRow key={request.id} request={convertServiceRequest(request)} />)}
      </RequestCommercialBatch>;
    })}
    renderRow={request => <ServiceRequestMapRow key={request.id} request={convertServiceRequest(request)} />} />;
}
