import React from 'react';
import { Box, Chip, Typography, alpha, useTheme } from '@mui/material';
import { Business, AdminPanelSettings } from '../../../icons';
import { semanticToHex } from '../../../utils/statusUtils';
import type { UserDetailsData, RoleInfo, StatusInfo } from './userDetailsTypes';
import { getRoleInfo, getStatusInfo } from './userDetailsTypes';
import DetailField from './DetailField';
import DetailSection from './DetailSection';

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

/**
 * Renders two sections: Organisation, and Role+Status with descriptions.
 * Uses warm + secondary accent colors to keep the page rhythm varied
 * (no two consecutive sections share an accent).
 */
const UserRoleStatusCard: React.FC<UserRoleStatusCardProps> = ({ user, roles, statuses }) => {
  const theme = useTheme();
  const roleInfo = getRoleInfo(user.role, roles);
  const statusInfo = getStatusInfo(user.status, statuses);
  const roleHex = semanticToHex(roleInfo.color);
  const statusHex = semanticToHex(statusInfo.color);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Organisation — warm accent */}
      <DetailSection
        title="Organisation"
        accentColor="#D4A574"
        icon={<Business size={14} strokeWidth={1.75} />}
      >
        <DetailField
          label="Organisation rattachée"
          value={user.organizationName || undefined}
        />
      </DetailSection>

      {/* Rôle et statut — secondary purple accent */}
      <DetailSection
        title="Rôle et statut"
        accentColor="#7B68A8"
        icon={<AdminPanelSettings size={14} strokeWidth={1.75} />}
      >
        {/* Role chip + description */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              display: 'block',
              mb: 0.5,
            }}
          >
            Rôle
          </Typography>
          <Chip
            icon={
              <Box component="span" sx={{ display: 'inline-flex' }}>
                {React.cloneElement(roleInfo.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                  size: 14,
                  strokeWidth: 1.75,
                })}
              </Box>
            }
            label={roleInfo.label}
            size="small"
            sx={{ backgroundColor: `${roleHex}18`, color: roleHex, '& .MuiChip-icon': { color: roleHex }, mb: 0.75 }}
          />
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5 }}>
            {ROLE_DESCRIPTIONS[user.role] || ''}
          </Typography>
        </Box>

        {/* Status chip + description */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              display: 'block',
              mb: 0.5,
            }}
          >
            Statut
          </Typography>
          <Chip
            label={statusInfo.label}
            size="small"
            sx={{ backgroundColor: `${statusHex}18`, color: statusHex, mb: 0.75 }}
          />
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.5 }}>
            {STATUS_DESCRIPTIONS[user.status] || ''}
          </Typography>
        </Box>
      </DetailSection>
    </Box>
  );
};

export default UserRoleStatusCard;
