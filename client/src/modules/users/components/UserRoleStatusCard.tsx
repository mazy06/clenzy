import React from 'react';
import StatusChip, { type StatusTone } from '../../../components/StatusChip';
import type { ChipColor } from '../../../types';
import type { UserDetailsData, RoleInfo, StatusInfo } from './userDetailsTypes';
import { useTranslation } from '../../../hooks/useTranslation';
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

const UserRoleStatusCard: React.FC<UserRoleStatusCardProps> = ({ user, roles, statuses }) => {
  const { t } = useTranslation();
  const roleInfo = getRoleInfo(user.role, roles);
  const statusInfo = getStatusInfo(user.status, statuses);
  const roleTone = SEM_TONE[roleInfo.color] ?? 'neutral';
  const statusTone = SEM_TONE[statusInfo.color] ?? 'neutral';

  return (
    <>

      <DetailSection
        title={t('users.form.organization')}
      >
        <DetailField
          label={t('users.form.linkedOrganization')}
          value={user.organizationName || undefined}
        />
      </DetailSection>

      <DetailSection
        title={t('users.form.roleAndStatus')}
      >

        <div className="min-w-0">
          <span className="text-xs font-medium text-muted-foreground block mb-2">
            {t('users.role')}
          </span>
          <StatusChip tone={roleTone} label={roleInfo.label} icon={<span className="inline-flex">
                {React.cloneElement(roleInfo.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                  size: 14,
                  strokeWidth: 1.75,
                })}
              </span>} className="mb-2" />
          <p className="m-0 text-xs text-muted-foreground leading-[1.5]">
            {ROLE_DESCRIPTIONS[user.role] || ''}
          </p>
        </div>

        <div className="min-w-0">
          <span className="text-xs font-medium text-muted-foreground block mb-2">
            Statut
          </span>
          <StatusChip tone={statusTone} label={statusInfo.label} className="mb-2" />
          <p className="m-0 text-xs text-muted-foreground leading-[1.5]">
            {STATUS_DESCRIPTIONS[user.status] || ''}
          </p>
        </div>
      </DetailSection>
    </>
  );
};

export default UserRoleStatusCard;
