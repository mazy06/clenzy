import React from 'react';
import { Typography, Grid, Chip } from '@mui/material';
import type { UserDetailsData, RoleInfo, StatusInfo } from './userDetailsTypes';
import { getRoleInfo, getStatusInfo } from './userDetailsTypes';

interface UserRoleStatusCardProps {
  user: UserDetailsData;
  roles: RoleInfo[];
  statuses: StatusInfo[];
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur avec acces complet multi-organisations',
  SUPER_MANAGER: 'Super manager avec gestion etendue multi-equipes',
  SUPERVISOR: 'Supervision des interventions et du personnel',
  TECHNICIAN: 'Execution des interventions techniques',
  HOUSEKEEPER: 'Execution des interventions de nettoyage',
  HOST: 'Gestion de ses propres proprietes',
  LAUNDRY: 'Gestion du linge et de la blanchisserie',
  EXTERIOR_TECH: 'Entretien des espaces exterieurs',
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  ACTIVE: "L'utilisateur peut se connecter et utiliser la plateforme",
  INACTIVE: "L'utilisateur ne peut pas se connecter temporairement",
  SUSPENDED: "L'utilisateur est suspendu et ne peut pas se connecter",
  PENDING_VERIFICATION: "L'utilisateur doit verifier son compte",
  BLOCKED: "L'utilisateur est bloque pour violation des conditions",
};

const UserRoleStatusCard: React.FC<UserRoleStatusCardProps> = ({ user, roles, statuses }) => {
  const roleInfo = getRoleInfo(user.role, roles);
  const statusInfo = getStatusInfo(user.status, statuses);

  return (
    <>
      {/* Organisation */}
      <Grid item xs={12}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, color: 'primary.main', fontWeight: 600 }}>
          Organisation
        </Typography>
      </Grid>
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" color="text.secondary">Organisation rattachee</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {user.organizationName || 'Aucune organisation'}
        </Typography>
      </Grid>

      {/* Role et statut */}
      <Grid item xs={12}>
        <Typography variant="h6" sx={{ mb: 3, color: 'primary.main' }}>
          Role et statut
        </Typography>
      </Grid>
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" color="text.secondary">Role</Typography>
        <Chip
          icon={roleInfo.icon}
          label={roleInfo.label}
          color={roleInfo.color}
          sx={{ mb: 2 }}
        />
        <Typography variant="body2" color="text.secondary">
          {ROLE_DESCRIPTIONS[user.role] || ''}
        </Typography>
      </Grid>
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" color="text.secondary">Statut</Typography>
        <Chip
          label={statusInfo.label}
          color={statusInfo.color}
          sx={{ mb: 2 }}
        />
        <Typography variant="body2" color="text.secondary">
          {STATUS_DESCRIPTIONS[user.status] || ''}
        </Typography>
      </Grid>
    </>
  );
};

export default UserRoleStatusCard;
