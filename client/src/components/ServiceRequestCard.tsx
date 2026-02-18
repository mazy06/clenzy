import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  Visibility,
  MoreVert,
  LocationOn,
  CalendarToday,
  Timer,
  Person as PersonIcon,
  Group as GroupIcon,
  AutoAwesome,
  Build,
  Category,
  Yard,
  BugReport,
  AutoFixHigh,
  Edit,
  Payments,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getServiceTypeBannerUrl } from '../utils/serviceTypeBanner';
import { useTranslation } from '../hooks/useTranslation';
import ThemedTooltip from './ThemedTooltip';
import { formatShortDate, formatTimeFromDate, formatDuration } from '../utils/formatUtils';
// ─── Source logos ─────────────────────────────────────────────────────────────
import airbnbLogoSmall from '../assets/logo/airbnb-logo-small.png';
import bookingLogoSmall from '../assets/logo/booking-logo-small.svg';
import homeAwayLogo from '../assets/logo/HomeAway-logo.png';
import expediaLogo from '../assets/logo/expedia-logo.png';
import leboncoinLogo from '../assets/logo/Leboncoin-logo.png';
import clenzyLogo from '../assets/logo/clenzy-logo.png';

const ICAL_SOURCE_LOGOS: Record<string, string> = {
  airbnb: airbnbLogoSmall,
  'booking.com': bookingLogoSmall,
  booking: bookingLogoSmall,
  vrbo: homeAwayLogo,
  homeaway: homeAwayLogo,
  expedia: expediaLogo,
  leboncoin: leboncoinLogo,
  direct: clenzyLogo,
};

/** Detect iCal source logo from description like "Import iCal Airbnb — Guest: ..." */
function getICalSourceLogo(description: string): string | null {
  if (!description) return null;
  const match = description.match(/^Import iCal\s+(\S+)/i);
  if (!match) return null;
  const sourceKey = match[1].toLowerCase().replace(/[.,;:]$/, '');
  return ICAL_SOURCE_LOGOS[sourceKey] || null;
}

import {
  getServiceRequestStatusColor,
  getServiceRequestStatusLabel,
  getServiceRequestPriorityColor,
  getServiceRequestPriorityLabel,
  getInterventionTypeLabel,
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

// Icône de type en arrière-plan
const getTypeIcon = (type: string, size: number = 48) => {
  const iconProps = { sx: { fontSize: size, color: 'rgba(255,255,255,0.35)' } };
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
  const iconProps = { sx: { fontSize: 18, color: 'rgba(255,255,255,0.9)' } };
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

const styles = {
  cardRoot: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 12px 28px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.08)',
    },
  },
  bannerBox: {
    position: 'relative',
    height: 110,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  menuButton: {
    position: 'absolute',
    top: 8,
    right: 10,
    color: 'rgba(255,255,255,0.7)',
    bgcolor: 'rgba(0,0,0,0.15)',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.3)', color: '#fff' },
    width: 28,
    height: 28,
  },
  badgeBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    px: 1.5,
    py: 0.75,
    bgcolor: 'grey.50',
    borderBottom: '1px solid',
    borderColor: 'grey.100',
    gap: 0.75,
    minHeight: 34,
  },
  badgeBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    flexShrink: 0,
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
  propertyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    mb: 1,
  },
  propertyText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    fontSize: '0.7rem',
  },
  bottomRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 1,
    mb: 0.5,
  },
  metricsRow: {
    display: 'flex',
    gap: 0.75,
    flexShrink: 0,
    alignItems: 'center',
  },
  metricChip: {
    height: 22,
    fontSize: '0.62rem',
    fontWeight: 600,
    borderWidth: 1.5,
    '& .MuiChip-label': { px: 0.75 },
    '& .MuiChip-icon': { fontSize: 12, ml: 0.5 },
  },
  peopleCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    minWidth: 0,
    flexShrink: 1,
  },
  personRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    minWidth: 0,
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
    borderColor: 'grey.300',
    color: 'text.secondary',
    '&:hover': {
      borderColor: 'primary.main',
      color: 'primary.main',
      bgcolor: 'rgba(107, 138, 154, 0.04)',
    },
  },
  locationIcon: {
    fontSize: 14,
    color: 'text.secondary',
    flexShrink: 0,
  },
  teamBadge: {
    ml: 0.5,
    color: 'info.main',
    fontSize: '0.6rem',
  },
} as const;

const ServiceRequestCard: React.FC<ServiceRequestCardProps> = React.memo(({
  request,
  onMenuOpen,
  typeIcons,
  statuses,
  priorities,
  statusColors,
  priorityColors,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const statusLabel = statuses.find(s => s.value === request.status)?.label || request.status;
  const priorityLabel = priorities.find(p => p.value === request.priority)?.label || request.priority;
  const statusChipColor = getServiceRequestStatusColor(request.status);
  const priorityChipColor = getServiceRequestPriorityColor(request.priority);

  const handleViewDetails = () => {
    navigate(`/service-requests/${request.id}`);
  };

  return (
    <Card
      sx={styles.cardRoot}
      onClick={handleViewDetails}
    >
      {/* ─── Zone visuelle : Bandeau image + gradient ─── */}
      <Box
        sx={{
          ...styles.bannerBox,
          background: getTypeGradient(request.type),
          backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.35)), url(${getServiceTypeBannerUrl(request.type)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Menu contextuel */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, request); }}
          sx={styles.menuButton}
        >
          <MoreVert sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* ─── Barre de badges (entre bandeau et contenu) ─── */}
      <Box
        sx={styles.badgeBar}
      >
        {/* Gauche : statut + priorité */}
        <Box sx={styles.badgeBarLeft}>
          <Chip
            label={statusLabel}
            color={statusChipColor}
            size="small"
            variant="outlined"
            sx={styles.statusChip}
          />
          <Chip
            label={priorityLabel}
            color={priorityChipColor}
            size="small"
            variant="outlined"
            sx={styles.priorityChip}
          />
        </Box>

        {/* Droite : type + date d'échéance */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Chip
            label={getInterventionTypeLabel(request.type, t)}
            size="small"
            color="info"
            variant="outlined"
            sx={{ height: 22, fontSize: '0.62rem', fontWeight: 600, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
          />
          <Box sx={styles.dateBox}>
            <CalendarToday sx={{ fontSize: 13, color: 'text.secondary' }} />
            <Typography variant="caption" sx={styles.dateText}>
              {formatShortDate(request.dueDate)}
              {formatTimeFromDate(request.dueDate) && ` · ${formatTimeFromDate(request.dueDate)}`}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ─── Zone info ─── */}
      <CardContent sx={styles.infoContent}>
        {/* Titre */}
        <ThemedTooltip title={request.title} arrow placement="top" disableHoverListener={request.title.length < 35}>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={styles.titleText}
          >
            {request.title}
          </Typography>
        </ThemedTooltip>

        {/* Description (with iCal source logo if applicable) */}
        <ThemedTooltip title={request.description} arrow placement="top" disableHoverListener={request.description.length < 60}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, minWidth: 0 }}>
            {(() => {
              const logo = getICalSourceLogo(request.description);
              return logo ? (
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    minWidth: 18,
                    borderRadius: '50%',
                    border: '1.5px solid',
                    borderColor: 'divider',
                    backgroundColor: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <img src={logo} alt="" width={12} height={12} style={{ objectFit: 'contain', borderRadius: '50%' }} />
                </Box>
              ) : null;
            })()}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ...styles.descriptionText, mb: 0, flex: 1 }}
            >
              {request.description}
            </Typography>
          </Box>
        </ThemedTooltip>

        {/* Propriété */}
        <Box sx={styles.propertyRow}>
          <LocationOn sx={styles.locationIcon} />
          <ThemedTooltip title={`${request.propertyName} — ${request.propertyAddress}, ${request.propertyCity}`} arrow placement="top">
            <Typography
              variant="caption"
              color="text.secondary"
              sx={styles.propertyText}
            >
              {request.propertyName}
            </Typography>
          </ThemedTooltip>
        </Box>

        {/* Personnes + Métriques — deux colonnes sur une ligne */}
        <Box sx={styles.bottomRow}>
          {/* Colonne gauche : demandeur / assigné */}
          <Box sx={styles.peopleCol}>
            {request.assignedToName ? (
              <Box sx={styles.personRow}>
                {request.assignedToType === 'team' ? (
                  <GroupIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                ) : (
                  <PersonIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                )}
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {request.assignedToName}
                  {request.assignedToType === 'team' && (
                    <Box component="span" sx={styles.teamBadge}>(Équipe)</Box>
                  )}
                </Typography>
              </Box>
            ) : (
              <Box sx={styles.personRow}>
                <PersonIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {request.requestorName}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Colonne droite : chips métriques */}
          <Box sx={styles.metricsRow}>
            {request.estimatedCost != null && request.estimatedCost > 0 && (
              <Chip
                icon={<Payments sx={{ fontSize: 12 }} />}
                label={`${request.estimatedCost}€ estimé / intervention`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ ...styles.metricChip, cursor: 'default' }}
              />
            )}
            <Chip
              icon={<Timer sx={{ fontSize: 12 }} />}
              label={`~${formatDuration(request.estimatedDuration)}`}
              size="small"
              color="info"
              variant="outlined"
              sx={{ ...styles.metricChip, '& .MuiChip-icon': { fontSize: 12, ml: 0.5 }, cursor: 'default' }}
            />
          </Box>
        </Box>
      </CardContent>

      {/* ─── Zone actions ─── */}
      <Box sx={styles.actionBar}>
        <Button
          fullWidth
          size="small"
          startIcon={<Visibility sx={{ fontSize: 15 }} />}
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
