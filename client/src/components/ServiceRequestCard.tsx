import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
} from '@mui/material';
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

// Styles alignés sur la référence .pr-card (PropertyCard / screen-properties).
const styles = {
  // ── Card ── (hairline r14 du thème, hover border --line-2 + shadow-card + translateY)
  cardRoot: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'border-color .14s, box-shadow .14s, transform .14s',
    '&:hover': {
      borderColor: 'var(--line-2)',
      boxShadow: 'var(--shadow-card)',
      transform: 'translateY(-2px)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&:hover': { transform: 'none' },
    },
  },
  menuButton: {
    position: 'absolute',
    top: 8,
    right: 10,
    zIndex: 2,
    color: 'rgba(255,255,255,0.7)',
    bgcolor: 'rgba(0,0,0,0.15)',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.3)', color: 'var(--on-accent)' },
    width: 28,
    height: 28,
  },
  infoContent: {
    flexGrow: 1,
    p: 1.75,
    pb: '12px !important',
  },
  // Nom d'entité en display.
  nameText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '-.01em',
    color: 'var(--ink)',
  },
  locationText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    fontSize: '11.5px',
    color: 'var(--muted)',
  },
  // Bande de KPI (valeurs display tabular-nums).
  statValue: {
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--ink)',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '9.5px',
    fontWeight: 700,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    color: 'var(--faint)',
    mt: '1px',
  },
  detailsButton: {
    fontSize: '0.72rem',
    py: 0.5,
  },
} as const;

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
      sx={styles.cardRoot}
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
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, request); }}
          sx={styles.menuButton}
        >
          <MoreVert size={16} strokeWidth={1.75} />
        </IconButton>
      </div>

      {/* ─── Zone info ─── */}
      <CardContent sx={styles.infoContent}>
        {/* Titre + chip type */}
        <div className="flex items-center gap-1 min-w-0 mb-0.5">
          <Typography sx={{ ...styles.nameText, flex: 1 }} title={request.title}>
            {request.title}
          </Typography>
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
          <Typography
            sx={styles.locationText}
            title={`${request.propertyName} — ${request.propertyAddress}, ${request.propertyCity}`}
          >
            {request.propertyName}
          </Typography>
        </div>

        {/* Bande de KPI : échéance / coût est. / durée */}
        <div className="mb-[7.5px] flex border-y border-solid border-[var(--line)]">
          {kpiCells.map((cell) => (
            <div
              key={cell.label}
              className="min-w-0 flex-1 border-e border-solid border-[var(--line)] py-[9px] text-center last:border-e-0"
            >
              <Typography sx={{ ...styles.statValue, ...(cell.color ? { color: cell.color } : {}) }}>
                {cell.value}
              </Typography>
              <Typography sx={styles.statLabel}>{cell.label}</Typography>
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
          fullWidth
          size="small"
          startIcon={<Visibility size={15} strokeWidth={1.75} />}
          onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
          variant="outlined"
          sx={styles.detailsButton}
        >
          Détails
        </Button>
      </div>
    </Card>
  );
});

ServiceRequestCard.displayName = 'ServiceRequestCard';

export default ServiceRequestCard;
