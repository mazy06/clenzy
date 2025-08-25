import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Divider,
} from '@mui/material';
import {
  MoreVert,
  Build,
  Support,
} from '@mui/icons-material';
import { InterventionType, INTERVENTION_TYPE_OPTIONS } from '../types/interventionTypes';
import { createSpacing } from '../theme/spacing';

interface TeamMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
  memberCount: number;
  members: TeamMember[];
  status?: 'active' | 'inactive' | 'maintenance';
  createdAt?: string;
  lastIntervention?: string;
  totalInterventions?: number;
}

interface TeamCardProps {
  team: Team;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, team: Team) => void;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, onMenuOpen }) => {
  // Debug: vérifier les données des membres


  // Données pour l'affichage (avec fallback si pas de données)
  const displayData = {
    status: team.status || 'active',
    totalInterventions: team.totalInterventions !== undefined ? team.totalInterventions : 0,
    lastIntervention: team.lastIntervention || null
  };

  // Obtenir l'icône selon le type d'intervention
  const getInterventionTypeIcon = (type: string) => {
    const interventionType = INTERVENTION_TYPE_OPTIONS.find(t => t.value === type);
    if (!interventionType) return <Support />;
    
    switch (interventionType.category) {
      case 'cleaning':
        return <Support />; // Utilise Support comme fallback pour l'instant
      case 'maintenance':
        return <Build />;
      case 'specialized':
        return <Build />; // Utilise Build comme fallback pour l'instant
      case 'other':
        return <Support />;
      default:
        return <Support />;
    }
  };

  // Obtenir le statut de l'équipe
  const getTeamStatus = (team: Team) => {
    if (team.status) return team.status;
    // Statut par défaut basé sur l'activité
    if (team.lastIntervention) {
      const lastInterventionDate = new Date(team.lastIntervention);
      const daysSinceLastIntervention = Math.floor((Date.now() - lastInterventionDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastIntervention > 30) return 'inactive';
      if (daysSinceLastIntervention > 7) return 'maintenance';
      return 'active';
    }
    return 'active';
  };

  // Obtenir la couleur du statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'error';
      case 'maintenance': return 'warning';
      default: return 'default';
    }
  };

  // Obtenir le label du statut
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'maintenance': return 'Maintenance';
      default: return 'Inconnu';
    }
  };

  // Formater la date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Jamais';
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

  // Obtenir le label du rôle
  const getRoleLabel = (role: string) => {
    const roleLabels: { [key: string]: string } = {
      'housekeeper': 'Agent de ménage',
      'technician': 'Technicien',
      'supervisor': 'Superviseur',
      'manager': 'Manager',
    };
    return roleLabels[role] || role;
  };

  // Obtenir la couleur du rôle
  const getRoleColor = (role: string) => {
    const roleColors: { [key: string]: string } = {
      'housekeeper': 'success',
      'technician': 'primary',
      'supervisor': 'warning',
      'manager': 'error',
    };
    return roleColors[role] || 'default';
  };

  return (
          <Card sx={{ height: '380px', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', pb: 1.5 }}>
        {/* En-tête de la carte avec icône */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ 
                color: 'primary.main', 
                display: 'flex', 
                alignItems: 'center',
                flexShrink: 0
              }}>
                {getInterventionTypeIcon(team.interventionType)}
              </Box>
              <Typography 
                variant="h6" 
                component="h3" 
                sx={{ 
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexGrow: 1
                }}
              >
                {team.name}
              </Typography>
            </Box>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mb: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.4
              }}
            >
              {team.description || 'Aucune description'}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => onMenuOpen(e, team)}
            sx={{ ml: 1, flexShrink: 0 }}
          >
            <MoreVert />
          </IconButton>
        </Box>

        {/* Type d'intervention et statut */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={INTERVENTION_TYPE_OPTIONS.find(t => t.value === team.interventionType)?.label || team.interventionType}
            size="small"
            sx={{
              fontSize: '0.75rem',
              height: '20px'
            }}
          />
          <Chip
            label={getStatusLabel(getTeamStatus(team))}
            size="small"
            color={getStatusColor(getTeamStatus(team)) as any}
            variant="outlined"
            sx={{
              fontSize: '0.75rem',
              height: '20px'
            }}
          />
        </Box>

        {/* Informations supplémentaires */}
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/* Nombre total d'interventions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Build fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              {displayData.totalInterventions === 0 
                ? 'Aucune intervention' 
                : `${displayData.totalInterventions} intervention${displayData.totalInterventions > 1 ? 's' : ''}`
              }
            </Typography>
          </Box>
          
          {/* Dernière intervention */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Support fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              {displayData.lastIntervention 
                ? `Dernière: ${formatDate(displayData.lastIntervention)}`
                : 'Aucune intervention récente'
              }
            </Typography>
          </Box>
        </Box>

        {/* Membres de l'équipe */}
                       <List dense sx={{ 
                 mb: 1, 
                 flexGrow: 1, 
                 overflow: 'hidden',
                 maxHeight: '160px'
               }}>
          {team.members.slice(0, 2).map((member, index) => (
            <React.Fragment key={member.id}>
              <ListItem sx={{ px: 0, py: 0.5 }}>
                <ListItemAvatar sx={{ minWidth: 32 }}>
                  <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                    {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={`${member.firstName} ${member.lastName}`}
                  secondary={member.email}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
                <Chip
                  label={getRoleLabel(member.role)}
                  size="small"
                  color={getRoleColor(member.role) as any}
                  variant="outlined"
                />
              </ListItem>
              {index < Math.min(team.members.length, 2) - 1 && <Divider variant="inset" component="li" />}
            </React.Fragment>
          ))}
          {team.members.length > 2 && (
            <ListItem sx={{ px: 0, py: 0.5 }}>
              <ListItemText
                primary={`... et ${team.members.length - 2} autre(s) membre(s)`}
                primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
              />
            </ListItem>
          )}
        </List>
        
        {/* Compteur total des membres - simple et centré */}
        <Box sx={{ 
          textAlign: 'center', 
          flexShrink: 0,
          py: 0.5
        }}>
          <Typography variant="caption" color="text.secondary">
            Total: {team.members.length} membre{team.members.length > 1 ? 's' : ''}
          </Typography>
        </Box>
      </CardContent>

    </Card>
  );
};

export default TeamCard;
