import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Group,
  Person,
  Visibility,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

interface Team {
  id: number;
  name: string;
  description: string;
  interventionType: string;
  memberCount: number;
  members: TeamMember[];
}

interface TeamMember {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

const interventionTypes = [
  { value: 'all', label: 'Tous les types', icon: '👥' },
  { value: 'cleaning', label: 'Nettoyage', icon: '🧹' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { value: 'repair', label: 'Réparation', icon: '🔨' },
  { value: 'inspection', label: 'Inspection', icon: '🔍' },
  { value: 'mixed', label: 'Mixte', icon: '👥' },
];

const TeamsList: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState('all');
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  // Charger les équipes depuis l'API
  useEffect(() => {
    const loadTeams = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/teams`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const teamsList = data.content || data;
          console.log('🔍 TeamsList - Équipes chargées depuis l\'API:', teamsList);
          setTeams(teamsList);
        } else {
          console.error('🔍 TeamsList - Erreur API:', response.status, response.statusText);
          setError(`Erreur lors du chargement des équipes: ${response.status} ${response.statusText}`);
          setTeams([]);
        }
      } catch (err) {
        console.error('🔍 TeamsList - Erreur chargement:', err);
        setError('Erreur de connexion lors du chargement des équipes');
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, []);

  // Filtrer les équipes selon le type sélectionné
  const getFilteredTeams = () => {
    if (selectedType === 'all') return teams;
    return teams.filter(team => team.interventionType === selectedType);
  };

  const filteredTeams = getFilteredTeams();

  const getInterventionTypeInfo = (type: string) => {
    return interventionTypes.find(t => t.value === type) || interventionTypes[0];
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, team: Team) => {
    setAnchorEl(event.currentTarget);
    setSelectedTeam(team);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTeam(null);
  };

  const handleEdit = () => {
    if (selectedTeam) {
      navigate(`/teams/${selectedTeam.id}/edit`);
      handleMenuClose();
    }
  };

  const handleViewDetails = () => {
    if (selectedTeam) {
      navigate(`/teams/${selectedTeam.id}`);
      handleMenuClose();
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const confirmDelete = async () => {
    if (selectedTeam) {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/teams/${selectedTeam.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          // Mettre à jour la liste locale
          setTeams(prev => prev.filter(team => team.id !== selectedTeam.id));
          setDeleteDialogOpen(false);
        } else {
          console.error('🔍 TeamsList - Erreur suppression:', response.status);
          setError('Erreur lors de la suppression de l\'équipe');
        }
      } catch (err) {
        console.error('🔍 TeamsList - Erreur suppression:', err);
        setError('Erreur lors de la suppression de l\'équipe');
      }
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedTeam(null);
  };

  const getRoleLabel = (role: string) => {
    const roleLabels: { [key: string]: string } = {
      'housekeeper': 'Agent de ménage',
      'technician': 'Technicien',
      'supervisor': 'Superviseur',
      'manager': 'Manager',
    };
    return roleLabels[role.toLowerCase()] || role;
  };

  const getRoleColor = (role: string) => {
    const roleColors: { [key: string]: string } = {
      'housekeeper': 'default',
      'technician': 'primary',
      'supervisor': 'info',
      'manager': 'warning',
    };
    return roleColors[role.toLowerCase()] || 'default';
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
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Équipes
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez vos équipes de travail
          </Typography>
        </Box>
        {hasPermission('teams:create') && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/teams/new')}
            sx={{ borderRadius: 2 }}
          >
            + Nouvelle équipe
          </Button>
        )}
      </Box>

      {/* Message d'erreur */}
      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      {/* Filtres */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
          Filtrer par type d'intervention
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {interventionTypes.map((type) => (
            <Chip
              key={type.value}
              label={`${type.icon} ${type.label}`}
              onClick={() => setSelectedType(type.value)}
              color={selectedType === type.value ? 'primary' : 'default'}
              variant={selectedType === type.value ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      </Box>

      {/* Liste des équipes */}
      <Grid container spacing={3}>
        {filteredTeams.length === 0 ? (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', py: 8 }}>
              {teams.length === 0 ? (
                // Aucune équipe dans la base de données
                <>
                  <Group sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    Aucune équipe trouvée
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Commencez par créer votre première équipe pour organiser votre travail
                  </Typography>
                  {hasPermission('teams:create') && (
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => navigate('/teams/new')}
                      size="large"
                    >
                      Créer la première équipe
                    </Button>
                  )}
                </>
              ) : (
                // Aucune équipe correspondant au filtre
                <>
                  <Group sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    Aucune équipe de type "{getInterventionTypeInfo(selectedType).label}" trouvée
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Essayez de modifier vos filtres ou créez une nouvelle équipe de ce type
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => setSelectedType('all')}
                    sx={{ mr: 2 }}
                  >
                    Voir toutes les équipes
                  </Button>
                  {hasPermission('teams:create') && (
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => navigate('/teams/new')}
                    >
                      Créer une équipe
                    </Button>
                  )}
                </>
              )}
            </Box>
          </Grid>
        ) : (
          filteredTeams.map((team) => (
            <Grid item xs={12} md={6} lg={4} key={team.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  {/* En-tête avec nom et menu */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <Group sx={{ color: 'primary.main' }} />
                      <Typography variant="h6" fontWeight={600}>
                        {team.name}
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
                      icon={<span style={{ fontSize: '1em' }}>{getInterventionTypeInfo(team.interventionType).icon}</span>}
                      label={getInterventionTypeInfo(team.interventionType).label}
                      color="primary"
                      variant="outlined"
                      size="small"
                    />
                  </Box>

                  {/* Description */}
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3, minHeight: '3em' }}>
                    {team.description}
                  </Typography>

                  {/* Statistiques */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Chip
                      icon={<Group />}
                      label={`${team.memberCount} membre(s)`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>

                  {/* Membres de l'équipe */}
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    Membres :
                  </Typography>
                  <List dense sx={{ py: 0 }}>
                    {team.members.slice(0, 3).map((member, index) => (
                      <React.Fragment key={member.userId}>
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
          ))
        )}
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
