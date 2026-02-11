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
  Sync,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import FilterSearchBar from '../../components/FilterSearchBar';
import { usersApi } from '../../services/api';
import apiClient from '../../services/apiClient';
import { UserStatus, USER_STATUS_OPTIONS } from '../../types/statusEnums';
import { createSpacing } from '../../theme/spacing';
import ExportButton from '../../components/ExportButton';
import type { ExportColumn } from '../../utils/exportUtils';

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

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

const userRoles: Array<{ value: string; label: string; icon: React.ReactElement; color: ChipColor }> = [
  { value: 'ADMIN', label: 'Administrateur', icon: <AdminPanelSettings />, color: 'error' },
  { value: 'MANAGER', label: 'Manager', icon: <SupervisorAccount />, color: 'warning' },
  { value: 'SUPERVISOR', label: 'Superviseur', icon: <SupervisorAccount />, color: 'info' },
  { value: 'TECHNICIAN', label: 'Technicien', icon: <Build />, color: 'primary' },
  { value: 'HOUSEKEEPER', label: 'Agent de ménage', icon: <CleaningServices />, color: 'default' },
  { value: 'HOST', label: 'Propriétaire', icon: <Home />, color: 'success' },
];

// Utilisation des enums partagés pour les statuts utilisateur
const userStatuses = USER_STATUS_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
  color: option.color
}));

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
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const navigate = useNavigate();
  const { user, hasPermissionAsync } = useAuth();

  // Vérifier la permission de gestion des utilisateurs
  const [canManageUsers, setCanManageUsers] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canManageUsersPermission = await hasPermissionAsync('users:manage');
      setCanManageUsers(canManageUsersPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);;

  // Charger les utilisateurs depuis l'API
  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const data = await usersApi.getAll();
        const usersList = (data as any).content || data;
        setUsers(usersList);
      } catch (err) {
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
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ p: 2, py: 1 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>
            Accès non autorisé
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
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

  const handleSyncUsers = async () => {
    setSyncing(true);
    try {
      // Appeler l'endpoint de synchronisation forcée pour recréer complètement les utilisateurs
      await apiClient.post('/sync/force-sync-all-to-keycloak');

      // Recharger la liste des utilisateurs pour voir les changements
      const data = await usersApi.getAll();
      const usersList = (data as any).content || data;
      setUsers(usersList);
    } catch (err) {
    } finally {
      setSyncing(false);
    }
  };

  const handleEditSave = async () => {
    if (!selectedUser || !editFormData.firstName || !editFormData.lastName || !editFormData.email) {
      return;
    }

    setSaving(true);
    try {
      await usersApi.update(selectedUser.id, editFormData as any);
      // Mettre à jour la liste locale
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, ...editFormData } : u
      ));
      setEditDialogOpen(false);
      setEditFormData({});
    } catch (err) {
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (selectedUser) {
      try {
        await usersApi.delete(selectedUser.id);
        setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      } catch (err) {
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

  const exportColumns: ExportColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'firstName', label: 'Prénom' },
    { key: 'lastName', label: 'Nom' },
    { key: 'email', label: 'Email' },
    { key: 'phoneNumber', label: 'Téléphone' },
    { key: 'role', label: 'Rôle', formatter: (v: string) => getRoleInfo(v).label },
    { key: 'status', label: 'Statut', formatter: (v: string) => getStatusInfo(v).label },
    { key: 'createdAt', label: 'Date de création', formatter: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : '' },
  ];

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
        title="Utilisateurs"
        subtitle="Gestion des utilisateurs de la plateforme"
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <ExportButton
              data={filteredUsers}
              columns={exportColumns}
              fileName="utilisateurs"
            />
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              startIcon={<Sync sx={{ fontSize: 18 }} />}
              onClick={handleSyncUsers}
              disabled={syncing}
              sx={{ fontSize: '0.8125rem' }}
            >
              {syncing ? 'Synchronisation...' : 'Synchroniser'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<Add sx={{ fontSize: 18 }} />}
              onClick={() => navigate('/users/new')}
              sx={{ fontSize: '0.8125rem' }}
            >
              Nouvel utilisateur
            </Button>
          </Box>
        }
      />

      {/* Statistiques */}
      <Box sx={{ mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5, px: 2 }}>
                <Typography variant="h6" color="primary" fontWeight={700} sx={{ fontSize: '1.5rem' }}>
                  {users.length}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Total utilisateurs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5, px: 2 }}>
                <Typography variant="h6" color="success.main" fontWeight={700} sx={{ fontSize: '1.5rem' }}>
                  {users.filter(u => u.status === 'ACTIVE').length}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Utilisateurs actifs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5, px: 2 }}>
                <Typography variant="h6" color="warning.main" fontWeight={700} sx={{ fontSize: '1.5rem' }}>
                  {users.filter(u => u.role === 'ADMIN').length}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Administrateurs
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 1.5, px: 2 }}>
                <Typography variant="h6" color="info.main" fontWeight={700} sx={{ fontSize: '1.5rem' }}>
                  {users.filter(u => ['TECHNICIAN', 'HOUSEKEEPER'].includes(u.role)).length}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
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
      <Grid container spacing={2}>
        {filteredUsers.length === 0 ? (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2.5, px: 2 }}>
                <Typography variant="h6" align="center" sx={{ fontSize: '0.95rem', mb: 1 }}>
                  {users.length === 0 ? 'Aucun utilisateur trouvé.' : 'Aucun utilisateur ne correspond aux filtres.'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredUsers.map((user) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={user.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
                  {/* En-tête avec avatar et menu */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                      <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                          {user.firstName} {user.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {user.email}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, user)}
                      sx={{ p: 0.5, ml: 0.5 }}
                    >
                      <MoreVert sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>

                  {/* Rôle et statut */}
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                    <Chip
                      icon={getRoleInfo(user.role).icon}
                      label={getRoleInfo(user.role).label}
                      color={getRoleInfo(user.role).color}
                      size="small"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                    <Chip
                      label={getStatusInfo(user.status).label}
                      color={getStatusInfo(user.status).color}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>

                  {/* Informations supplémentaires */}
                  <List dense sx={{ py: 0 }}>
                    {user.phoneNumber && (
                      <ListItem sx={{ px: 0, py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={user.phoneNumber}
                          primaryTypographyProps={{ variant: 'caption', sx: { fontSize: '0.7rem' } }}
                        />
                      </ListItem>
                    )}
                    <ListItem sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <Email sx={{ fontSize: 14, color: 'text.secondary' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={user.email}
                        primaryTypographyProps={{ variant: 'caption', sx: { fontSize: '0.7rem' } }}
                      />
                    </ListItem>
                    <ListItem sx={{ px: 0, py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <Person sx={{ fontSize: 14, color: 'text.secondary' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Créé le ${formatDate(user.createdAt)}`}
                        primaryTypographyProps={{ variant: 'caption', sx: { fontSize: '0.7rem', color: 'text.secondary' } }}
                      />
                    </ListItem>
                  </List>
                </CardContent>

                {/* Actions */}
                <CardActions sx={{ pt: 0, p: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Visibility sx={{ fontSize: 16 }} />}
                    onClick={() => navigate(`/users/${user.id}`)}
                    fullWidth
                    sx={{ fontSize: '0.75rem' }}
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
        <MenuItem onClick={handleViewDetails} sx={{ fontSize: '0.85rem', py: 0.75 }}>
          <ListItemIcon>
            <Visibility sx={{ fontSize: 18 }} />
          </ListItemIcon>
          Voir détails
        </MenuItem>
        <MenuItem onClick={handleEdit} sx={{ fontSize: '0.85rem', py: 0.75 }}>
          <ListItemIcon>
            <Edit sx={{ fontSize: 18 }} />
          </ListItemIcon>
          Modifier
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main', fontSize: '0.85rem', py: 0.75 }}>
          <ListItemIcon>
            <Delete sx={{ fontSize: 18, color: 'error.main' }} />
          </ListItemIcon>
          Supprimer
        </MenuItem>
      </Menu>

      {/* Dialog de modification */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Modifier l'utilisateur</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Prénom *"
                value={editFormData.firstName || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, firstName: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Nom *"
                value={editFormData.lastName || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, lastName: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
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
                size="small"
                label="Téléphone"
                value={editFormData.phoneNumber || ''}
                onChange={(e) => setEditFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Rôle</InputLabel>
                <Select
                  value={editFormData.role || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, role: e.target.value }))}
                  label="Rôle"
                >
                  {userRoles.map((role) => (
                    <MenuItem key={role.value} value={role.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ fontSize: 18 }}>{role.icon}</Box>
                        <Typography variant="body2">{role.label}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Statut</InputLabel>
                <Select
                  value={editFormData.status || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
                  label="Statut"
                >
                  {userStatuses.map((status) => (
                    <MenuItem key={status.value} value={status.value}>
                      <Typography variant="body2">{status.label}</Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setEditDialogOpen(false)} size="small">Annuler</Button>
          <Button 
            onClick={handleEditSave} 
            variant="contained"
            size="small"
            disabled={saving || !editFormData.firstName || !editFormData.lastName || !editFormData.email}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ pb: 1 }}>Confirmer la suppression</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Typography variant="body2">
            Êtes-vous sûr de vouloir supprimer l'utilisateur "{selectedUser?.firstName} {selectedUser?.lastName}" ?
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} size="small">Annuler</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" size="small">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UsersList;
