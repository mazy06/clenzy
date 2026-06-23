import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  IconButton,
} from '@mui/material';
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
  bannerBox: {
    position: 'relative',
    height: 118,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Pastille statut top-left (fond translucide + blur, dot coloré + libellé).
  statusPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.625,
    fontSize: '10.5px',
    fontWeight: 700,
    px: '9px',
    py: '4px',
    borderRadius: '20px',
    bgcolor: 'rgba(255,255,255,.92)',
    backdropFilter: 'blur(4px)',
    color: '#2A3942',
    lineHeight: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
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
  // Chip type (soft, teinté par getInterventionTypeHex).
  typeChip: {
    height: 22,
    fontSize: '0.62rem',
    fontWeight: 600,
    borderRadius: '6px',
    flexShrink: 0,
    '& .MuiChip-label': { px: 0.75 },
  },
  // Ligne localisation (propriété).
  locationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    mb: 1.25,
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
  statsBand: {
    display: 'flex',
    borderTop: '1px solid var(--line)',
    borderBottom: '1px solid var(--line)',
    mb: 1.25,
  },
  statCell: {
    flex: 1,
    py: '9px',
    textAlign: 'center',
    borderRight: '1px solid var(--line)',
    minWidth: 0,
    '&:last-child': { borderRight: 0 },
  },
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
  // Pied opérationnel : icône accent + libellé fort.
  footRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.875,
    fontSize: '11.5px',
    color: 'var(--muted)',
    minWidth: 0,
  },
  footIcon: {
    display: 'inline-flex',
    color: 'var(--accent)',
    flexShrink: 0,
  },
  footStrong: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--body)',
    fontWeight: 600,
  },
  // Chip priorité (soft) dans le pied.
  priorityChip: {
    height: 20,
    fontSize: '0.62rem',
    fontWeight: 600,
    borderRadius: '6px',
    flexShrink: 0,
    '& .MuiChip-label': { px: 0.75 },
  },
  actionBar: {
    px: 1.75,
    pb: 1.25,
    pt: 0,
    display: 'flex',
    gap: 0.75,
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
      <Box
        sx={{
          ...styles.bannerBox,
          background: getTypeGradient(request.type),
          backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.35)), url(${getServiceTypeBannerUrl(request.type)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Pastille statut top-left (dot coloré + libellé) */}
        <Box sx={styles.statusPill}>
          <Box sx={{ ...styles.statusDot, bgcolor: statusHex }} />
          {statusLabel}
        </Box>

        {/* Menu contextuel top-right */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, request); }}
          sx={styles.menuButton}
        >
          <MoreVert size={16} strokeWidth={1.75} />
        </IconButton>
      </Box>

      {/* ─── Zone info ─── */}
      <CardContent sx={styles.infoContent}>
        {/* Titre + chip type */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, mb: 0.5 }}>
          <Typography sx={{ ...styles.nameText, flex: 1 }} title={request.title}>
            {request.title}
          </Typography>
          <Chip
            label={getInterventionTypeLabel(request.type, t)}
            size="small"
            sx={{
              ...styles.typeChip,
              backgroundColor: `${typeHex}18`,
              color: typeHex,
              border: `1px solid ${typeHex}40`,
            }}
          />
        </Box>

        {/* Propriété */}
        <Box sx={styles.locationRow}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)', flexShrink: 0 }}>
            <LocationOn size={14} strokeWidth={1.75} />
          </Box>
          <Typography
            sx={styles.locationText}
            title={`${request.propertyName} — ${request.propertyAddress}, ${request.propertyCity}`}
          >
            {request.propertyName}
          </Typography>
        </Box>

        {/* Bande de KPI : échéance / coût est. / durée */}
        <Box sx={styles.statsBand}>
          {kpiCells.map((cell, idx) => (
            <Box key={idx} sx={styles.statCell}>
              <Typography sx={{ ...styles.statValue, ...(cell.color ? { color: cell.color } : {}) }}>
                {cell.value}
              </Typography>
              <Typography sx={styles.statLabel}>{cell.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Pied opérationnel : assigné (gauche) + priorité (droite) */}
        <Box sx={{ ...styles.footRow, minHeight: 20 }}>
          <Box component="span" sx={styles.footIcon}>
            {request.assignedToType === 'team'
              ? <GroupIcon size={13} strokeWidth={2} />
              : <PersonIcon size={13} strokeWidth={2} />}
          </Box>
          <Box component="span" sx={styles.footStrong}>{assigneeName}</Box>
          <Box sx={{ flex: 1 }} />
          <Chip
            label={priorityLabel}
            size="small"
            sx={{
              ...styles.priorityChip,
              backgroundColor: `${priorityHex}18`,
              color: priorityHex,
            }}
          />
        </Box>
      </CardContent>

      {/* ─── Zone actions ─── */}
      <Box sx={styles.actionBar}>
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
      </Box>
    </Card>
  );
});

ServiceRequestCard.displayName = 'ServiceRequestCard';

export default ServiceRequestCard;
