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
  CleaningServices,
  Build,
  Schedule,
  AccessTime,
  Person as PersonIcon,
  Group as GroupIcon,
  MoreVert,
  TrendingUp,
  Category,
  Warning,
  Bolt,
  Yard,
  BugReport,
  AutoFixHigh,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getPropertyTypeBannerUrl } from '../../utils/propertyTypeBanner';

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

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
  t: (key: string) => string;
}

// Gradient par catégorie de type d'intervention
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
    return 'linear-gradient(135deg, #5B9BD5 0%, #7CB4E2 100%)';
  }
  if (repairTypes.includes(type)) {
    return 'linear-gradient(135deg, #C0504D 0%, #D4726F 100%)';
  }
  if (maintenanceTypes.includes(type)) {
    return 'linear-gradient(135deg, #E8A838 0%, #F0C060 100%)';
  }
  if (outdoorTypes.includes(type)) {
    return 'linear-gradient(135deg, #4A9B8E 0%, #6BB5A8 100%)';
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
    case 'EXPRESS_CLEANING': return 'Nettoyage Express';
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

const getStatusColor = (status: string): ChipColor => {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'AWAITING_VALIDATION': return 'warning';
    case 'AWAITING_PAYMENT': return 'warning';
    case 'SCHEDULED': return 'info';
    case 'IN_PROGRESS': return 'primary';
    case 'ON_HOLD': return 'warning';
    case 'COMPLETED': return 'success';
    case 'CANCELLED': return 'error';
    default: return 'default';
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'PENDING': return 'En attente';
    case 'AWAITING_VALIDATION': return 'Validation';
    case 'AWAITING_PAYMENT': return 'Paiement';
    case 'SCHEDULED': return 'Planifié';
    case 'IN_PROGRESS': return 'En cours';
    case 'ON_HOLD': return 'Suspendu';
    case 'COMPLETED': return 'Terminé';
    case 'CANCELLED': return 'Annulé';
    default: return status;
  }
};

const getPriorityColor = (priority: string): ChipColor => {
  switch (priority) {
    case 'LOW': return 'success';
    case 'NORMAL': return 'info';
    case 'HIGH': return 'warning';
    case 'URGENT': return 'error';
    case 'CRITICAL': return 'error';
    default: return 'default';
  }
};

const getPriorityLabel = (priority: string): string => {
  switch (priority) {
    case 'LOW': return 'Basse';
    case 'NORMAL': return 'Normale';
    case 'HIGH': return 'Haute';
    case 'URGENT': return 'Urgente';
    case 'CRITICAL': return 'Critique';
    default: return priority;
  }
};

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

const formatDuration = (hours: number): string => {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours === 1) return '1h';
  return `${hours}h`;
};

const InterventionCard: React.FC<InterventionCardProps> = ({
  intervention,
  onMenuOpen,
  canEdit = false,
  t,
}) => {
  const navigate = useNavigate();
  const propertyBannerUrl = intervention.propertyType ? getPropertyTypeBannerUrl(intervention.propertyType) : null;

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
      {/* ─── Zone visuelle : Bandeau gradient ─── */}
      <Box
        sx={{
          position: 'relative',
          background: propertyBannerUrl ? 'transparent' : getTypeGradient(intervention.type),
          ...(propertyBannerUrl
            ? {
                backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.40)), url(${propertyBannerUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : null),
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
          {getTypeIcon(intervention.type, 80)}
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
            {getTypeSmallIcon(intervention.type)}
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
            {getTypeLabel(intervention.type)}
          </Typography>
        </Box>

        {/* Badge statut — coin supérieur droit */}
        <Chip
          label={getStatusLabel(intervention.status)}
          color={getStatusColor(intervention.status)}
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

        {/* Date planifiée — coin inférieur gauche */}
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
          <Schedule sx={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }} />
          <Typography
            variant="caption"
            sx={{
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.75rem',
              lineHeight: 1,
            }}
          >
            {formatDate(intervention.scheduledDate)}
          </Typography>
        </Box>

        {/* Badge priorité — coin inférieur droit */}
        <Chip
          label={getPriorityLabel(intervention.priority)}
          color={getPriorityColor(intervention.priority)}
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
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, intervention); }}
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
          title={intervention.title}
        >
          {intervention.title}
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
          title={intervention.description}
        >
          {intervention.description}
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
            title={`${intervention.propertyName} - ${intervention.propertyAddress}`}
          >
            {intervention.propertyName}
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
          {[
            { icon: <AccessTime sx={{ fontSize: 14 }} />, value: formatDuration(intervention.estimatedDurationHours), label: '' },
            { icon: <TrendingUp sx={{ fontSize: 14 }} />, value: `${intervention.progressPercentage}%`, label: '' },
          ].map((metric, idx) => (
            <Box
              key={idx}
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
              <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                {metric.icon}
              </Box>
              <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.72rem', color: 'text.primary' }}>
                {metric.value}
              </Typography>
              {metric.label && (
                <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
                  {metric.label}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* Barre de progression */}
        <Box sx={{ mb: 1.25 }}>
          <LinearProgress
            variant="determinate"
            value={intervention.progressPercentage}
            color={getProgressColor(intervention.progressPercentage)}
            sx={{
              height: 5,
              borderRadius: 3,
              bgcolor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
              },
            }}
          />
        </Box>

        {/* Assignation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          {intervention.assignedToType === 'team' ? (
            <GroupIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
          ) : (
            <PersonIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
          )}
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
            {intervention.assignedToName || 'Non assigné'}
            {intervention.assignedToType === 'team' && (
              <Box component="span" sx={{ ml: 0.5, color: 'info.main', fontSize: '0.6rem' }}>
                (Équipe)
              </Box>
            )}
          </Typography>
        </Box>

        {/* Demandeur */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <PersonIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
            {intervention.requestorName}
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
        {canEdit && (
          <Button
            fullWidth
            size="small"
            startIcon={<Edit sx={{ fontSize: 15 }} />}
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
};

export default InterventionCard;
