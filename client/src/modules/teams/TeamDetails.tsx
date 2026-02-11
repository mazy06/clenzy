import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Group,
  Edit,
  Build,
  CleaningServices,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { teamsApi } from '../../services/api';
import type { TeamMember } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import TeamWorkloadCard from './TeamWorkloadCard';
import TeamPerformanceChart from './TeamPerformanceChart';
import TeamMembersList from './TeamMembersList';

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

  // TOUS les hooks doivent être déclarés AVANT les returns conditionnels
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  // Charger les données de l'équipe
  useEffect(() => {
    const loadTeam = async () => {
      if (!id) return;

      setLoading(true);
      try {
        const teamData = await teamsApi.getById(Number(id));
        setTeam(teamData as any);
      } catch (err) {
        setError('Erreur lors du chargement de l\'équipe');
      } finally {
        setLoading(false);
      }
    };

    loadTeam();
  }, [id]);

  // Vérifier les permissions pour l'édition
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('teams:edit');
      setCanEdit(canEditPermission);
    };

    checkPermissions();
  }, [hasPermissionAsync]);

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

  // Returns conditionnels APRÈS tous les hooks
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

      {/* Row 1: Carte principale avec résumé */}
      <Card sx={{ mb: 3 }}>
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
              Description de l'équipe
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
              Informations de l'équipe
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

      {/* Row 2: Workload (6 cols) + Performance (6 cols) */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TeamWorkloadCard teamId={team.id} teamName={team.name} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TeamPerformanceChart teamId={team.id} teamName={team.name} />
        </Grid>
      </Grid>

      {/* Row 3: TeamMembersList (12 cols) */}
      <TeamMembersList
        members={team.members || []}
        teamId={team.id}
        teamName={team.name}
        canEdit={canEdit}
      />
    </Box>
  );
};

export default TeamDetails;
