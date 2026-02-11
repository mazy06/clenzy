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
  Category,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { createSpacing } from '../theme/spacing';

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


  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
        {/* En-tête avec titre et menu */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
            <Box sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }}>
              {typeIcons[request.type as keyof typeof typeIcons] || <Category />}
            </Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ wordBreak: 'break-word', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={request.title}>
              {request.title}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => onMenuOpen(e, request)}
            sx={{ ml: 0.5, flexShrink: 0, p: 0.5 }}
          >
            <MoreVert sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem' }} title={request.description}>
          {request.description}
        </Typography>

        {/* Localisation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <LocationOn sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={request.propertyName}>
            {request.propertyName}
          </Typography>
        </Box>

        {/* Statut et priorité */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
          <Chip
            label={statuses.find(s => s.value === request.status)?.label || request.status}
            color={(statusColors[request.status as keyof typeof statusColors] as ChipColor) || 'default'}
            size="small"
            sx={{ textTransform: 'capitalize', height: 20, fontSize: '0.7rem' }}
          />
          <Chip
            label={priorities.find(p => p.value === request.priority)?.label || request.priority}
            color={(priorityColors[request.priority as keyof typeof priorityColors] as ChipColor) || 'default'}
            size="small"
            sx={{ textTransform: 'capitalize', height: 20, fontSize: '0.7rem' }}
          />
        </Box>

        {/* Demandeur et date de création */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, fontSize: '0.7rem' }}>
          Demandé par {request.requestorName} Créé le {formatDate(request.createdAt)}
        </Typography>

        {/* Date d'échéance */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <CalendarToday sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            Échéance: {formatDate(request.dueDate)}
          </Typography>
        </Box>

        {/* Durée estimée */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <AccessTime sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            Durée: {formatDuration(request.estimatedDuration * 60)}
          </Typography>
        </Box>

        {/* Assignation */}
        {request.assignedToName && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            {request.assignedToType === 'team' ? (
              <Group sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
            ) : (
              <Assignment sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
            )}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={request.assignedToName}>
              Assigné à: {request.assignedToName}
            </Typography>
            {request.assignedToType === 'team' && (
              <Chip 
                label="Équipe" 
                size="small" 
                variant="outlined" 
                sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }}
              />
            )}
          </Box>
        )}
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ pt: 0, p: 1 }}>
        <Button
          variant="outlined"
          startIcon={<Visibility sx={{ fontSize: 16 }} />}
          onClick={() => navigate(`/service-requests/${request.id}`)}
          fullWidth
          size="small"
        >
          Voir détails
        </Button>
      </CardActions>
    </Card>
  );
};

export default ServiceRequestCard;
