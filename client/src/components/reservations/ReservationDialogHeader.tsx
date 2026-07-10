import React from 'react';
import { Box, Typography } from '@mui/material';
import { Close, Home, Public as GlobeIcon, Schedule, CheckCircle } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { ReservationStatus } from '../../services/api';
import type { UseReservationFormResult } from './useReservationForm';
import { SEG_WRAP_SX, segBtnSx } from './reservationDialogStyles';

interface Props {
  form: UseReservationFormResult;
  onClose: () => void;
}

const ReservationDialogHeader: React.FC<Props> = ({ form, onClose }) => {
  const { t } = useTranslation();

  const renderStatusIcon = (s: ReservationStatus) => {
    if (form.isEdit) return null; // segmented compact (labels seuls) en édition
    if (s === 'pending') return <Schedule size={13} strokeWidth={1.75} />;
    if (s === 'confirmed') return <CheckCircle size={13} strokeWidth={1.75} />;
    return null;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        rowGap: '10px',
        gap: '12px',
        padding: '18px 22px',
        borderBottom: '1px solid var(--line)',
        flexShrink: 0,
      }}
    >
      <Typography
        component="span"
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--ink)',
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        {form.headerTitle}
      </Typography>

      {/* Pilule canal (.rm-chan) */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--accent)',
          backgroundColor: 'var(--accent-soft)',
          borderRadius: '20px',
          padding: '4px 11px',
          flexShrink: 0,
        }}
      >
        <GlobeIcon size={13} strokeWidth={2} />
        {t(`reservations.source.${form.sourceKey}`)}
      </Box>

      {/* Édition : segmented STATUT (cycle de vie). Création : le statut dérive de
          l'intention de paiement, choisie à l'étape « Finalisation » du wizard. */}
      {form.isEdit && (
        <Box sx={{ ...SEG_WRAP_SX, flexShrink: 0 }}>
          {form.statuses.map((s) => (
            <Box key={s} component="button" type="button" onClick={() => form.setStatus(s)} sx={segBtnSx(form.status === s)}>
              {renderStatusIcon(s)}
              {t(`reservations.status.${s}`)}
            </Box>
          ))}
        </Box>
      )}

      {/* Propriété (.rm-prop) — nom seul. Le sélecteur (création libre) vit à l'étape 1. */}
      <Box
        sx={{
          marginInlineStart: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          fontSize: '13px',
          fontWeight: 600,
          color: form.propertyName ? 'var(--ink)' : 'var(--faint)',
          minWidth: 0,
        }}
      >
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', flexShrink: 0 }}>
          <Home size={16} strokeWidth={1.75} />
        </Box>
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {form.propertyName || t('reservations.dialog.propertyPlaceholder')}
        </Box>
      </Box>

      {/* ✕ (.rm-x) */}
      <Box
        component="button"
        type="button"
        aria-label={t('common.cancel')}
        onClick={onClose}
        sx={{
          width: 34,
          height: 34,
          borderRadius: '10px',
          border: '1px solid var(--line-2)',
          backgroundColor: 'var(--card)',
          color: 'var(--muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          padding: 0,
          transition: 'color .14s, border-color .14s',
          '&:hover': { color: 'var(--err)', borderColor: 'var(--err)' },
          '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
        }}
      >
        <Close size={16} strokeWidth={1.75} />
      </Box>
    </Box>
  );
};

export default ReservationDialogHeader;
