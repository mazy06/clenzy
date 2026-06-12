import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Visibility,
  Edit,
  LocationOn,
  AutoAwesome,
  Build,
  Schedule,
  AccessTime,
  Person as PersonIcon,
  Group as GroupIcon,
  MoreVert,
  Category,
  Yard,
  BugReport,
  AutoFixHigh,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import LiveDashboardPulse from './LiveDashboardPulse';
import { useTranslation } from '../../hooks/useTranslation';
import { formatShortDate, formatTimeFromDate, formatDuration } from '../../utils/formatUtils';
import {
  getInterventionStatusLabel,
  getInterventionPriorityLabel,
  getInterventionTypeLabel,
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

// Icône de type en arrière-plan
const getTypeIcon = (type: string, size: number = 48) => {
  const iconProps = { size, color: "rgba(255,255,255,0.18)", strokeWidth: 1.5 };
  const cleaningTypes = [
    'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
    'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING',
    'EXTERIOR_CLEANING', 'DISINFECTION',
  ];
  const repairTypes = [
    'EMERGENCY_REPAIR', 'ELECTRICAL_REPAIR', 'PLUMBING_REPAIR',
    'HVAC_REPAIR', 'APPLIANCE_REPAIR',
  ];

  if (cleaningTypes.includes(type)) return <AutoAwesome {...iconProps} />;
  if (repairTypes.includes(type)) return <Build {...iconProps} />;
  if (type === 'PREVENTIVE_MAINTENANCE') return <Build {...iconProps} />;
  if (type === 'GARDENING') return <Yard {...iconProps} />;
  if (type === 'PEST_CONTROL') return <BugReport {...iconProps} />;
  if (type === 'RESTORATION') return <AutoFixHigh {...iconProps} />;
  return <Category {...iconProps} />;
};

// Petite icône de type pour le header
const getTypeSmallIcon = (type: string) => {
  const iconProps = { size: 16, strokeWidth: 1.75, color: 'rgba(255,255,255,0.85)' };
  const cleaningTypes = [
    'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
    'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING',
    'EXTERIOR_CLEANING', 'DISINFECTION',
  ];
  const repairTypes = [
    'EMERGENCY_REPAIR', 'ELECTRICAL_REPAIR', 'PLUMBING_REPAIR',
    'HVAC_REPAIR', 'APPLIANCE_REPAIR',
  ];

  if (cleaningTypes.includes(type)) return <AutoAwesome {...iconProps} />;
  if (repairTypes.includes(type)) return <Build {...iconProps} />;
  if (type === 'PREVENTIVE_MAINTENANCE') return <Build {...iconProps} />;
  if (type === 'GARDENING') return <Yard {...iconProps} />;
  if (type === 'PEST_CONTROL') return <BugReport {...iconProps} />;
  if (type === 'RESTORATION') return <AutoFixHigh {...iconProps} />;
  return <Category {...iconProps} />;
};

// ─── Extracted sx styles (module-level constants for render perf) ───
const styles = {
  cardRoot: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'border-color .15s, box-shadow .15s',
    '&:hover': {
      borderColor: 'var(--line-2)',
      boxShadow: 'var(--shadow-card)',
    },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  },
  typeLabelBox: {
    position: 'absolute',
    top: 10,
    left: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 0.6,
    bgcolor: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(8px)',
    borderRadius: 1.5,
    border: '1px solid rgba(255,255,255,0.1)',
    px: 1,
    py: 0.4,
  },
  typeLabelText: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: 600,
    fontSize: '0.68rem',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  menuButton: {
    position: 'absolute',
    top: 10,
    right: 12,
    color: 'rgba(255,255,255,0.6)',
    bgcolor: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: 'var(--on-accent)' },
    width: 28,
    height: 28,
  },
  badgeBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    px: 1.5,
    py: 0.75,
    bgcolor: 'var(--surface-2)',
    borderBottom: '1px solid',
    borderColor: 'var(--line)',
    gap: 0.75,
    minHeight: 34,
  },
  statusChip: {
    height: 22,
    fontSize: '0.62rem',
    fontWeight: 600,
    borderWidth: 1.5,
    '& .MuiChip-label': { px: 0.75 },
  },
  priorityChip: {
    height: 22,
    fontSize: '0.62rem',
    fontWeight: 600,
    borderWidth: 1.5,
    '& .MuiChip-label': { px: 0.75 },
  },
  dateBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.4,
    flexShrink: 0,
  },
  dateText: {
    color: 'text.secondary',
    fontWeight: 600,
    fontSize: '0.68rem',
    lineHeight: 1,
  },
  infoContent: {
    flexGrow: 1,
    p: 1.75,
    pb: '8px !important',
  },
  titleText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.95rem',
    mb: 0.25,
    color: 'text.primary',
  },
  descriptionText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
    fontSize: '0.7rem',
    mb: 1,
  },
  propertyText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    fontSize: '0.7rem',
  },
  progressBar: {
    height: 5,
    borderRadius: 3,
    bgcolor: 'var(--hover)',
    '& .MuiLinearProgress-bar': {
      borderRadius: 3,
    },
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

  const handleViewDetails = () => {
    navigate(`/interventions/${intervention.id}`);
  };

  // Couleur de la barre de progression
  const getProgressColor = (pct: number): 'inherit' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    if (pct >= 100) return 'success';
    if (pct >= 50) return 'primary';
    if (pct >= 25) return 'info';
    return 'warning';
  };

  return (
    <Card
      sx={styles.cardRoot}
      onClick={handleViewDetails}
    >
      {/* ─── Zone visuelle : Bandeau Live Dashboard Pulse ─── */}
      <LiveDashboardPulse
        type={intervention.type}
        priority={intervention.priority}
        status={intervention.status}
        height={110}
      >
        {/* Type en haut à gauche — label glassmorphism */}
        <Box
          sx={styles.typeLabelBox}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {getTypeSmallIcon(intervention.type)}
          </Box>
          <Typography
            variant="caption"
            sx={styles.typeLabelText}
          >
            {getInterventionTypeLabel(intervention.type, t)}
          </Typography>
        </Box>

        {/* Menu contextuel — coin supérieur droit */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, intervention); }}
          sx={styles.menuButton}
        >
          <MoreVert size={16} strokeWidth={1.75} />
        </IconButton>
      </LiveDashboardPulse>

      {/* ─── Barre de badges (entre bandeau et contenu) ─── */}
      <Box sx={styles.badgeBar}>
        {/* Gauche : statut + priorité */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {(() => { const tk = getStatusTokens(intervention.status); return (
            <Chip
              label={getInterventionStatusLabel(intervention.status, t)}
              size="small"
              sx={{ ...styles.statusChip, backgroundColor: tk.bg, color: tk.color, borderRadius: '6px' }}
            />
          ); })()}
          {(() => { const tk = getPriorityTokens(intervention.priority); return (
            <Chip
              label={getInterventionPriorityLabel(intervention.priority, t)}
              size="small"
              sx={{ ...styles.priorityChip, backgroundColor: tk.bg, color: tk.color, borderRadius: '6px' }}
            />
          ); })()}
        </Box>

        {/* Droite : date planifiée (short + heure) */}
        <Box sx={styles.dateBox}>
          <Box component="span" sx={{ display: "inline-flex", color: "text.secondary" }}><Schedule size={13} strokeWidth={1.75} /></Box>
          <Typography variant="caption" sx={styles.dateText}>
            {formatShortDate(intervention.scheduledDate)}
            {formatTimeFromDate(intervention.scheduledDate) && ` · ${formatTimeFromDate(intervention.scheduledDate)}`}
          </Typography>
        </Box>
      </Box>

      {/* ─── Barre de progression (dans la même zone badges) ─── */}
      <Box sx={{ px: 1.5, py: 0.5, bgcolor: 'var(--surface-2)', borderBottom: '1px solid', borderColor: 'var(--line)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <LinearProgress
          variant="determinate"
          value={intervention.progressPercentage}
          color={getProgressColor(intervention.progressPercentage)}
          sx={{ ...styles.progressBar, flex: 1 }}
        />
        <Typography variant="caption" sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'text.secondary', flexShrink: 0 }}>
          {intervention.progressPercentage}%
        </Typography>
      </Box>

      {/* ─── Zone info ─── */}
      <CardContent sx={styles.infoContent}>
        {/* Titre */}
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={styles.titleText}
          title={intervention.title}
        >
          {intervention.title}
        </Typography>

        {/* Description */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={styles.descriptionText}
          title={intervention.description}
        >
          {intervention.description}
        </Typography>

        {/* Propriété */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Box component="span" sx={{ display: "inline-flex", color: "text.secondary", flexShrink: 0 }}><LocationOn size={14} strokeWidth={1.75} /></Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={styles.propertyText}
            title={`${intervention.propertyName} - ${intervention.propertyAddress}`}
          >
            {intervention.propertyName}
          </Typography>
        </Box>

        {/* Assignation · Demandeur · Durée — sur une seule ligne */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Assignation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, minWidth: 0 }}>
            {intervention.assignedToType === 'team' ? (
              <Box component="span" sx={{ display: "inline-flex", color: "text.disabled", flexShrink: 0 }}><GroupIcon size={12} strokeWidth={1.75} /></Box>
            ) : (
              <Box component="span" sx={{ display: "inline-flex", color: "text.disabled", flexShrink: 0 }}><PersonIcon size={12} strokeWidth={1.75} /></Box>
            )}
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {intervention.assignedToName || 'Non assigné'}
            </Typography>
          </Box>

          <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', lineHeight: 1 }}>·</Typography>

          {/* Demandeur */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, minWidth: 0 }}>
            <Box component="span" sx={{ display: "inline-flex", color: "text.disabled", flexShrink: 0 }}><PersonIcon size={12} strokeWidth={1.75} /></Box>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.62rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {intervention.requestorName}
            </Typography>
          </Box>

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Durée — chip style ServiceRequestCard */}
          <Chip
            icon={<AccessTime size={12} strokeWidth={1.75} />}
            label={`~${formatDuration(intervention.estimatedDurationHours)}`}
            size="small"
            sx={{ height: 22, fontSize: '0.62rem', fontWeight: 600, backgroundColor: 'var(--info-soft)', color: 'var(--info)', fontVariantNumeric: 'tabular-nums', '& .MuiChip-label': { px: 0.75 }, '& .MuiChip-icon': { fontSize: 12, ml: 0.5, color: 'var(--info)' }, flexShrink: 0 }}
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
            sx={{ fontSize: '0.72rem', py: 0.5 }}
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
