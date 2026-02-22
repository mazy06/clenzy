import React from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Button,
  Card,
  CardContent,
  Grid,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  AdminPanelSettings,
  SupervisorAccount,
  Build,
  CleaningServices,
  Home,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import type { ChipColor } from '../../types';
import type { RoleInfo, StatusInfo } from './components/userDetailsTypes';
import { useUserDetails } from './components/useUserDetails';
import UserProfileCard from './components/UserProfileCard';
import UserSystemInfoCard from './components/UserSystemInfoCard';
import UserHostProfileCard from './components/UserHostProfileCard';
import UserRoleStatusCard from './components/UserRoleStatusCard';
import UserActionsCard from './components/UserActionsCard';

const userRoles: RoleInfo[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', icon: <AdminPanelSettings />, color: 'error' },
  { value: 'SUPER_MANAGER', label: 'Super Manager', icon: <SupervisorAccount />, color: 'secondary' },
  { value: 'SUPERVISOR', label: 'Superviseur', icon: <SupervisorAccount />, color: 'info' },
  { value: 'TECHNICIAN', label: 'Technicien', icon: <Build />, color: 'primary' },
  { value: 'HOUSEKEEPER', label: 'Agent de menage', icon: <CleaningServices />, color: 'default' },
  { value: 'LAUNDRY', label: 'Blanchisserie', icon: <CleaningServices />, color: 'default' },
  { value: 'EXTERIOR_TECH', label: 'Tech. Exterieur', icon: <Build />, color: 'primary' },
  { value: 'HOST', label: 'Proprietaire', icon: <Home />, color: 'success' },
];

const userStatuses: StatusInfo[] = [
  { value: 'ACTIVE', label: 'Actif', color: 'success' },
  { value: 'INACTIVE', label: 'Inactif', color: 'default' },
  { value: 'SUSPENDED', label: 'Suspendu', color: 'error' },
  { value: 'PENDING_VERIFICATION', label: 'En attente de verification', color: 'warning' },
  { value: 'BLOCKED', label: 'Bloque', color: 'error' },
];

const UserDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    user,
    loading,
    error,
    canManageUsers,
    balance,
    balanceLoading,
    deferredToggling,
    paymentLinkLoading,
    expandedProperty,
    setExpandedProperty,
    lockoutStatus,
    unlocking,
    snackMessage,
    setSnackMessage,
    handleToggleDeferredPayment,
    handleSendPaymentLink,
    handleUnlockUser,
  } = useUserDetails(id);

  if (!canManageUsers) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info" sx={{ p: 2, py: 1 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>
            Acces non autorise
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
            Vous n'avez pas les permissions necessaires pour visualiser les details des utilisateurs.
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

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ p: 2, py: 1 }}>{error}</Alert>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" sx={{ p: 2, py: 1 }}>Utilisateur non trouve</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={() => navigate('/users')} sx={{ mr: 1.5 }} size="small">
            <ArrowBack sx={{ fontSize: 20 }} />
          </IconButton>
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.25rem' }}>
            Details de l'utilisateur
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<Edit sx={{ fontSize: 16 }} />}
          onClick={() => navigate(`/users/${user.id}/edit`)}
          sx={{ fontSize: '0.8125rem' }}
        >
          Modifier
        </Button>
      </Box>

      {/* Profile summary card */}
      <UserProfileCard user={user} roles={userRoles} statuses={userStatuses} />

      {/* Full details card */}
      <Card>
        <CardContent sx={{ p: 2 }}>
          <Grid container spacing={2}>
            {/* Personal info + contact + system dates */}
            <UserSystemInfoCard user={user} />

            {/* Host profile (conditional) */}
            <UserHostProfileCard
              user={user}
              isAdminOrManager={canManageUsers}
              deferredToggling={deferredToggling}
              onToggleDeferredPayment={handleToggleDeferredPayment}
              balance={balance}
              balanceLoading={balanceLoading}
              expandedProperty={expandedProperty}
              onExpandProperty={setExpandedProperty}
              paymentLinkLoading={paymentLinkLoading}
              onSendPaymentLink={handleSendPaymentLink}
            />

            {/* Organisation + Role & Status */}
            <UserRoleStatusCard user={user} roles={userRoles} statuses={userStatuses} />

            {/* Lockout / brute-force protection */}
            <UserActionsCard
              lockoutStatus={lockoutStatus}
              isAdminOrManager={canManageUsers}
              unlocking={unlocking}
              onUnlockUser={handleUnlockUser}
            />
          </Grid>
        </CardContent>
      </Card>

      {/* Snackbar notifications */}
      <Snackbar
        open={!!snackMessage}
        autoHideDuration={4000}
        onClose={() => setSnackMessage('')}
        message={snackMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default UserDetails;
