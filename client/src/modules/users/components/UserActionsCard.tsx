import React from 'react';
import { cn } from '../../../utils/cn';
import { Button } from '../../../components/ui';
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
    <div className={cn('border border-solid rounded-[12px] p-3', lockoutStatus.isLocked ? 'border-[var(--err)]' : 'border-[var(--warn)]', lockoutStatus.isLocked ? 'bg-[var(--err-soft)]' : 'bg-[var(--warn-soft)]')}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <span className={cn('inline-flex', lockoutStatus.isLocked ? 'text-[var(--err)]' : 'text-[var(--warn)]')}><Lock size={20} strokeWidth={1.75} /></span>
            <div>
              <p className="cn-text-body2 font-semibold">
                {lockoutStatus.isLocked
                  ? 'Compte temporairement bloque'
                  : `${lockoutStatus.failedAttempts} tentative${lockoutStatus.failedAttempts > 1 ? 's' : ''} de connexion echouee${lockoutStatus.failedAttempts > 1 ? 's' : ''}`
                }
              </p>
              <span className="cn-text-caption text-muted-foreground">
                {lockoutStatus.isLocked
                  ? `Bloque pendant encore ${Math.ceil(lockoutStatus.remainingSeconds / 60)} minute${Math.ceil(lockoutStatus.remainingSeconds / 60) > 1 ? 's' : ''} (deblocage automatique)`
                  : lockoutStatus.captchaRequired
                    ? 'CAPTCHA requis a la prochaine connexion'
                    : 'Le verrouillage se declenche apres 5 tentatives'
                }
              </span>
            </div>
          </div>
          {/* Debloquer n'est pas destructif (c'est le remede) : outline teinte comme la carte,
              err si le compte est bloque, warn s'il n'y a que des tentatives echouees.
              Branches litterales — une classe Tailwind ne peut pas naitre d'une variable. */}
          <Button
            variant="outline"
            size="sm"
            onClick={onUnlockUser}
            disabled={unlocking}
            className={cn(
              'whitespace-nowrap',
              lockoutStatus.isLocked
                ? 'text-[var(--err)] border-[var(--err)] hover:bg-[var(--err-soft)]'
                : 'text-[var(--warn)] border-[var(--warn)] hover:bg-[var(--warn-soft)]',
            )}
          >
            <LockOpen size={16} strokeWidth={1.75} />
            {unlocking ? 'Deblocage...' : 'Debloquer'}
          </Button>
        </div>
    </div>
  );
};

export default UserActionsCard;
