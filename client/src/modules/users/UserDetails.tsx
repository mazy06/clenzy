import React from 'react';
import {
  Box,
  CircularProgress,
  Alert,
  Button,
  Typography,
  Snackbar,
} from '@mui/material';
import { Edit } from '../../icons';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import type { RoleInfo, StatusInfo } from './components/userDetailsTypes';
import { useUserDetails } from './components/useUserDetails';
import UserProfileCard from './components/UserProfileCard';
import UserSystemInfoCard from './components/UserSystemInfoCard';
import UserHostProfileCard from './components/UserHostProfileCard';
import UserRoleStatusCard from './components/UserRoleStatusCard';
import UserActionsCard from './components/UserActionsCard';
import { USER_ROLES } from './components/userRoleCatalog';

// Adapt the shared catalog to the legacy RoleInfo shape consumed by the detail cards.
const userRoles: RoleInfo[] = USER_ROLES.map((r) => ({
  value: r.value,
  label: r.label,
  icon: r.icon,
  color: r.color,
}));

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
      <PageHeader
        title="Détails de l'utilisateur"
        subtitle={`${user.firstName} ${user.lastName}`}
        backPath="/users"
        showBackButton={true}
        actions={
          <Button
            variant="contained"
            size="small"
            startIcon={<Edit size={16} strokeWidth={1.75} />}
            onClick={() => navigate(`/users/${user.id}/edit`)}
            sx={{ fontSize: '0.8125rem', textTransform: 'none', fontWeight: 600 }}
          >
            Modifier
          </Button>
        }
      />

      {/* Hero card */}
      <UserProfileCard user={user} roles={userRoles} statuses={userStatuses} />

      {/* Body — two-column on >=md to avoid a single tall column of identical cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 7fr) minmax(0, 5fr)' },
          gap: 1.5,
          alignItems: 'start',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          {/* Personal + Contact + System dates */}
          <UserSystemInfoCard user={user} />

          {/* Host profile — self-contained, returns null when user is not a HOST. */}
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
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
          {/* Organisation + Role & Status */}
          <UserRoleStatusCard user={user} roles={userRoles} statuses={userStatuses} />

          {/* Lockout — self-contained, returns null when no lockout info. */}
          <UserActionsCard
            lockoutStatus={lockoutStatus}
            isAdminOrManager={canManageUsers}
            unlocking={unlocking}
            onUnlockUser={handleUnlockUser}
          />
        </Box>
      </Box>

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
