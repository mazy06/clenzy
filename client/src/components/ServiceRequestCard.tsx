import React from 'react';
import { Button, Card, CardContent } from './ui';
import { cn } from '../utils/cn';
import StatusChip from './StatusChip';
import {
  Visibility,
  MoreVert,
  LocationOn,
  Person as PersonIcon,
  Group as GroupIcon,
} from '../icons';
import { useNavigate } from 'react-router-dom';
import { getServiceTypeBannerUrl } from '../utils/serviceTypeBanner';
import { useTranslation } from '../hooks/useTranslation';
import { formatDuration } from '../utils/formatUtils';
import { Money } from './Money';
import { getDueMeta, dueToneColor } from '../utils/dueDateUtils';
import {
  getServiceRequestStatusHex,
  getServiceRequestPriorityLabel,
  getServiceRequestPriorityHex,
  getInterventionTypeLabel,
  getInterventionTypeHex,
} from '../utils/statusUtils';

interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  requestorId: number;
  requestorName: string;
  assignedToId?: number;
  assignedToName?: string;
  assignedToType?: 'user' | 'team';
  estimatedDuration: number;
  estimatedCost?: number;
  dueDate: string;
  createdAt: string;
  approvedAt?: string;
}

interface ServiceRequestCardProps {
  request: ServiceRequest;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, request: ServiceRequest) => void;
  typeIcons: { [key: string]: React.ReactElement };
  statuses: Array<{ value: string; label: string }>;
  priorities: Array<{ value: string; label: string }>;
  statusColors: { [key: string]: string };
  priorityColors: { [key: string]: string };
}

// Gradient par catégorie de type de demande de service
const getTypeGradient = (type: string): string => {
  const cleaningTypes = [
    'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
    'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING',
    'EXTERIOR_CLEANING', 'DISINFECTION',
  ];
  const repairTypes = [
    'EMERGENCY_REPAIR', 'ELECTRICAL_REPAIR', 'PLUMBING_REPAIR',
    'HVAC_REPAIR', 'APPLIANCE_REPAIR',
  ];
  const maintenanceTypes = ['PREVENTIVE_MAINTENANCE', 'RESTORATION'];
  const outdoorTypes = ['GARDENING', 'PEST_CONTROL'];

  if (cleaningTypes.includes(type)) {
    return 'linear-gradient(135deg, #7BA3C2 0%, #9BB8D1 100%)';
  }
  if (repairTypes.includes(type)) {
    return 'linear-gradient(135deg, #C07A7A 0%, #D4A0A0 100%)';
  }
  if (maintenanceTypes.includes(type)) {
    return 'linear-gradient(135deg, #D4A574 0%, #E8C19A 100%)';
  }
  if (outdoorTypes.includes(type)) {
    return 'linear-gradient(135deg, #6B9B8E 0%, #8BB5A8 100%)';
  }
  return 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)';
};

// Styles alignés sur la référence .pr-card (PropertyCard / screen-properties) :
// hairline r14, hover border --line-2 + shadow-card + translateY. Le `ring-0`
// neutralise l'anneau du gabarit de carte, remplacé ici par une vraie bordure
// dont la teinte change au survol.
const CARD_CLASS = 'h-full flex flex-col overflow-hidden cursor-pointer py-0 gap-0 rounded-[14px] ring-0 '
  + 'border border-solid border-[var(--line)] transition-[border-color,box-shadow,transform] duration-[140ms] '
  + 'hover:border-[var(--line-2)] hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 '
  + 'motion-reduce:transition-none motion-reduce:hover:translate-y-0';

// Nom d'entité en display.
const NAME_TEXT_CLASS = 'cn-text-body1 truncate font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-[-.01em] text-[var(--ink)]';
const LOCATION_TEXT_CLASS = 'cn-text-body1 truncate flex-1 text-[11.5px] text-[var(--muted)]';
// Bande de KPI (valeurs display tabular-nums).
const STAT_VALUE_CLASS = 'cn-text-body1 font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--ink)] tabular-nums leading-[1.2]';
const STAT_LABEL_CLASS = 'cn-text-body1 text-[9.5px] font-bold tracking-[.04em] uppercase text-[var(--faint)] mt-px';

const ServiceRequestCard: React.FC<ServiceRequestCardProps> = React.memo(({
  request,
  onMenuOpen,
  statuses,
  priorities,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const statusLabel = statuses.find(s => s.value === request.status)?.label || request.status;
  const statusHex = getServiceRequestStatusHex(request.status);
  const typeHex = getInterventionTypeHex(request.type);
  const priorityHex = getServiceRequestPriorityHex(request.priority);
  const priorityLabel = getServiceRequestPriorityLabel(request.priority, t);
  const dueMeta = getDueMeta(request.dueDate, t);

  const kpiCells = [
    { value: dueMeta.label, color: dueToneColor(dueMeta.tone), label: t('interventions.kpi.due') },
    {
      value: request.estimatedCost != null && request.estimatedCost > 0
        ? <Money value={request.estimatedCost} from="EUR" decimals={0} />
        : '—',
      label: t('interventions.kpi.cost'),
    },
    { value: `~${formatDuration(request.estimatedDuration)}`, label: t('interventions.kpi.duration') },
  ];

  const assigneeName = request.assignedToName || request.requestorName || 'Non assigné';

  const handleViewDetails = () => {
    navigate(`/service-requests/${request.id}`);
  };

  return (
    <Card
      className={CARD_CLASS}
      onClick={handleViewDetails}
    >
      {/* ─── Bandeau image + gradient + pastille statut ─── */}
      <div
        className="relative flex h-[118px] items-center justify-center overflow-hidden"
        style={{
          background: getTypeGradient(request.type),
          backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.35)), url(${getServiceTypeBannerUrl(request.type)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Pastille statut top-left (fond translucide + blur, dot coloré + libellé) */}
        <div className="absolute top-[10px] start-[10px] z-[2] inline-flex items-center gap-[3.75px] rounded-[20px] bg-[rgba(255,255,255,0.92)] px-[9px] py-[4px] text-[10.5px] font-bold leading-none text-[#2A3942] backdrop-blur-[4px]">
          {/* Teinte de statut calculee a l'execution : impossible en classe Tailwind. */}
          <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ backgroundColor: statusHex }} />
          {statusLabel}
        </div>

        {/* Menu contextuel top-right */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Actions de la demande"
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, request); }}
          className="absolute top-2 end-[10px] z-[2] text-[rgba(255,255,255,0.7)] bg-[rgba(0,0,0,0.15)] hover:bg-[rgba(0,0,0,0.3)] hover:text-[var(--on-accent)]"
        >
          <MoreVert size={16} strokeWidth={1.75} />
        </Button>
      </div>

      {/* ─── Zone info ─── */}
      <CardContent className="grow p-[10.5px] pb-[12px]">
        {/* Titre + chip type */}
        <div className="flex items-center gap-1 min-w-0 mb-0.5">
          <p className={cn(NAME_TEXT_CLASS, 'flex-1')} title={request.title}>
            {request.title}
          </p>
          {/* Bordure teintee a l'execution : une classe Tailwind ne peut pas
              naitre d'une variable. Le raccourci `border` inline porte aussi le
              border-style, il l'emporte donc sur le `border-none` du gabarit. */}
          <StatusChip
            color={typeHex}
            label={getInterventionTypeLabel(request.type, t)}
            className="shrink-0 text-[0.62rem]"
            sx={{ border: `1px solid ${typeHex}40` }}
          />
        </div>

        {/* Propriété */}
        <div className="mb-[7.5px] flex items-center gap-[3px]">
          <span className="inline-flex text-[var(--muted)] shrink-0">
            <LocationOn size={14} strokeWidth={1.75} />
          </span>
          <p
            className={LOCATION_TEXT_CLASS}
            title={`${request.propertyName} — ${request.propertyAddress}, ${request.propertyCity}`}
          >
            {request.propertyName}
          </p>
        </div>

        {/* Bande de KPI : échéance / coût est. / durée */}
        <div className="mb-[7.5px] flex border-y border-solid border-[var(--line)]">
          {kpiCells.map((cell) => (
            <div
              key={cell.label}
              className="min-w-0 flex-1 border-e border-solid border-[var(--line)] py-[9px] text-center last:border-e-0"
            >
              {/* La teinte d'echeance est calculee a l'execution : style inline obligatoire. */}
              <p className={STAT_VALUE_CLASS} style={cell.color ? { color: cell.color } : undefined}>
                {cell.value}
              </p>
              <p className={STAT_LABEL_CLASS}>{cell.label}</p>
            </div>
          ))}
        </div>

        {/* Pied opérationnel : assigné (gauche) + priorité (droite) */}
        <div className="flex min-h-[20px] min-w-0 items-center gap-[5.25px] text-[11.5px] text-[var(--muted)]">
          <span className="inline-flex shrink-0 text-[var(--accent)]">
            {request.assignedToType === 'team'
              ? <GroupIcon size={13} strokeWidth={2} />
              : <PersonIcon size={13} strokeWidth={2} />}
          </span>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--body)]">{assigneeName}</span>
          <div className="flex-1" />
          <StatusChip
            color={priorityHex}
            label={priorityLabel}
            className="h-[20px] shrink-0 text-[0.62rem]"
          />
        </div>
      </CardContent>

      {/* ─── Zone actions ─── */}
      <div className="flex gap-[4.5px] px-[10.5px] pt-0 pb-[7.5px]">
        <Button
          className="w-full"
          size="sm"
          onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
          variant="outline"
        >
          <Visibility size={15} strokeWidth={1.75} />
          Détails
        </Button>
      </div>
    </Card>
  );
});

ServiceRequestCard.displayName = 'ServiceRequestCard';

export default ServiceRequestCard;
