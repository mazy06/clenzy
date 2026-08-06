import React from 'react';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import { Business, AdminPanelSettings } from '../../../icons';
import type { ChipColor } from '../../../types';
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

// Couleur semantique → ton de la primitive StatusChip, qui porte deja le couple
// Baitly UI conforme AA (encre `-ink` sur fond `-soft`).
const SEM_TONE: Partial<Record<ChipColor, StatusTone>> = {
  success: 'ok',
  warning: 'warn',
  error: 'err',
  info: 'info',
  primary: 'accent',
  secondary: 'accent',
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
  const roleInfo = getRoleInfo(user.role, roles);
  const statusInfo = getStatusInfo(user.status, statuses);
  const roleTone = SEM_TONE[roleInfo.color] ?? 'neutral';
  const statusTone = SEM_TONE[statusInfo.color] ?? 'neutral';

  return (
    <div className="flex flex-col gap-2">
      {/* Organisation — warm accent */}
      <DetailSection
        title="Organisation"
        accentColor="var(--bui-warning)"
        icon={<Business size={14} strokeWidth={1.75} />}
      >
        <DetailField
          label="Organisation rattachée"
          value={user.organizationName || undefined}
        />
      </DetailSection>

      {/* Rôle et statut — accent froid, pour ne pas répéter celui de la section au-dessus */}
      <DetailSection
        title="Rôle et statut"
        accentColor="var(--bui-info)"
        icon={<AdminPanelSettings size={14} strokeWidth={1.75} />}
      >
        {/* Role chip + description */}
        <div className="min-w-0">
          <span className="text-[0.6875rem] font-semibold tracking-[0.04em] uppercase text-muted-foreground block mb-0.5">
            Rôle
          </span>
          <StatusChip tone={roleTone} label={roleInfo.label} icon={<span className="inline-flex">
                {React.cloneElement(roleInfo.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                  size: 14,
                  strokeWidth: 1.75,
                })}
              </span>} className="mb-1" />
          <p className="m-0 text-xs text-muted-foreground leading-[1.5]">
            {ROLE_DESCRIPTIONS[user.role] || ''}
          </p>
        </div>

        {/* Status chip + description */}
        <div className="min-w-0">
          <span className="text-[0.6875rem] font-semibold tracking-[0.04em] uppercase text-muted-foreground block mb-0.5">
            Statut
          </span>
          <StatusChip tone={statusTone} label={statusInfo.label} className="mb-1" />
          <p className="m-0 text-xs text-muted-foreground leading-[1.5]">
            {STATUS_DESCRIPTIONS[user.status] || ''}
          </p>
        </div>
      </DetailSection>
    </div>
  );
};

export default UserRoleStatusCard;
