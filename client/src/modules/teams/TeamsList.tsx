import React, { useState } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Badge,
  Tooltip,
  Fab,
  ListItemIcon,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Visibility,
  People,
  Build,
  CleaningServices,
  Assignment,
  LocationOn,
  Phone,
  Email,
  Star,
  Schedule,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import FilterSearchBar from '../../components/FilterSearchBar';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  phone?: string;
  email?: string;
  rating: number;
  specializations: string[];
  availability: 'available' | 'busy' | 'offline';
}

interface Team {
  id: string;
  name: string;
  type: 'cleaning' | 'maintenance' | 'repair' | 'inspection' | 'mixed';
  description: string;
  members: TeamMember[];
  status: 'active' | 'inactive' | 'training';
  location: string;
  rating: number;
  totalInterventions: number;
  successRate: number;
  createdAt: string;
}

const mockTeams: Team[] = [
  {
    id: '1',
    name: 'Équipe de nettoyage A',
    type: 'cleaning',
    description: 'Équipe spécialisée dans le nettoyage de fin de séjour',
    members: [
      {
        id: '1',
        name: 'Marie Dupont',
        role: 'Chef d\'équipe',
        rating: 4.8,
        specializations: ['Nettoyage', 'Organisation'],
        availability: 'available',
        phone: '+33 6 12 34 56 78',
        email: 'marie.dupont@clenzy.fr',
      },
      {
        id: '2',
        name: 'Sophie Martin',
        role: 'Agent de nettoyage',
        rating: 4.6,
        specializations: ['Nettoyage', 'Repassage'],
        availability: 'available',
      },
    ],
    status: 'active',
    location: 'Paris',
    rating: 4.7,
    totalInterventions: 156,
    successRate: 98,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Équipe technique B',
    type: 'maintenance',
    description: 'Équipe de maintenance et réparations',
    members: [
      {
        id: '3',
        name: 'Jean Bernard',
        role: 'Technicien principal',
        rating: 4.9,
        specializations: ['Plomberie', 'Électricité', 'Climatisation'],
        availability: 'busy',
        phone: '+33 6 98 76 54 32',
        email: 'jean.bernard@clenzy.fr',
      },
      {
        id: '4',
        name: 'Pierre Dubois',
        role: 'Technicien',
        rating: 4.5,
        specializations: ['Plomberie', 'Chauffage'],
        availability: 'available',
      },
    ],
    status: 'active',
    location: 'Nice',
    rating: 4.7,
    totalInterventions: 89,
    successRate: 95,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

const teamTypes = [
  { value: 'all', label: 'Tous les types', icon: <People /> },
  { value: 'cleaning', label: 'Nettoyage', icon: <CleaningServices /> },
  { value: 'maintenance', label: 'Maintenance', icon: <Build /> },
  { value: 'repair', label: 'Réparation', icon: <Build /> },
  { value: 'inspection', label: 'Inspection', icon: <Assignment /> },
  { value: 'mixed', label: 'Mixte', icon: <People /> },
];

const statusColors = {
  active: 'success',
  inactive: 'default',
  training: 'warning',
} as const;

const statusLabels = {
  active: 'Active',
  inactive: 'Inactive',
  training: 'En formation',
};

const availabilityColors = {
  available: 'success',
  busy: 'warning',
  offline: 'default',
} as const;

const availabilityLabels = {
  available: 'Disponible',
  busy: 'Occupé',
  offline: 'Hors ligne',
};

export default function TeamsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();

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
    }
    handleMenuClose();
  };

  const handleView = () => {
    if (selectedTeam) {
      navigate(`/teams/${selectedTeam.id}`);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const confirmDelete = () => {
    // TODO: Implement delete logic
    console.log('Deleting team:', selectedTeam?.id);
    setDeleteDialogOpen(false);
  };

  const filteredTeams = mockTeams.filter((team) => {
    const matchesSearch = team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         team.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         team.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || team.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || team.status === selectedStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getTeamTypeIcon = (type: string) => {
    switch (type) {
      case 'cleaning':
        return <CleaningServices />;
      case 'maintenance':
        return <Build />;
      case 'repair':
        return <Build />;
      case 'inspection':
        return <Assignment />;
      case 'mixed':
        return <People />;
      default:
        return <People />;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Équipes
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gérez vos équipes d'intervention
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/teams/new')}
          sx={{ borderRadius: 2 }}
        >
          Nouvelle équipe
        </Button>
      </Box>

      {/* Filtres et recherche */}
      <FilterSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher une équipe..."
        filters={{
          type: {
            value: selectedType,
            options: teamTypes,
            onChange: setSelectedType,
            label: "Type d'équipe"
          },
          status: {
            value: selectedStatus,
            options: [
              { value: 'all', label: 'Tous les statuts' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'training', label: 'En formation' }
            ],
            onChange: setSelectedStatus,
            label: "Statut"
          }
        }}
        counter={{
          label: "équipe",
          count: filteredTeams.length,
          singular: "",
          plural: "s"
        }}
      />

      {/* Liste des équipes */}
      <Grid container spacing={3}>
        {filteredTeams.map((team) => (
          <Grid item xs={12} md={6} lg={4} key={team.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getTeamTypeIcon(team.type)}
                    <Typography variant="h6" fontWeight={600}>
                      {team.name}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, team)}
                  >
                    <MoreVert />
                  </IconButton>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {team.description}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {team.location}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Chip
                    label={statusLabels[team.status]}
                    color={statusColors[team.status]}
                    size="small"
                    variant="outlined"
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Star sx={{ fontSize: 16, color: 'warning.main' }} />
                    <Typography variant="body2" fontWeight={500}>
                      {team.rating}
                    </Typography>
                  </Box>
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Interventions
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {team.totalInterventions}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Taux de succès
                    </Typography>
                    <Typography variant="body2" fontWeight={500} color="success.main">
                      {team.successRate}%
                    </Typography>
                  </Grid>
                </Grid>

                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Membres ({team.members.length})
                </Typography>
                <List dense sx={{ p: 0, mb: 2 }}>
                  {team.members.slice(0, 2).map((member) => (
                    <ListItem key={member.id} sx={{ px: 0, py: 0.5 }}>
                      <ListItemAvatar sx={{ minWidth: 32 }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                          {member.name.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {member.name}
                            </Typography>
                            <Chip
                              label={availabilityLabels[member.availability]}
                              color={availabilityColors[member.availability]}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {member.role}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                  {team.members.length > 2 && (
                    <ListItem sx={{ px: 0, py: 0.5 }}>
                      <ListItemText
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            +{team.members.length - 2} autres membres
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  size="small"
                  startIcon={<Visibility />}
                  onClick={() => navigate(`/teams/${team.id}`)}
                  sx={{ flexGrow: 1 }}
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
      >
        <MenuItem onClick={handleView}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          Voir détails
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          Modifier
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Delete fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          Supprimer
        </MenuItem>
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer l'équipe "{selectedTeam?.name}" ? 
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAB pour ajouter rapidement */}
      <Fab
                        color="secondary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16, display: { md: 'none' } }}
        onClick={() => navigate('/teams/new')}
      >
        <Add />
      </Fab>
    </Box>
  );
}
