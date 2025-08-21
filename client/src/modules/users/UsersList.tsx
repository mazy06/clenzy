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
  TextField,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Person,
  Visibility,
  Email,
  Phone,
  AdminPanelSettings,
  SupervisorAccount,
  Build,
  CleaningServices,
  Home,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import FilterSearchBar from '../../components/FilterSearchBar';
import { API_CONFIG } from '../../config/api';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  status: string;
  createdAt: string;
}

const userRoles = [
  { value: 'ADMIN', label: 'Administrateur', icon: <AdminPanelSettings />, color: 'error' },
  { value: 'MANAGER', label: 'Manager', icon: <SupervisorAccount />, color: 'warning' },
  { value: 'SUPERVISOR', label: 'Superviseur', icon: <SupervisorAccount />, color: 'info' },
  { value: 'TECHNICIAN', label: 'Technicien', icon: <Build />, color: 'primary' },
  { value: 'HOUSEKEEPER', label: 'Agent de ménage', icon: <CleaningServices />, color: 'default' },
  { value: 'HOST', label: 'Propriétaire', icon: <Home />, color: 'success' },
];

const userStatuses = [
  { value: 'ACTIVE', label: 'Actif', color: 'success' },
  { value: 'INACTIVE', label: 'Inactif', color: 'default' },
  { value: 'SUSPENDED', label: 'Suspendu', color: 'error' },
  { value: 'PENDING_VERIFICATION', label: 'En attente de vérification', color: 'warning' },
  { value: 'BLOCKED', label: 'Bloqué', color: 'error' },
];

// Données mockées supprimées - utilisation de l'API uniquement

const UsersList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  // Vérifier la permission de gestion des utilisateurs
  const canManageUsers = hasPermission('users:manage');

  // Charger les utilisateurs depuis l'API
  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const usersList = data.content || data;
          console.log('🔍 UsersList - Utilisateurs chargés:', usersList);
          setUsers(usersList);
        } else {
          console.error('🔍 UsersList - Erreur API:', response.status);
          // En cas d'erreur, tableau vide
          setUsers([]);
        }
      } catch (err) {
        console.error('🔍 UsersList - Erreur chargement:', err);
        // En cas d'erreur, tableau vide
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  // Si pas de permission, afficher un message informatif
  if (!user || !canManageUsers) {
    console.log('🔍 UsersList - Permission refusée ou utilisateur non chargé');
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          <Typography variant="h6" gutterBottom>
            Accès non autorisé
          </Typography>
          <Typography variant="body1">
            Vous n'avez pas les permissions nécessaires pour gérer les utilisateurs.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedUser(null);
  };

  const handleEdit = () => {
    if (selectedUser) {
      setEditFormData({
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        email: selectedUser.email,
        phoneNumber: selectedUser.phoneNumber,
        role: selectedUser.role,
        status: selectedUser.status,
      });
      setEditDialogOpen(true);
      handleMenuClose();
    }
  };

  const handleViewDetails = () => {
    if (selectedUser) {
      navigate(`/users/${selectedUser.id}`);
      handleMenuClose();
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleEditSave = async () => {
    if (!selectedUser || !editFormData.firstName || !editFormData.lastName || !editFormData.email) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
        body: JSON.stringify(editFormData),
      });

      if (response.ok) {
        // Mettre à jour la liste locale
        setUsers(prev => prev.map(u => 
          u.id === selectedUser.id ? { ...u, ...editFormData } : u
        ));
        setEditDialogOpen(false);
        setEditFormData({});
      }
    } catch (err) {
      console.error('🔍 UsersList - Erreur mise à jour:', err);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (selectedUser) {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/users/${selectedUser.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
        }
      } catch (err) {
        console.error('🔍 UsersList - Erreur suppression:', err);
      }
    }
    setDeleteDialogOpen(false);
  };

  const getRoleInfo = (role: string) => {
    return userRoles.find(r => r.value === role) || userRoles[0];
  };

  // Filtrer les utilisateurs selon les critères
  const getFilteredUsers = () => {
    return users.filter((user) => {
      const matchesSearch = searchTerm === '' || 
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = selectedRole === 'all' || user.role === selectedRole;
      const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  };

  const filteredUsers = getFilteredUsers();

  const getStatusInfo = (status: string) => {
    return userStatuses.find(s => s.value === status) || userStatuses[0];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Utilisateurs"
        subtitle="Gestion des utilisateurs de la plateforme"
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => navigate('/users/new')}
          >
            Nouvel utilisateur
          </Button>
        }
      />

      {/* Statistiques */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="primary" fontWeight={700}>
                  {users.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total utilisateurs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="success.main" fontWeight={700}>
                  {users.filter(u => u.status === 'ACTIVE').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Utilisateurs actifs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="warning.main" fontWeight={700}>
                  {users.filter(u => u.role === 'ADMIN').length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Administrateurs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" color="info.main" fontWeight={700}>
                  {users.filter(u => ['TECHNICIAN', 'HOUSEKEEPER'].includes(u.role)).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Personnel opérationnel
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Filtres et recherche */}
      <FilterSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher un utilisateur..."
        filters={{
          type: {
            value: selectedRole,
            options: [
              { value: 'all', label: 'Tous les rôles' },
              ...userRoles.map(role => ({ value: role.value, label: role.label }))
            ],
            onChange: setSelectedRole,
            label: "Rôle"
          },
          status: {
            value: selectedStatus,
            options: [
              { value: 'all', label: 'Tous les statuts' },
              ...userStatuses.map(status => ({ value: status.value, label: status.label }))
            ],
            onChange: setSelectedStatus,
            label: "Statut"
          }
        }}
        counter={{
          label: "utilisateur",
          count: filteredUsers.length,
          singular: "",
          plural: "s"
        }}
      />

      {/* Liste des utilisateurs */}
      <Grid container spacing={3}>
        {filteredUsers.length === 0 ? (
          <Grid item xs={12}>
            <Typography variant="h6" align="center">
              {users.length === 0 ? 'Aucun utilisateur trouvé.' : 'Aucun utilisateur ne correspond aux filtres.'}
            </Typography>
          </Grid>
        ) : (
          filteredUsers.map((user) => (
            <Grid item xs={12} md={6} lg={4} key={user.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, p: 3 }}>
                  {/* En-tête avec avatar et menu */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                      <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}>
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" fontWeight={600}>
                          {user.firstName} {user.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, user)}
                      sx={{ ml: 1 }}
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>

                  {/* Rôle et statut */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip
                      icon={getRoleInfo(user.role).icon}
                      label={getRoleInfo(user.role).label}
                      color={getRoleInfo(user.role).color as any}
                      size="small"
                    />
                    <Chip
                      label={getStatusInfo(user.status).label}
                      color={getStatusInfo(user.status).color as any}
                      size="small"
                      variant="outlined"
                    />
                  </Box>

                  {/* Informations supplémentaires */}
                  <List dense sx={{ py: 0 }}>
                    {user.phoneNumber && (
                      <ListItem sx={{ px: 0, py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={user.phoneNumber}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    )}
                    <ListItem sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Email sx={{ fontSize: 16, color: 'text.secondary' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={user.email}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Créé le ${formatDate(user.createdAt)}`}
                        primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                      />
                    </ListItem>
                  </List>
                </CardContent>

                {/* Actions */}
                <CardActions sx={{ p: 3, pt: 0 }}>
                  <Button
                    variant="outlined"
                    startIcon={<Visibility />}
                    onClick={() => navigate(`/users/${user.id}`)}
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

      {/* Dialog de modification */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier l'utilisateur</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Prénom *"
                value={editFormData.firstName || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, firstName: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nom *"
                value={editFormData.lastName || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, lastName: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email *"
                type="email"
                value={editFormData.email || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Téléphone"
                value={editFormData.phoneNumber || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Rôle</InputLabel>
                <Select
                  value={editFormData.role || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, role: e.target.value }))}
                  label="Rôle"
                >
                  {userRoles.map((role) => (
                    <MenuItem key={role.value} value={role.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {role.icon}
                        {role.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Statut</InputLabel>
                <Select
                  value={editFormData.status || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
                  label="Statut"
                >
                  {userStatuses.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      {status.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Annuler</Button>
          <Button 
            onClick={handleEditSave} 
            variant="contained"
            disabled={saving || !editFormData.firstName || !editFormData.lastName || !editFormData.email}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer l'utilisateur "{selectedUser?.firstName} {selectedUser?.lastName}" ?
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
    </Box>
  );
};

export default UsersList;
