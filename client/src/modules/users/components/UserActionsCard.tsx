import React from 'react';
import { cn } from '../../../utils/cn';
import { Alert, AlertDescription, AlertTitle, Button } from '../../../components/ui';
import { Lock, LockOpen } from '../../../icons';
import type { LockoutStatus } from '../../../services/api';

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
  if (!isAdminOrManager || !lockoutStatus) return null;
  if (!lockoutStatus.isLocked && lockoutStatus.failedAttempts === 0) return null;

  return (
    // Bandeau d'alerte = primitive Alert (role="alert", encre `-ink` sur fond
    // `-soft`). La variante `destructive` du kit reste sur `bg-card` : on la
    // ramene sur le couple pastel/encre pour que les deux branches soient
    // symetriques et tiennent le 4,5:1.
    <Alert
      variant={lockoutStatus.isLocked ? 'destructive' : 'warning'}
      className={cn(
        lockoutStatus.isLocked && 'border-transparent bg-destructive-soft text-destructive-ink',
      )}
    >
      <Lock size={20} strokeWidth={1.75} />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <AlertTitle className="text-xs font-semibold">
            {lockoutStatus.isLocked
              ? 'Compte temporairement bloque'
              : `${lockoutStatus.failedAttempts} tentative${lockoutStatus.failedAttempts > 1 ? 's' : ''} de connexion echouee${lockoutStatus.failedAttempts > 1 ? 's' : ''}`
            }
          </AlertTitle>
          <AlertDescription className="text-xs">
            {lockoutStatus.isLocked
              ? `Bloque pendant encore ${Math.ceil(lockoutStatus.remainingSeconds / 60)} minute${Math.ceil(lockoutStatus.remainingSeconds / 60) > 1 ? 's' : ''} (deblocage automatique)`
              : lockoutStatus.captchaRequired
                ? 'CAPTCHA requis a la prochaine connexion'
                : 'Le verrouillage se declenche apres 5 tentatives'
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
  );
};

export default UserActionsCard;
