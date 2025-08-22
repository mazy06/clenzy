import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Visibility,
  MoreVert,
  LocationOn,
  CalendarToday,
  AccessTime,
  Group,
  Assignment,
  Pause,
  PlayArrow,
  CheckCircle,
  Cancel,
  Category,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { createSpacing } from '../theme/spacing';

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
  onStatusChange: (request: ServiceRequest) => void;
  canChangeStatus: boolean;
  typeIcons: { [key: string]: React.ReactElement };
  statuses: Array<{ value: string; label: string }>;
  priorities: Array<{ value: string; label: string }>;
  statusColors: { [key: string]: string };
  priorityColors: { [key: string]: string };
}

const ServiceRequestCard: React.FC<ServiceRequestCardProps> = ({
  request,
  onMenuOpen,
  onStatusChange,
  canChangeStatus,
  typeIcons,
  statuses,
  priorities,
  statusColors,
  priorityColors,
}) => {
  const navigate = useNavigate();

  // Formater la date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    } catch {
      return 'Date invalide';
    }
  };

  // Formater la durée estimée
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h${remainingMinutes}min`;
  };

  // Obtenir l'icône du bouton de statut
  const getStatusButtonIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Pause sx={{ fontSize: 16 }} />;
      case 'IN_PROGRESS':
        return <PlayArrow sx={{ fontSize: 16 }} />;
      case 'COMPLETED':
        return <CheckCircle sx={{ fontSize: 16 }} />;
      case 'CANCELLED':
        return <Cancel sx={{ fontSize: 16 }} />;
      default:
        return <MoreVert sx={{ fontSize: 16 }} />;
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1, ...createSpacing.card() }}>
        {/* En-tête avec titre et menu */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            {typeIcons[request.type as keyof typeof typeIcons] || <Category />}
            <Typography variant="h6" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
              {request.title}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => onMenuOpen(e, request)}
            sx={{ ml: 1 }}
          >
            <MoreVert />
          </IconButton>
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: '3em' }}>
          {request.description}
        </Typography>

        {/* Localisation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LocationOn sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {request.propertyName}
          </Typography>
        </Box>

        {/* Statut et priorité */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Chip
            label={statuses.find(s => s.value === request.status)?.label || request.status}
            color={statusColors[request.status as keyof typeof statusColors] as any}
            size="small"
            sx={{ textTransform: 'capitalize' }}
          />
          <Chip
            label={priorities.find(p => p.value === request.priority)?.label || request.priority}
            color={priorityColors[request.priority as keyof typeof priorityColors] as any}
            size="small"
            sx={{ textTransform: 'capitalize' }}
          />
        </Box>

        {/* Demandeur */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Demandé par {request.requestorName}
        </Typography>

        {/* Date de création */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Créé le {formatDate(request.createdAt)}
        </Typography>

        {/* Date d'échéance */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            Échéance: {formatDate(request.dueDate)}
          </Typography>
        </Box>

        {/* Durée estimée */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            Durée estimée: {formatDuration(request.estimatedDuration)}
          </Typography>
        </Box>

        {/* Assignation */}
        {request.assignedToName && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            {request.assignedToType === 'team' ? (
              <Group sx={{ fontSize: 16, color: 'text.secondary' }} />
            ) : (
              <Assignment sx={{ fontSize: 16, color: 'text.secondary' }} />
            )}
            <Typography variant="body2" color="text.secondary">
              Assigné à: {request.assignedToName}
              {request.assignedToType === 'team' && (
                <Chip 
                  label="Équipe" 
                  size="small" 
                  variant="outlined" 
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ pt: 0, ...createSpacing.card() }}>
        <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
          {/* Bouton principal */}
          <Button
            variant="outlined"
            startIcon={<Visibility />}
            onClick={() => navigate(`/service-requests/${request.id}`)}
            sx={{ flex: 1 }}
          >
            Voir détails
          </Button>
          
          {/* Bouton de changement de statut rapide - visible pour managers et admins */}
          {canChangeStatus && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => onStatusChange(request)}
              sx={{ minWidth: 'auto', px: 2 }}
              startIcon={getStatusButtonIcon(request.status)}
            >
              Statut
            </Button>
          )}
        </Box>
      </CardActions>
    </Card>
  );
};

export default ServiceRequestCard;
