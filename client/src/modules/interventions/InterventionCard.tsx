import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Visibility,
  Edit,
  LocationOn,
  Person as PersonIcon,
  Group as GroupIcon,
  MoreVert,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { getServiceTypeBannerUrl } from '../../utils/serviceTypeBanner';
import { formatDuration } from '../../utils/formatUtils';
import { getDueMeta, dueToneColor } from '../../utils/dueDateUtils';
import {
  getInterventionStatusLabel,
  getInterventionPriorityLabel,
  getInterventionTypeLabel,
  getInterventionTypeHex,
} from '../../utils/statusUtils';
import { getStatusTokens, getPriorityTokens } from './interventionUtils';

interface Intervention {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyType?: string;
  propertyName: string;
  propertyAddress: string;
  requestorName: string;
  assignedToName: string;
  assignedToType: 'user' | 'team';
  scheduledDate: string;
  estimatedDurationHours: number;
  progressPercentage: number;
  createdAt: string;
}

interface InterventionCardProps {
  intervention: Intervention;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, intervention: Intervention) => void;
  canEdit?: boolean;
}

// Dégradé par catégorie de type (fallback derrière la photo) — identique à
// ServiceRequestCard pour un design de bandeau unifié entre les deux cartes.
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

  if (cleaningTypes.includes(type)) return 'linear-gradient(135deg, #7BA3C2 0%, #9BB8D1 100%)';
  if (repairTypes.includes(type)) return 'linear-gradient(135deg, #C07A7A 0%, #D4A0A0 100%)';
  if (maintenanceTypes.includes(type)) return 'linear-gradient(135deg, #D4A574 0%, #E8C19A 100%)';
  if (outdoorTypes.includes(type)) return 'linear-gradient(135deg, #6B9B8E 0%, #8BB5A8 100%)';
  return 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)';
};

// ─── Styles alignés sur la référence .pr-card (PropertyCard / screen-properties) ───
const styles = {
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
  // Bandeau statique photo + dégradé par type (h110) — identique à ServiceRequestCard.
  bannerBox: {
    position: 'relative',
    height: 110,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Pastille statut top-left (fond translucide + blur, dot coloré + libellé).
  statusPill: {
    position: 'absolute',
    top: 10,
    left: 12,
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
    top: 10,
    right: 12,
    zIndex: 2,
    color: 'rgba(255,255,255,0.6)',
    bgcolor: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: 'var(--on-accent)' },
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

const InterventionCard: React.FC<InterventionCardProps> = React.memo(({
  intervention,
  onMenuOpen,
  canEdit = false,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const statusTokens = getStatusTokens(intervention.status);
  const priorityTokens = getPriorityTokens(intervention.priority);
  const typeHex = getInterventionTypeHex(intervention.type);
  const dueMeta = getDueMeta(intervention.scheduledDate, t);

  const kpiCells = [
    { value: dueMeta.label, color: dueToneColor(dueMeta.tone), label: t('interventions.kpi.due') },
    { value: `${intervention.progressPercentage}%`, label: t('interventions.kpi.progress') },
    { value: `~${formatDuration(intervention.estimatedDurationHours)}`, label: t('interventions.kpi.duration') },
  ];

  const assigneeName = intervention.assignedToName || intervention.requestorName || 'Non assigné';

  const handleViewDetails = () => {
    navigate(`/interventions/${intervention.id}`);
  };

  return (
    <Card
      sx={styles.cardRoot}
      onClick={handleViewDetails}
    >
      {/* ─── Bandeau statique photo + dégradé (par type) + pastille statut ─── */}
      <Box
        sx={{
          ...styles.bannerBox,
          background: getTypeGradient(intervention.type),
          backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.35)), url(${getServiceTypeBannerUrl(intervention.type)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Pastille statut top-left (dot coloré + libellé) */}
        <Box sx={styles.statusPill}>
          <Box sx={{ ...styles.statusDot, bgcolor: statusTokens.color }} />
          {getInterventionStatusLabel(intervention.status, t)}
        </Box>

        {/* Menu contextuel top-right */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, intervention); }}
          sx={styles.menuButton}
        >
          <MoreVert size={16} strokeWidth={1.75} />
        </IconButton>
      </Box>

      {/* ─── Zone info ─── */}
      <CardContent sx={styles.infoContent}>
        {/* Titre + chip type */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, mb: 0.5 }}>
          <Typography sx={{ ...styles.nameText, flex: 1 }} title={intervention.title}>
            {intervention.title}
          </Typography>
          <Chip
            label={getInterventionTypeLabel(intervention.type, t)}
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
            title={`${intervention.propertyName} - ${intervention.propertyAddress}`}
          >
            {intervention.propertyName}
          </Typography>
        </Box>

        {/* Bande de KPI : échéance / avancement / durée */}
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
            {intervention.assignedToType === 'team'
              ? <GroupIcon size={13} strokeWidth={2} />
              : <PersonIcon size={13} strokeWidth={2} />}
          </Box>
          <Box component="span" sx={styles.footStrong}>{assigneeName}</Box>
          <Box sx={{ flex: 1 }} />
          <Chip
            label={getInterventionPriorityLabel(intervention.priority, t)}
            size="small"
            sx={{
              ...styles.priorityChip,
              backgroundColor: priorityTokens.bg,
              color: priorityTokens.color,
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
        {canEdit && (
          <Button
            fullWidth
            size="small"
            startIcon={<Edit size={15} strokeWidth={1.75} />}
            onClick={(e) => { e.stopPropagation(); navigate(`/interventions/${intervention.id}/edit`); }}
            variant="outlined"
            color="primary"
            sx={styles.detailsButton}
          >
            Modifier
          </Button>
        )}
      </Box>
    </Card>
  );
});

InterventionCard.displayName = 'InterventionCard';

export default InterventionCard;
