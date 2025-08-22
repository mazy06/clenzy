import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add,
  Visibility,
  Edit,
  Delete,
  MoreVert,
  Group,
  Person,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';
import PageHeader from '../../components/PageHeader';
import { InterventionType, INTERVENTION_TYPE_OPTIONS, InterventionTypeUtils } from '../../types/interventionTypes';

interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
  memberCount: number;
  members: TeamMember[];
}

interface TeamMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const TeamsList: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Charger les équipes
  useEffect(() => {
    const loadTeams = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/teams`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTeams(data.content || data);
        } else {
          setError('Erreur lors du chargement des équipes');
        }
      } catch (err) {
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
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
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/teams/${selectedTeam.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        setTeams(teams.filter(team => team.id !== selectedTeam.id));
        handleCloseDeleteDialog();
      } else {
        setError('Erreur lors de la suppression');
      }
    } catch (err) {
      setError('Erreur de connexion');
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Équipes"
        subtitle="Gestion des équipes d'intervention"
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => navigate('/teams/new')}
          >
            Nouvelle équipe
          </Button>
        }
      />

      {/* Message d'erreur */}
      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {/* Filtres par type d'intervention */}
      <Box sx={{ mb: 4 }}>
        {/* Filtre "Tous les types" */}
        <Box sx={{ mb: 3 }}>
          <Chip
            label="Tous les types"
            onClick={() => setSelectedType('all')}
            color={selectedType === 'all' ? 'primary' : 'default'}
            variant={selectedType === 'all' ? 'filled' : 'outlined'}
            sx={{
              cursor: 'pointer',
              fontSize: '1rem',
              py: 1,
              px: 2,
              borderWidth: 2,
              borderColor: selectedType === 'all' ? 'primary.main' : '#666666',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: 1,
                transition: 'all 0.2s ease-in-out'
              }
            }}
          />
        </Box>

        {/* Filtres par catégorie sans titres */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
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
                sx={{
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  py: 1,
                  px: 1.5,
                  borderWidth: 2,
                  borderColor: selectedType === type.value ? 'primary.main' : '#4CAF50',
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
                sx={{
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  py: 1,
                  px: 1.5,
                  borderWidth: 2,
                  borderColor: selectedType === type.value ? 'primary.main' : '#FF9800',
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
                sx={{
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  py: 1,
                  px: 1.5,
                  borderWidth: 2,
                  borderColor: selectedType === type.value ? 'primary.main' : '#9C27B0',
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
                sx={{
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  py: 1,
                  px: 1.5,
                  borderWidth: 2,
                  borderColor: selectedType === type.value ? 'primary.main' : '#F44336',
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: 1,
                    transition: 'all 0.2s ease-in-out'
                  }
                }}
              />
            ))}
        </Box>

        {/* Compteur d'équipes avec trait horizontal */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 3 }}>
          <Divider sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {filteredTeams.length} équipe{filteredTeams.length > 1 ? 's' : ''} disponible{filteredTeams.length > 1 ? 's' : ''}
          </Typography>
        </Box>
      </Box>

      {/* Liste des équipes */}
      <Grid container spacing={3}>
        {filteredTeams.map((team) => (
          <Grid item xs={12} md={6} lg={4} key={team.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                {/* En-tête de la carte */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h3" sx={{ mb: 1, fontWeight: 600 }}>
                      {team.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {team.description || 'Aucune description'}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, team)}
                    sx={{ ml: 1 }}
                  >
                    <MoreVert />
                  </IconButton>
                </Box>

                {/* Type d'intervention */}
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={INTERVENTION_TYPE_OPTIONS.find(t => t.value === team.interventionType)?.label || team.interventionType}
                    size="small"
                    sx={{
                      fontSize: '0.75rem',
                      height: '20px'
                    }}
                  />
                </Box>

                {/* Membres de l'équipe */}
                <List dense sx={{ mb: 2 }}>
                  {team.members.slice(0, 3).map((member, index) => (
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
                      {index < Math.min(team.members.length, 3) - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                  {team.members.length > 3 && (
                    <ListItem sx={{ px: 0, py: 0.5 }}>
                      <ListItemText
                        primary={`... et ${team.members.length - 3} autre(s) membre(s)`}
                        primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>

              {/* Actions */}
              <CardActions sx={{ p: 3, pt: 0 }}>
                <Button
                  variant="outlined"
                  startIcon={<Visibility />}
                  onClick={() => navigate(`/teams/${team.id}`)}
                  fullWidth
                >
                  Voir détails
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

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
        <MenuItem onClick={handleViewDetails}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          Voir détails
        </MenuItem>
        {hasPermission('teams:edit') && (
          <MenuItem onClick={handleEdit}>
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            Modifier
          </MenuItem>
        )}
        {hasPermission('teams:delete') && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <Delete fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            Supprimer
          </MenuItem>
        )}
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer l'équipe "{selectedTeam?.name}" ? Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Annuler</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamsList;