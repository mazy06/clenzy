import React from 'react';
import { Typography } from '@mui/material';
import { Warning as WarningIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import type { UseReservationFormResult } from './useReservationForm';

// ─── Alerte conflit (partagée wizard réservation / écran blocage) ──────────────
// Réutilise la détection de conflit du form (hasConflict / conflictWarnings).
const ConflictAlert: React.FC<{ form: UseReservationFormResult; fullWidth?: boolean }> = ({ form, fullWidth }) => {
  const { t } = useTranslation();
  if (!form.hasConflict) return null;
  return (
    <div
      className={cn(
        'bg-[var(--warn-soft)] border border-solid border-[color-mix(in_srgb,var(--warn)_30%,transparent)] rounded-[12px] px-4 py-[13px]',
        fullWidth && 'col-[1/-1] mt-0 mx-[22px] mb-5',
      )}
    >
      <div className="flex items-center gap-[9px] text-[13.5px] font-bold text-[var(--ink)]">
        <span className="inline-flex text-[var(--warn)]">
          <WarningIcon size={17} strokeWidth={1.75} />
        </span>
        {t('reservations.dialog.conflictTitle')}
      </div>
      {form.conflictWarnings.map((w, i) => (
        <Typography key={i} sx={{ fontSize: '12.5px', color: 'var(--body)', marginTop: '4px', paddingInlineStart: '26px' }}>
          {w}
        </Typography>
      ))}
    </div>
  );
};

export default ConflictAlert;
