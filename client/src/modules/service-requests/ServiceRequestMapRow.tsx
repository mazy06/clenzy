import StatusChip, { STATUS_TONES } from '../../components/StatusChip';
import { useTranslation } from '../../hooks/useTranslation';
import { getServiceRequestStatusLabel, getServiceRequestPriorityLabel, getInterventionTypeLabel } from '../../utils/statusUtils';
import { srStatusTokens, srPriorityTokens } from './serviceRequestsListConstants';
import { isServiceRequestOverdue, type ServiceRequest } from './serviceRequestsUtils';
import ServiceMapRow from './ServiceMapRow';
import RequestCommercialDetails from './RequestCommercialDetails';

export default function ServiceRequestMapRow({ request }: { request: ServiceRequest }) {
  const { t } = useTranslation();
  return <ServiceMapRow request={{ ...request, durationHours: request.estimatedDuration }} serviceType={getInterventionTypeLabel(request.type, t)} to={'/service-requests/' + request.id} badges={<>
    {isServiceRequestOverdue(request) && <StatusChip pill tokens={STATUS_TONES.err} label={t('requestMap.overdue', 'Retard')} />}
    {request.status.toUpperCase() !== 'PENDING' && <StatusChip pill tokens={srStatusTokens(request.status)} label={getServiceRequestStatusLabel(request.status, t)} />}
    {request.priority.toUpperCase() !== 'NORMAL' && <StatusChip pill tokens={srPriorityTokens(request.priority)} label={getServiceRequestPriorityLabel(request.priority, t)} />}
  </>} actions={<RequestCommercialDetails id={request.id} interventionId={request.interventionId} status={request.status} estimate={request.estimatedCost}
    assignmentPhase={request.assignmentPhase} assignmentExpiresAt={request.assignmentExpiresAt} autoAssignStatus={request.autoAssignStatus} />} />;
}
