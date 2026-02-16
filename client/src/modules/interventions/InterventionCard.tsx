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
  TrendingUp,
  Category,
  Warning,
  Bolt,
  Yard,
  BugReport,
  AutoFixHigh,
  FiberManualRecord,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import LiveDashboardPulse from './LiveDashboardPulse';

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

// Icône de type en arrière-plan
const getTypeIcon = (type: string, size: number = 48) => {
  const iconProps = { sx: { fontSize: size, color: 'rgba(255,255,255,0.18)' } };
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
  const iconProps = { sx: { fontSize: 16, color: 'rgba(255,255,255,0.85)' } };
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
      {/* ─── Zone visuelle : Bandeau Live Dashboard Pulse ─── */}
      <LiveDashboardPulse
        type={intervention.type}
        priority={intervention.priority}
        status={intervention.status}
        height={110}
      >
        {/* Type en haut à gauche — label glassmorphism */}
        <Box
          sx={{
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
              fontSize: '0.68rem',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            {getTypeLabel(intervention.type)}
          </Typography>
        </Box>

        {/* Menu contextuel — coin supérieur droit */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onMenuOpen(e, intervention); }}
          sx={{
            position: 'absolute',
            top: 10,
            right: 12,
            color: 'rgba(255,255,255,0.6)',
            bgcolor: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' },
            width: 28,
            height: 28,
          }}
        >
          <MoreVert sx={{ fontSize: 16 }} />
        </IconButton>
      </LiveDashboardPulse>

      {/* ─── Barre de badges (entre bandeau et contenu) ─── */}
      <Box
        sx={{
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
        }}
      >
        {/* Gauche : statut + priorité */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Chip
            label={getStatusLabel(intervention.status)}
            color={getStatusColor(intervention.status)}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.62rem',
              fontWeight: 600,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          <Chip
            label={getPriorityLabel(intervention.priority)}
            color={getPriorityColor(intervention.priority)}
            size="small"
            variant="outlined"
            sx={{
              height: 22,
              fontSize: '0.62rem',
              fontWeight: 600,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>

        {/* Droite : date planifiée */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.4,
            flexShrink: 0,
          }}
        >
          <Schedule sx={{ fontSize: 13, color: 'text.secondary' }} />
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontWeight: 600,
              fontSize: '0.68rem',
              lineHeight: 1,
            }}
          >
            {formatDate(intervention.scheduledDate)}
          </Typography>
        </Box>
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
