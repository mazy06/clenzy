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

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

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

const getTypeLabel = (type: string): string => {
  switch (type) {
    case 'CLEANING': return 'Nettoyage';
    case 'EXPRESS_CLEANING': return 'Express';
    case 'DEEP_CLEANING': return 'Nettoyage Profond';
    case 'WINDOW_CLEANING': return 'Vitres';
    case 'FLOOR_CLEANING': return 'Sols';
    case 'KITCHEN_CLEANING': return 'Cuisine';
    case 'BATHROOM_CLEANING': return 'Sanitaires';
    case 'PREVENTIVE_MAINTENANCE': return 'Maintenance';
    case 'EMERGENCY_REPAIR': return 'Urgence';
    case 'ELECTRICAL_REPAIR': return 'Électricité';
    case 'PLUMBING_REPAIR': return 'Plomberie';
    case 'HVAC_REPAIR': return 'Climatisation';
    case 'APPLIANCE_REPAIR': return 'Électroménager';
    case 'GARDENING': return 'Jardinage';
    case 'EXTERIOR_CLEANING': return 'Extérieur';
    case 'PEST_CONTROL': return 'Désinsectisation';
    case 'DISINFECTION': return 'Désinfection';
    case 'RESTORATION': return 'Remise en état';
    case 'OTHER': return 'Autre';
    default: return type;
  }
};

// Formater la date
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return 'Date invalide';
  }
};

// Formater la durée estimée
const formatDuration = (hours: number): string => {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  }
  if (hours === 1) return '1h';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
};

const ServiceRequestCard: React.FC<ServiceRequestCardProps> = ({
  request,
  onMenuOpen,
  typeIcons,
  statuses,
  priorities,
  statusColors,
  priorityColors,
}) => {
  const navigate = useNavigate();

  const statusLabel = statuses.find(s => s.value === request.status)?.label || request.status;
  const priorityLabel = priorities.find(p => p.value === request.priority)?.label || request.priority;
  const statusChipColor = (statusColors[request.status] as ChipColor) || 'default';
  const priorityChipColor = (priorityColors[request.priority] as ChipColor) || 'default';

  const handleViewDetails = () => {
    navigate(`/service-requests/${request.id}`);
  };

  return (
    <Card
      sx={{
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
      }}
      onClick={handleViewDetails}
    >
      {/* ─── Zone visuelle : Bandeau image + gradient ─── */}
      <Box
        sx={{
          position: 'relative',
          background: getTypeGradient(request.type),
          backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.35)), url(${getServiceTypeBannerUrl(request.type)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          height: 110,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Icône type en arrière-plan décoratif */}
        <Box
          sx={{
            position: 'absolute',
            right: -10,
            bottom: -10,
            opacity: 0.8,
          }}
        >
          {getTypeIcon(request.type, 80)}
        </Box>

        {/* Type en haut à gauche */}
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {getTypeSmallIcon(request.type)}
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255,255,255,0.9)',
              fontWeight: 600,
              fontSize: '0.7rem',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            {getTypeLabel(request.type)}
          </Typography>
        </Box>

        {/* Badge statut — coin supérieur droit */}
        <Chip
          label={statusLabel}
          color={statusChipColor}
          size="small"
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            height: 22,
            fontSize: '0.65rem',
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}
        />

        {/* Date d'échéance — coin inférieur gauche */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 10,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(4px)',
            borderRadius: 1.5,
            px: 1.25,
            py: 0.5,
          }}
        >
          <CalendarToday sx={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }} />
          <Typography
            variant="caption"
            sx={{
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.75rem',
              lineHeight: 1,
            }}
          >
            {formatDate(request.dueDate)}
          </Typography>
        </Box>

        {/* Badge priorité — coin inférieur droit */}
        <Chip
          label={priorityLabel}
          color={priorityChipColor}
          size="small"
          variant="filled"
          sx={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            height: 20,
            fontSize: '0.6rem',
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}
        />

        {/* Menu contextuel */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, request); }}
          sx={{
            position: 'absolute',
            top: 8,
            right: 70,
            color: 'rgba(255,255,255,0.7)',
            bgcolor: 'rgba(0,0,0,0.15)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.3)', color: '#fff' },
            width: 28,
            height: 28,
          }}
        >
          <MoreVert sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* ─── Zone info ─── */}
      <CardContent sx={{ flexGrow: 1, p: 1.75, pb: '8px !important' }}>
        {/* Titre */}
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.95rem',
            mb: 0.25,
            color: 'text.primary',
          }}
          title={request.title}
        >
          {request.title}
        </Typography>

        {/* Description */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            fontSize: '0.7rem',
            mb: 1,
          }}
          title={request.description}
        >
          {request.description}
        </Typography>

        {/* Propriété */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <LocationOn sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              fontSize: '0.7rem',
            }}
            title={request.propertyName}
          >
            {request.propertyName}
          </Typography>
        </Box>

        {/* Métriques — ligne horizontale compacte */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            mb: 1.25,
            flexWrap: 'wrap',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.4,
              bgcolor: 'grey.100',
              borderRadius: 1,
              px: 0.75,
              py: 0.35,
            }}
          >
            <AccessTime sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.72rem', color: 'text.primary' }}>
              {formatDuration(request.estimatedDuration)}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.4,
              bgcolor: 'grey.100',
              borderRadius: 1,
              px: 0.75,
              py: 0.35,
            }}
          >
            <Schedule sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.72rem', color: 'text.primary' }}>
              {formatDate(request.createdAt)}
            </Typography>
          </Box>
        </Box>

        {/* Assignation */}
        {request.assignedToName && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            {request.assignedToType === 'team' ? (
              <GroupIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
            ) : (
              <PersonIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
            )}
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
              {request.assignedToName}
              {request.assignedToType === 'team' && (
                <Box component="span" sx={{ ml: 0.5, color: 'info.main', fontSize: '0.6rem' }}>
                  (Équipe)
                </Box>
              )}
            </Typography>
          </Box>
        )}

        {/* Demandeur */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PersonIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
            {request.requestorName}
          </Typography>
        </Box>
      </CardContent>

      {/* ─── Zone actions ─── */}
      <Box sx={{ px: 1.75, pb: 1.25, pt: 0, display: 'flex', gap: 0.75 }}>
        <Button
          fullWidth
          size="small"
          startIcon={<Visibility sx={{ fontSize: 15 }} />}
          onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
          variant="outlined"
          sx={{
            fontSize: '0.72rem',
            py: 0.5,
            borderColor: 'grey.300',
            color: 'text.secondary',
            '&:hover': {
              borderColor: 'primary.main',
              color: 'primary.main',
              bgcolor: 'rgba(107, 138, 154, 0.04)',
            },
          }}
        >
          Détails
        </Button>
      </Box>
    </Card>
  );
};

export default ServiceRequestCard;
