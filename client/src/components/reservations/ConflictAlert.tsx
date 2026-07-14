import React from 'react';
import { Box, Typography } from '@mui/material';
import { Warning as WarningIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { UseReservationFormResult } from './useReservationForm';

// ─── Alerte conflit (partagée wizard réservation / écran blocage) ──────────────
// Réutilise la détection de conflit du form (hasConflict / conflictWarnings).
const ConflictAlert: React.FC<{ form: UseReservationFormResult; fullWidth?: boolean }> = ({ form, fullWidth }) => {
  const { t } = useTranslation();
  if (!form.hasConflict) return null;
  return (
    <Box
      sx={{
        ...(fullWidth ? { gridColumn: '1 / -1', margin: '0 22px 20px' } : {}),
        backgroundColor: 'var(--warn-soft)',
        border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
        borderRadius: '12px',
        padding: '13px 16px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)' }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}>
          <WarningIcon size={17} strokeWidth={1.75} />
        </Box>
        {t('reservations.dialog.conflictTitle')}
      </Box>
      {form.conflictWarnings.map((w, i) => (
        <Typography key={i} sx={{ fontSize: '12.5px', color: 'var(--body)', marginTop: '4px', paddingInlineStart: '26px' }}>
          {w}
        </Typography>
      ))}
    </Box>
  );
};

export default ConflictAlert;
