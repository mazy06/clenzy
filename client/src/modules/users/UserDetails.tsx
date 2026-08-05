import React, { useEffect } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import { Spinner, Button } from '../../components/ui';
import { Edit } from '../../icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useNotification } from '../../hooks/useNotification';
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

  const { notify } = useNotification();
  // Le message vit encore dans useUserDetails (hook .ts, hors perimetre de la
  // migration) : on le deverse dans le toast puis on vide l'etat, ce qui remplace
  // exactement l'ancien Snackbar neutre (auto-hide 4 s, bas centre).
  useEffect(() => {
    if (!snackMessage) return;
    notify.info(snackMessage);
    setSnackMessage('');
  }, [snackMessage, setSnackMessage, notify]);

  if (!canManageUsers) {
    return (
      <div className="p-3">
        <Alert variant="info" className="p-3 py-1.5">
          <Info />
          {/* `m-0` reprend ce que portait `cn-text-*` : sans preflight Tailwind,
              un <h6>/<p> natif recupere sinon les marges du navigateur. */}
          <AlertDescription><h6 className="m-0 mb-1.5 text-sm font-medium">
            Acces non autorise
          </h6><p className="m-0 text-sm">
            Vous n'avez pas les permissions necessaires pour visualiser les details des utilisateurs.
            <br />
            Contactez votre administrateur si vous pensez qu'il s'agit d'une erreur.
          </p></AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3">
        <Alert variant="destructive" className="p-3 py-1.5">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-3">
        <Alert variant="warning" className="p-3 py-1.5">
          <TriangleAlert />
          <AlertDescription>Utilisateur non trouve</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-3">
      <PageHeader
        title="Détails de l'utilisateur"
        subtitle={`${user.firstName} ${user.lastName}`}
        backPath="/users"
        showBackButton={true}
        actions={
          <Button
            size="sm"
            onClick={() => navigate(`/users/${user.id}/edit`)}
          >
            <Edit size={16} strokeWidth={1.75} />
            Modifier
          </Button>
        }
      />

      {/* Hero card */}
      <UserProfileCard user={user} roles={userRoles} statuses={userStatuses} />

      {/* Body — two-column on >=md to avoid a single tall column of identical cards */}
      {/* md MUI = 900px (breakpoints non configures) et gap: 1.5 = 9px (spacing 6). */}
      <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-[9px] items-start">
        <div className="flex flex-col gap-2 min-w-0">
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
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          {/* Organisation + Role & Status */}
          <UserRoleStatusCard user={user} roles={userRoles} statuses={userStatuses} />

          {/* Lockout — self-contained, returns null when no lockout info. */}
          <UserActionsCard
            lockoutStatus={lockoutStatus}
            isAdminOrManager={canManageUsers}
            unlocking={unlocking}
            onUnlockUser={handleUnlockUser}
          />
        </div>
      </div>
    </div>
  );
};

export default UserDetails;
