import React from 'react';
import { Alert, AlertDescription, AlertTitle, Button } from '../../../components/ui';
import { Lock, LockOpen } from '../../../icons';
import type { LockoutStatus } from '../../../services/api';
import { useTranslation } from '../../../hooks/useTranslation';
import DetailSection from './DetailSection';

interface UserActionsCardProps {
  lockoutStatus: LockoutStatus | null;
  isAdminOrManager: boolean;
  unlocking: boolean;
  onUnlockUser: () => void;
}

const UserActionsCard: React.FC<UserActionsCardProps> = ({
  lockoutStatus,
  isAdminOrManager,
  unlocking,
  onUnlockUser,
}) => {
  const { t } = useTranslation();
  if (!isAdminOrManager || !lockoutStatus) return null;
  if (!lockoutStatus.isLocked && lockoutStatus.failedAttempts === 0) return null;

  return (
    <DetailSection title={t('users.form.security')} disableGrid>
      <Alert
        variant={lockoutStatus.isLocked ? 'destructive' : 'warning'}
        className="rounded-none border-0 bg-transparent p-0 shadow-none"
      >
        <Lock size={20} strokeWidth={1.75} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <AlertTitle className="text-xs font-semibold">
              {lockoutStatus.isLocked
                ? 'Compte temporairement bloque'
                : `${lockoutStatus.failedAttempts} tentative${lockoutStatus.failedAttempts > 1 ? 's' : ''} de connexion echouee${lockoutStatus.failedAttempts > 1 ? 's' : ''}`
              }
            </AlertTitle>
            <AlertDescription className="text-xs">
              {lockoutStatus.isLocked
                ? t('users.lockedForMinutes', { count: Math.ceil(lockoutStatus.remainingSeconds / 60) })
                : lockoutStatus.captchaRequired
                  ? t('users.captchaRequired')
                  : t('users.lockAfterFive')
              }
            </AlertDescription>
          </div>
          {/* Debloquer n'est pas destructif (c'est le remede) : outline neutre, la
              teinte du bandeau porte deja la gravite. */}
          <Button
            variant="outline"
            size="sm"
            onClick={onUnlockUser}
            disabled={unlocking}
            className="shrink-0 whitespace-nowrap"
          >
            <LockOpen size={16} strokeWidth={1.75} />
            {unlocking ? 'Deblocage...' : 'Debloquer'}
          </Button>
        </div>
      </Alert>
    </DetailSection>
  );
};

export default UserActionsCard;
