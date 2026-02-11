import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  MoreVert,
  Visibility,
  ExpandMore,
  ExpandLess,
  Refresh,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { teamsApi, interventionsApi } from '../../services/api';
import type { Team, Intervention } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import TeamCard from '../../components/TeamCard';
import { InterventionType, INTERVENTION_TYPE_OPTIONS, InterventionTypeUtils } from '../../types/interventionTypes';
import { createSpacing } from '../../theme/spacing';
import { useTranslation } from '../../hooks/useTranslation';

const TeamsList: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // États pour les permissions
  const [permissions, setPermissions] = useState({
    'teams:create': false,
    'teams:edit': false,
    'teams:delete': false
  });

  // Workload: active interventions count per team name
  const [teamWorkloadCounts, setTeamWorkloadCounts] = useState<Record<string, number>>({});

  // Vérifier toutes les permissions au chargement
  useEffect(() => {
    const checkAllPermissions = async () => {
      const perms = await Promise.all([
        hasPermissionAsync('teams:create'),
        hasPermissionAsync('teams:edit'),
        hasPermissionAsync('teams:delete')
      ]);
      
      setPermissions({
        'teams:create': perms[0],
        'teams:edit': perms[1],
        'teams:delete': perms[2]
      });
    };
    
    checkAllPermissions();
  }, [hasPermissionAsync]);

  // Fonction pour obtenir la couleur de bordure selon le type
  const getChipBorderColor = (type: string): string => {
    const interventionType = INTERVENTION_TYPE_OPTIONS.find(t => t.value === type);
    if (!interventionType) return '#666666';
    
    switch (interventionType.category) {
      case 'cleaning':
        return '#4CAF50'; // Vert
      case 'maintenance':
        return '#FF9800'; // Orange
      case 'specialized':
        return '#9C27B0'; // Violet
      case 'other':
        return '#F44336'; // Rouge
      default:
        return '#666666'; // Gris par défaut
    }
  };

  // Charger les équipes
  useEffect(() => {
    const loadTeams = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await teamsApi.getAll();

        // Si c'est une page Spring Data, extraire le contenu
        if (data && (data as any).content && Array.isArray((data as any).content)) {
          setTeams((data as any).content);
        } else if (Array.isArray(data)) {
          setTeams(data);
        } else {
          setTeams([]);
        }
      } catch (err: any) {
        if (err?.status === 401) {
          setError(t('teams.errors.authError'));
        } else if (err?.status === 403) {
          setError(t('teams.errors.forbiddenError'));
        } else if (err?.status === 404) {
          // No error message for 404
        } else {
          setError(t('teams.errors.connectionError'));
        }
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, []);

  // Charger les interventions pour les indicateurs de charge
  useEffect(() => {
    const loadWorkloadData = async () => {
      try {
        const data = await interventionsApi.getAll();
        const list = Array.isArray(data) ? data : (data as any).content || [];
        const counts: Record<string, number> = {};
        (list as Intervention[]).forEach((intervention) => {
          if (
            intervention.assignedToType === 'team' &&
            intervention.assignedToName &&
            (intervention.status === 'IN_PROGRESS' || intervention.status === 'PENDING' || intervention.status === 'AWAITING_VALIDATION')
          ) {
            counts[intervention.assignedToName] = (counts[intervention.assignedToName] || 0) + 1;
          }
        });
        setTeamWorkloadCounts(counts);
      } catch {
        // Silently fail - workload indicators are optional
      }
    };

    loadWorkloadData();
  }, []);

  // Filtrer les équipes selon le type sélectionné
        const filteredTeams = selectedType === 'all' 
        ? teams 
        : teams.filter(team => team.interventionType === selectedType);

  // Gestion du menu contextuel
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, team: Team) => {
    setAnchorEl(event.currentTarget);
    setSelectedTeam(team);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTeam(null);
  };

  const handleViewDetails = () => {
    if (selectedTeam) {
      navigate(`/teams/${selectedTeam.id}`);
    }
    handleMenuClose();
  };

  const handleEdit = () => {
    if (selectedTeam) {
      navigate(`/teams/${selectedTeam.id}/edit`);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedTeam(null);
  };

  const confirmDelete = async () => {
    if (!selectedTeam) return;

    try {
      await teamsApi.delete(selectedTeam.id);
      setTeams(teams.filter(team => team.id !== selectedTeam.id));
      handleCloseDeleteDialog();
    } catch (err) {
      setError('Erreur de connexion');
    }
  };





  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={t('teams.title')}
        subtitle={t('teams.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          permissions['teams:create'] && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={() => navigate('/teams/new')}
              size="small"
            >
              {t('teams.create')}
            </Button>
          )
        }
      />

      {/* Message d'erreur */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, py: 1 }}>
          {error}
        </Alert>
      )}

      {/* Filtres par type d'intervention */}
      <Box sx={{ mb: 2 }}>
        {/* Filtre sélectionné avec bouton de masquage */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5, 
          mb: 2,
          flexWrap: 'wrap'
        }}>
          {/* Affichage du chip sélectionné */}
          {selectedType === 'all' ? (
            <Chip
              label={t('teams.allTypes')}
              onClick={() => setSelectedType('all')}
              color="primary"
              variant="filled"
              size="small"
              sx={{
                cursor: 'pointer',
                fontSize: '0.85rem',
                py: 0.5,
                px: 1.5,
                height: 28,
                borderWidth: 1.5,
                borderColor: 'primary.main',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: 1,
                  transition: 'all 0.2s ease-in-out'
                }
              }}
            />
          ) : (
            <Chip
              label={INTERVENTION_TYPE_OPTIONS.find(type => type.value === selectedType)?.label || selectedType}
              onClick={() => setSelectedType(selectedType)}
              color="primary"
              variant="filled"
              size="small"
              sx={{
                cursor: 'pointer',
                fontSize: '0.85rem',
                py: 0.5,
                px: 1.5,
                height: 28,
                borderWidth: 1.5,
                borderColor: getChipBorderColor(selectedType),
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: 1,
                  transition: 'all 0.2s ease-in-out'
                }
              }}
            />
          )}
          
          {/* Bouton de réinitialisation des filtres */}
          {selectedType !== 'all' && (
            <Button
              variant="text"
              size="small"
              onClick={() => setSelectedType('all')}
              startIcon={<Refresh sx={{ fontSize: 18 }} />}
              sx={{
                color: 'text.secondary',
                fontSize: '0.8rem',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                },
                minWidth: 'auto',
                px: 1,
                py: 0.5
              }}
            >
              {t('teams.reset')}
            </Button>
          )}
          
          {/* Bouton de masquage des filtres */}
          <Button
            variant="text"
            size="small"
            onClick={() => setShowFilters(!showFilters)}
            startIcon={showFilters ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
            sx={{
              color: 'text.secondary',
              fontSize: '0.8rem',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              },
              minWidth: 'auto',
              px: 1,
              py: 0.5
            }}
          >
            {showFilters ? t('teams.hide') : t('teams.show')}
          </Button>
        </Box>

        {/* Filtres par catégorie sans titres */}
        {showFilters && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          {/* Types de nettoyage - Bordure verte */}
          {INTERVENTION_TYPE_OPTIONS
            .filter(type => type.category === 'cleaning')
            .map((type) => (
              <Chip
                key={type.value}
                label={type.label}
                onClick={() => setSelectedType(type.value)}
                color={selectedType === type.value ? 'primary' : 'default'}
                variant={selectedType === type.value ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  py: 0.5,
                  px: 1,
                  height: 26,
                  borderWidth: 1.5,
                  borderColor: selectedType === type.value ? 'primary.main' : 'success.main',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: 1,
                    transition: 'all 0.2s ease-in-out'
                  }
                }}
              />
            ))}

          {/* Types de maintenance - Bordure orange */}
          {INTERVENTION_TYPE_OPTIONS
            .filter(type => type.category === 'maintenance')
            .map((type) => (
              <Chip
                key={type.value}
                label={type.label}
                onClick={() => setSelectedType(type.value)}
                color={selectedType === type.value ? 'primary' : 'default'}
                variant={selectedType === type.value ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  py: 0.5,
                  px: 1,
                  height: 26,
                  borderWidth: 1.5,
                  borderColor: selectedType === type.value ? 'primary.main' : 'warning.main',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: 1,
                    transition: 'all 0.2s ease-in-out'
                  }
                }}
              />
            ))}

          {/* Types spécialisés - Bordure violette */}
          {INTERVENTION_TYPE_OPTIONS
            .filter(type => type.category === 'specialized')
            .map((type) => (
              <Chip
                key={type.value}
                label={type.label}
                onClick={() => setSelectedType(type.value)}
                color={selectedType === type.value ? 'primary' : 'default'}
                variant={selectedType === type.value ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  py: 0.5,
                  px: 1,
                  height: 26,
                  borderWidth: 1.5,
                  borderColor: selectedType === type.value ? 'primary.main' : 'info.main',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: 1,
                    transition: 'all 0.2s ease-in-out'
                  }
                }}
              />
            ))}

          {/* Type "Autre" - Bordure rouge */}
          {INTERVENTION_TYPE_OPTIONS
            .filter(type => type.category === 'other')
            .map((type) => (
              <Chip
                key={type.value}
                label={type.label}
                onClick={() => setSelectedType(type.value)}
                color={selectedType === type.value ? 'primary' : 'default'}
                variant={selectedType === type.value ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  py: 0.5,
                  px: 1,
                  height: 26,
                  borderWidth: 1.5,
                  borderColor: selectedType === type.value ? 'primary.main' : 'error.main',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: 1,
                    transition: 'all 0.2s ease-in-out'
                  }
                }}
              />
            ))}
          </Box>
        )}

        {/* Compteur d'équipes avec trait horizontal */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
          <Divider sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            {filteredTeams.length} {filteredTeams.length > 1 ? t('teams.teams') : t('teams.team')} {t('teams.available')}
          </Typography>
        </Box>
      </Box>

      {/* Debug: Vérifier les équipes */}


      {/* Liste des équipes */}
      {filteredTeams.length === 0 ? (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          py: 8,
          textAlign: 'center'
        }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
            {t('teams.noTeamFound')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 500 }}>
            {t('teams.noTeamCreated')}
          </Typography>
          {permissions['teams:create'] && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Add />}
                onClick={() => navigate('/teams/new')}
                size="medium"
              >
                {t('teams.createFirst')}
              </Button>
            </Box>
          )}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredTeams.map((team) => (
            <Grid item xs={12} md={6} lg={4} key={team.id}>
              <TeamCard
                team={team}
                onMenuOpen={handleMenuOpen}
                activeInterventionsCount={teamWorkloadCounts[team.name] || 0}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleViewDetails} sx={{ fontSize: '0.85rem', py: 0.75 }}>
          <ListItemIcon>
            <Visibility fontSize="small" sx={{ fontSize: 18 }} />
          </ListItemIcon>
          {t('teams.viewDetails')}
        </MenuItem>
        {permissions['teams:edit'] && (
          <MenuItem onClick={handleEdit} sx={{ fontSize: '0.85rem', py: 0.75 }}>
            <ListItemIcon>
              <Edit fontSize="small" sx={{ fontSize: 18 }} />
            </ListItemIcon>
            {t('teams.modify')}
          </MenuItem>
        )}
        {permissions['teams:delete'] && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main', fontSize: '0.85rem', py: 0.75 }}>
            <ListItemIcon>
              <Delete fontSize="small" sx={{ color: 'error.main', fontSize: 18 }} />
            </ListItemIcon>
            Supprimer
          </MenuItem>
        )}
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle sx={{ pb: 1 }}>{t('teams.confirmDelete')}</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography variant="body2">
            {t('teams.confirmDeleteMessage', { name: selectedTeam?.name })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={handleCloseDeleteDialog} size="small">{t('teams.cancel')}</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" size="small">
            {t('teams.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamsList;