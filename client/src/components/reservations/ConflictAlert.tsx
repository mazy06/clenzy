import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '../ui';
import { Warning as WarningIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import type { UseReservationFormResult } from './useReservationForm';

// ─── Alerte conflit (partagée wizard réservation / écran blocage) ──────────────
// Réutilise la détection de conflit du form (hasConflict / conflictWarnings).
// Rendue par la primitive `Alert` du kit (variante `warning`) : le couple
// fond pastel / encre `-ink` y est déjà conforme AA, contrairement au bandeau
// dessiné à la main qu'elle remplace.
const ConflictAlert: React.FC<{ form: UseReservationFormResult; fullWidth?: boolean }> = ({ form, fullWidth }) => {
  const { t } = useTranslation();
  if (!form.hasConflict) return null;
  return (
    <Alert
      variant="warning"
      className={cn('rounded-[12px] px-4 py-[13px]', fullWidth && 'col-[1/-1] mt-0 mx-[22px] mb-5')}
    >
      <WarningIcon strokeWidth={1.75} />
      <AlertTitle className="text-[13.5px] font-bold">{t('reservations.dialog.conflictTitle')}</AlertTitle>
      {/* `<span>` et non `<p>` : la description du kit espace ses paragraphes de
          16 px, bien plus que l'interligne voulu ici. */}
      {form.conflictWarnings.length > 0 && (
        <AlertDescription className="flex flex-col gap-1 text-[12.5px]">
          {form.conflictWarnings.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </AlertDescription>
      )}
    </Alert>
  );
};

export default ConflictAlert;
