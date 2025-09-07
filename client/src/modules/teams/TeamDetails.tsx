import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Group,
  Person,
  Edit,
  ArrowBack,
  LocationOn,
  Build,
  CleaningServices,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import PageHeader from '../../components/PageHeader';

interface TeamMember {
  userId: number;
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
  createdAt?: string;
  updatedAt?: string;
}

const TeamDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<Team | null>(null);

  // Charger les données de l'équipe
  useEffect(() => {
    const loadTeam = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/teams/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const teamData = await response.json();
          console.log('🔍 TeamDetails - Équipe chargée:', teamData);
          setTeam(teamData);
        } else {
          setError('Erreur lors du chargement de l\'équipe');
        }
      } catch (err) {
        console.error('🔍 TeamDetails - Erreur chargement équipe:', err);
        setError('Erreur lors du chargement de l\'équipe');
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [id]);

  // Gestion du changement d'onglet
  const handleEdit = () => {
    navigate(`/teams/${id}/edit`);
  };

  // Fonctions utilitaires
  const getInterventionTypeIcon = (type: string) => {
    switch (type) {
      case 'CLEANING':
        return <CleaningServices />;
      case 'MAINTENANCE':
        return <Build />;
      case 'REPAIR':
        return <Build />;
      default:
        return <Group />;
    }
  };

  const getInterventionTypeLabel = (type: string) => {
    switch (type) {
      case 'CLEANING':
        return 'Nettoyage';
      case 'MAINTENANCE':
        return 'Maintenance';
      case 'REPAIR':
        return 'Réparation';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error}
        </Alert>
      </Box>
    );
  }

  if (!team) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          Équipe non trouvée
        </Alert>
      </Box>
    );
  }

  // Vérifier les permissions pour l'édition
  const [canEdit, setCanEdit] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('teams:edit');
      setCanEdit(canEditPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);;

  return (
    <Box sx={{ p: 3 }}>
      {/* PageHeader avec titre, sous-titre, bouton retour et bouton modifier */}
      <PageHeader
        title={team.name}
        subtitle="Détails de l'équipe et de ses membres"
        backPath="/teams"
        backLabel="Retour aux équipes"
        showBackButton={true}
        actions={
          canEdit && (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={handleEdit}
            >
              Modifier
            </Button>
          )
        }
      />

      {/* Carte principale avec résumé */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          {/* En-tête de l'équipe */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {getInterventionTypeIcon(team.interventionType)}
              <Typography variant="h5" fontWeight={600}>
                {team.name}
              </Typography>
            </Box>
            <Chip
              label={getInterventionTypeLabel(team.interventionType)}
              color="primary"
              size="medium"
            />
          </Box>

          {/* Description */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
            <Typography variant="subtitle2" color="primary.main" sx={{ mb: 1, fontWeight: 600 }}>
              📝 Description de l'équipe
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {team.description || 'Aucune description disponible pour cette équipe.'}
            </Typography>
          </Box>

          {/* Métriques principales */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Group sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {team.memberCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Membres
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Build sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {getInterventionTypeLabel(team.interventionType)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Spécialité
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Informations complémentaires */}
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
            <Typography variant="subtitle2" color="primary.main" sx={{ mb: 1, fontWeight: 600 }}>
              ℹ️ Informations de l'équipe
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Créée le:
                  </Typography>
                  <Typography variant="caption" color="text.primary">
                    {team.createdAt ? new Date(team.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                  </Typography>
                </Box>
              </Grid>
              {team.updatedAt && (
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      Modifiée le:
                    </Typography>
                    <Typography variant="caption" color="text.primary">
                      {new Date(team.updatedAt).toLocaleDateString('fr-FR')}
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Liste des membres */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
            Membres de l'équipe ({team.members.length})
          </Typography>

          {team.members.length > 0 ? (
            <List>
              {team.members.map((member, index) => (
                <React.Fragment key={member.userId}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>
                        <Person />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${member.firstName} ${member.lastName}`}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {member.email}
                          </Typography>
                          <Chip
                            label={member.role}
                            size="small"
                            color="secondary"
                            sx={{ mt: 0.5 }}
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < team.members.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                Aucun membre dans cette équipe
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default TeamDetails;
