import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
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
  Add,
  Sync,
  ManageAccounts,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import PageHeader from '../../components/PageHeader';
import FilterSearchBar from '../../components/FilterSearchBar';
import ExportButton from '../../components/ExportButton';
import { usersApi, type UserFormData } from '../../services/api';
import { userAvatarSrc } from '../../services/api/usersApi';
import { extractApiList } from '../../types';
import apiClient from '../../services/apiClient';
import { UserStatus, USER_STATUS_OPTIONS } from '../../types/statusEnums';
import type { ExportColumn } from '../../utils/exportUtils';
import type { ChipColor } from '../../types';
import type { LucideIcon } from 'lucide-react';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: string;
  // Rôle du membre dans son organisation (OrgMemberRole, ex: MANAGER). Affiché en
  // priorité dans l'Annuaire pour les membres d'org (le rôle plateforme d'un
  // Manager/Admin d'org est HOST = "Propriétaire", ce qui prêtait à confusion).
  organizationRole?: string;
  status: string;
  createdAt: string;
}

const userRoles: Array<{ value: string; label: string; Icon: LucideIcon; color: ChipColor; hex: string }> = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', Icon: AdminPanelSettings, color: 'error', hex: '#C97A7A' },
  { value: 'SUPER_MANAGER', label: 'Super Manager', Icon: SupervisorAccount, color: 'secondary', hex: '#7B61FF' },
  { value: 'SUPERVISOR', label: 'Superviseur', Icon: SupervisorAccount, color: 'info', hex: '#7BA3C2' },
  { value: 'TECHNICIAN', label: 'Technicien', Icon: Build, color: 'primary', hex: '#6B8A9A' },
  { value: 'HOUSEKEEPER', label: 'Agent de ménage', Icon: CleaningServices, color: 'default', hex: '#8A8378' },
  { value: 'LAUNDRY', label: 'Blanchisserie', Icon: CleaningServices, color: 'default', hex: '#8A8378' },
  { value: 'EXTERIOR_TECH', label: 'Tech. Extérieur', Icon: Build, color: 'primary', hex: '#6B8A9A' },
  { value: 'HOST', label: 'Propriétaire', Icon: Home, color: 'success', hex: '#4A9B8E' },
];

// Libellés/visuels des rôles d'ORGANISATION (OrgMemberRole), affichés dans
// l'Annuaire pour les membres d'org. Distinct de userRoles (rôles plateforme) :
// un Manager/Admin d'org a le rôle plateforme HOST, mais on veut afficher son rôle réel.
const orgRoleDisplay: Record<string, { label: string; Icon: LucideIcon; color: ChipColor; hex: string }> = {
  OWNER: { label: 'Propriétaire', Icon: Home, color: 'success', hex: '#4A9B8E' },
  ADMIN: { label: 'Administrateur', Icon: AdminPanelSettings, color: 'error', hex: '#C97A7A' },
  MANAGER: { label: 'Manager', Icon: SupervisorAccount, color: 'warning', hex: '#D4A574' },
  SUPERVISOR: { label: 'Superviseur', Icon: SupervisorAccount, color: 'info', hex: '#7BA3C2' },
  HOUSEKEEPER: { label: 'Agent de ménage', Icon: CleaningServices, color: 'default', hex: '#8A8378' },
  TECHNICIAN: { label: 'Technicien', Icon: Build, color: 'primary', hex: '#6B8A9A' },
  LAUNDRY: { label: 'Blanchisserie', Icon: CleaningServices, color: 'default', hex: '#8A8378' },
  EXTERIOR_TECH: { label: 'Tech. Extérieur', Icon: Build, color: 'primary', hex: '#6B8A9A' },
  HOST: { label: 'Hôte', Icon: Home, color: 'success', hex: '#4A9B8E' },
  MEMBER: { label: 'Membre', Icon: Home, color: 'default', hex: '#8A8378' },
};

const USER_STATUS_HEX: Record<string, string> = {
  ACTIVE: '#4A9B8E',
  PENDING_VERIFICATION: '#ED6C02',
  SUSPENDED: '#ED6C02',
  INACTIVE: '#757575',
  BLOCKED: '#d32f2f',
  DELETED: '#d32f2f',
};

// Utilisation des enums partagés pour les statuts utilisateur
const userStatuses = USER_STATUS_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
  color: option.color
}));

// Données mockées supprimées - utilisation de l'API uniquement

export interface UsersListHandle {
  sync: () => void;
  syncing: boolean;
  filteredUsers: User[];
  exportColumns: ExportColumn[];
}

interface UsersListProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

const UsersList = forwardRef<UsersListHandle, UsersListProps>(({ embedded = false, actionsContainer, filtersContainer }, ref) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<UserFormData>>({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const navigate = useNavigate();
  const { user, hasPermissionAsync } = useAuth();
  const { notify } = useNotification();

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
        const usersList = extractApiList<User>(data);
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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, u: User) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(u);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
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
      setAnchorEl(null);
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
    setAnchorEl(null);
  };

  const handleSyncUsers = async () => {
    setSyncing(true);
    try {
      await apiClient.post('/sync/force-sync-all-to-keycloak');
      const data = await usersApi.getAll();
      const usersList = extractApiList<User>(data);
      setUsers(usersList);
    } catch (err) {
    } finally {
      setSyncing(false);
    }
  };

  const handleEditSave = async () => {
    if (!selectedUser || !editFormData.firstName || !editFormData.lastName || !editFormData.email) {
      notify.warning('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSaving(true);
    try {
      await usersApi.update(selectedUser.id, editFormData);
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, ...editFormData } : u
      ));
      setEditDialogOpen(false);
      setEditFormData({});
      setSelectedUser(null);
      notify.success('Utilisateur mis à jour avec succès');
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : 'Erreur lors de la mise à jour de l\'utilisateur');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (selectedUser) {
      try {
        await usersApi.delete(selectedUser.id);
        setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
        setDeleteDialogOpen(false);
        notify.success('Utilisateur supprimé avec succès');
      } catch (err: unknown) {
        notify.error(err instanceof Error ? err.message : 'Erreur lors de la suppression de l\'utilisateur');
        setDeleteDialogOpen(false);
      }
    } else {
      setDeleteDialogOpen(false);
    }
  };

  const getRoleInfo = (role: string) => {
    return userRoles.find(r => r.value === role) || userRoles[0];
  };

  // Rôle à afficher dans l'Annuaire : pour un membre d'organisation, on montre son
  // rôle d'org réel (Manager, Administrateur…) ; pour le staff plateforme
  // (Super Admin/Manager), on garde le rôle plateforme.
  const getEffectiveRoleInfo = (user: User) => {
    const isPlatformStaff = user.role === 'SUPER_ADMIN' || user.role === 'SUPER_MANAGER';
    if (!isPlatformStaff && user.organizationRole && orgRoleDisplay[user.organizationRole]) {
      return orgRoleDisplay[user.organizationRole];
    }
    return getRoleInfo(user.role);
  };

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

  const filteredUsers = users.filter((u) => {
    const matchesSearch = searchTerm === '' ||
      u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || u.role === selectedRole;
    const matchesStatus = selectedStatus === 'all' || u.status === selectedStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

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

  // Exposer les actions au parent (UsersAndOrganizations)
  useImperativeHandle(ref, () => ({
    sync: handleSyncUsers,
    syncing,
    filteredUsers,
    exportColumns,
  }));

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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  const actionButtons = (
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
        startIcon={<Sync size={18} strokeWidth={1.75} />}
        onClick={handleSyncUsers}
        disabled={syncing}
        sx={{ fontSize: '0.8125rem' }}
        title="Synchroniser"
      >
        {syncing ? 'Sync...' : 'Synchroniser'}
      </Button>
      <Button
        variant="contained"
        color="primary"
        size="small"
        startIcon={<Add size={18} strokeWidth={1.75} />}
        onClick={() => navigate('/users/new')}
        sx={{ fontSize: '0.8125rem' }}
        title="Nouvel utilisateur"
      >
        Nouvel utilisateur
      </Button>
    </Box>
  );

  const filtersBar = (
    <FilterSearchBar
      bare={Boolean(filtersContainer)}
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
  );

  return (
    <Box>
      {/* Portal des actions dans le header parent */}
      {embedded && actionsContainer && createPortal(actionButtons, actionsContainer)}

      {/* Header standalone (hors Annuaire multi-tabs) */}
      {!embedded && (
        <PageHeader
          title="Utilisateurs"
          subtitle="Comptes utilisateurs de la plateforme : rôles, permissions, activation et réinitialisation d'accès."
          iconBadge={<ManageAccounts />}
          backPath="/dashboard"
          showBackButton={false}
          actions={actionButtons}
        />
      )}

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
                  {users.filter(u => ['SUPER_ADMIN'].includes(u.role)).length}
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
                  {users.filter(u => ['TECHNICIAN', 'HOUSEKEEPER', 'LAUNDRY', 'EXTERIOR_TECH'].includes(u.role)).length}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  Personnel opérationnel
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Filtres : portales dans le PageHeader parent, sinon inline en standalone */}
      {filtersContainer
        ? createPortal(filtersBar, filtersContainer)
        : !embedded && <Box sx={{ mb: 2 }}>{filtersBar}</Box>}

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
          filteredUsers.map((user) => {
            const r = getEffectiveRoleInfo(user);
            const s = getStatusInfo(user.status);
            const roleColor = r.hex;
            const statusColor = USER_STATUS_HEX[user.status] || '#8A8378';
            const RoleIcon = r.Icon;
            return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={user.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: 'none',
                  transition: 'border-color 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
                  '&:hover': {
                    borderColor: 'rgba(107, 138, 154, 0.35)',
                    boxShadow: '0 1px 2px rgba(45, 55, 72, 0.04), 0 4px 12px rgba(45, 55, 72, 0.06)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 1.75, pb: 1.25 }}>
                  {/* En-tête avec avatar et menu */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.25, gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, minWidth: 0 }}>
                      <Avatar
                        src={userAvatarSrc(user)}
                        sx={{
                          width: 38,
                          height: 38,
                          bgcolor: `${roleColor}1F`,
                          color: roleColor,
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                          border: `1px solid ${roleColor}33`,
                        }}
                      >
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          fontWeight={600}
                          sx={{
                            fontSize: '0.9rem',
                            lineHeight: 1.25,
                            color: 'text.primary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {user.firstName} {user.lastName}
                        </Typography>
                        <Typography
                          color="text.secondary"
                          sx={{
                            fontSize: '0.7rem',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                        >
                          {user.email}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, user)}
                      sx={{ p: 0.5, ml: 0.25, color: 'text.secondary' }}
                      aria-label="Options"
                    >
                      <MoreVert size={16} strokeWidth={1.75} />
                    </IconButton>
                  </Box>

                  {/* Rôle et statut */}
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 1.25, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<RoleIcon size={11} strokeWidth={2} />}
                      label={r.label}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                        backgroundColor: `${roleColor}14`,
                        color: roleColor,
                        border: `1px solid ${roleColor}33`,
                        borderRadius: '6px',
                        px: 0.25,
                        '& .MuiChip-icon': {
                          color: `${roleColor} !important`,
                          ml: '6px',
                          mr: '-2px',
                        },
                        '& .MuiChip-label': { px: 0.875 },
                      }}
                    />
                    <Chip
                      label={s.label}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        letterSpacing: '0.01em',
                        backgroundColor: `${statusColor}14`,
                        color: statusColor,
                        border: `1px solid ${statusColor}33`,
                        borderRadius: '6px',
                        '& .MuiChip-label': { px: 0.875 },
                      }}
                    />
                  </Box>

                  {/* Informations supplémentaires */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.625 }}>
                    {user.phoneNumber && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'inline-flex', color: 'text.secondary', flexShrink: 0 }}>
                          <Phone size={13} strokeWidth={1.75} />
                        </Box>
                        <Typography
                          sx={{
                            fontSize: '0.72rem',
                            color: 'text.secondary',
                            fontVariantNumeric: 'tabular-nums',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {user.phoneNumber}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'inline-flex', color: 'text.secondary', flexShrink: 0 }}>
                        <Email size={13} strokeWidth={1.75} />
                      </Box>
                      <Typography
                        sx={{
                          fontSize: '0.72rem',
                          color: 'text.secondary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {user.email}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'inline-flex', color: 'text.secondary', flexShrink: 0 }}>
                        <Person size={13} strokeWidth={1.75} />
                      </Box>
                      <Typography
                        sx={{
                          fontSize: '0.72rem',
                          color: 'text.secondary',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        Créé le {formatDate(user.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>

                {/* Actions */}
                <CardActions sx={{ pt: 0, px: 1.75, pb: 1.5 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Visibility size={14} strokeWidth={1.75} />}
                    onClick={() => navigate(`/users/${user.id}`)}
                    fullWidth
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      letterSpacing: '0.01em',
                      borderRadius: '6px',
                      borderColor: 'divider',
                      color: 'text.primary',
                      textTransform: 'none',
                      py: 0.625,
                      '&:hover': {
                        borderColor: 'rgba(107, 138, 154, 0.5)',
                        backgroundColor: 'rgba(107, 138, 154, 0.06)',
                      },
                    }}
                  >
                    Voir détails
                  </Button>
                </CardActions>
              </Card>
            </Grid>
            );
          })
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
            <Visibility size={18} strokeWidth={1.75} />
          </ListItemIcon>
          Voir détails
        </MenuItem>
        <MenuItem onClick={handleEdit} sx={{ fontSize: '0.85rem', py: 0.75 }}>
          <ListItemIcon>
            <Edit size={18} strokeWidth={1.75} />
          </ListItemIcon>
          Modifier
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main', fontSize: '0.85rem', py: 0.75 }}>
          <ListItemIcon>
            <Box component="span" sx={{ display: 'inline-flex', color: 'error.main' }}><Delete size={18} strokeWidth={1.75} /></Box>
          </ListItemIcon>
          Supprimer
        </MenuItem>
      </Menu>

      {/* Dialog de modification */}
      <Dialog open={editDialogOpen} onClose={() => { setEditDialogOpen(false); setSelectedUser(null); }} maxWidth="sm" fullWidth>
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
                  {userRoles.map((role) => {
                    const RoleIcon = role.Icon;
                    return (
                      <MenuItem key={role.value} value={role.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ display: 'inline-flex', color: role.hex }}>
                            <RoleIcon size={16} strokeWidth={1.75} />
                          </Box>
                          <Typography variant="body2">{role.label}</Typography>
                        </Box>
                      </MenuItem>
                    );
                  })}
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
          <Button onClick={() => { setEditDialogOpen(false); setSelectedUser(null); }} size="small">Annuler</Button>
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
});

UsersList.displayName = 'UsersList';

export default UsersList;
