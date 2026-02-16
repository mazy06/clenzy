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
  AccessTime,
  Person as PersonIcon,
  Group as GroupIcon,
  CleaningServices,
  Build,
  Category,
  Schedule,
  Yard,
  BugReport,
  AutoFixHigh,
  Edit,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getServiceTypeBannerUrl } from '../utils/serviceTypeBanner';
import { useTranslation } from '../hooks/useTranslation';
import { formatDate, formatDuration } from '../utils/formatUtils';
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

  if (cleaningTypes.includes(type)) return <CleaningServices {...iconProps} />;
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

  if (cleaningTypes.includes(type)) return <CleaningServices {...iconProps} />;
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
    '& .MuiChip-label': { px: 0.75 },
  },
  priorityChip: {
    height: 22,
    fontSize: '0.62rem',
    fontWeight: 600,
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
  metricsRow: {
    display: 'flex',
    gap: 0.75,
    mb: 1.25,
    flexWrap: 'wrap',
  },
  metricBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.4,
    bgcolor: 'grey.100',
    borderRadius: 1,
    px: 0.75,
    py: 0.35,
  },
  assignRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
    mb: 0.5,
  },
  requestorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
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

        {/* Droite : date d'échéance */}
        <Box
          sx={styles.dateBox}
        >
          <Schedule sx={{ fontSize: 13, color: 'text.secondary' }} />
          <Typography
            variant="caption"
            sx={styles.dateText}
          >
            {formatDate(request.dueDate)}
          </Typography>
        </Box>
      </Box>

      {/* ─── Zone info ─── */}
      <CardContent sx={styles.infoContent}>
        {/* Titre */}
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={styles.titleText}
          title={request.title}
        >
          {request.title}
        </Typography>

        {/* Description */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={styles.descriptionText}
          title={request.description}
        >
          {request.description}
        </Typography>

        {/* Propriété */}
        <Box sx={styles.propertyRow}>
          <LocationOn sx={styles.locationIcon} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={styles.propertyText}
            title={request.propertyName}
          >
            {request.propertyName}
          </Typography>
        </Box>

        {/* Métriques — ligne horizontale compacte */}
        <Box
          sx={styles.metricsRow}
        >
          <Box
            sx={styles.metricBox}
          >
            <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.72rem', color: 'text.primary' }}>
              {formatDuration(request.estimatedDuration)}
            </Typography>
          </Box>
          <Box
            sx={styles.metricBox}
          >
            <Schedule sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.72rem', color: 'text.primary' }}>
              {formatDate(request.createdAt)}
            </Typography>
          </Box>
        </Box>

        {/* Assignation */}
        {request.assignedToName && (
          <Box sx={styles.assignRow}>
            {request.assignedToType === 'team' ? (
              <GroupIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
            ) : (
              <PersonIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
            )}
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
              {request.assignedToName}
              {request.assignedToType === 'team' && (
                <Box component="span" sx={styles.teamBadge}>
                  (Équipe)
                </Box>
              )}
            </Typography>
          </Box>
        )}

        {/* Demandeur */}
        <Box sx={styles.requestorRow}>
          <PersonIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
            {request.requestorName}
          </Typography>
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
