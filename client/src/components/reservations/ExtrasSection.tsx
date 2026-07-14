import React from 'react';
import { Box, Typography, TextField, Switch } from '@mui/material';
import { CleaningServices, Receipt as ReceiptIcon, Numbers as HashIcon } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { UseReservationFormResult } from './useReservationForm';
import { FIELD_SX, TEXTAREA_SX, SWITCH_SX, AdornIcon } from './reservationDialogStyles';

interface Props {
  form: UseReservationFormResult;
}

/** Ménage + taxe de séjour + code de confirmation + notes. */
const ExtrasSection: React.FC<Props> = ({ form }) => {
  const { t } = useTranslation();
  const locked = form.fieldsLocked;

  return (
    <>
      {/* Toggle ménage (.rm-toggle) */}
      <Box
        component="label"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          cursor: locked ? 'default' : 'pointer',
          fontSize: '13.5px',
          fontWeight: 600,
          color: 'var(--ink)',
          width: 'fit-content',
          opacity: locked ? 0.5 : 1,
        }}
      >
        <Switch
          checked={form.createCleaning}
          onChange={(e) => form.setCreateCleaning(e.target.checked)}
          sx={SWITCH_SX}
          disabled={locked}
          disableRipple
        />
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}>
          <CleaningServices size={16} strokeWidth={1.75} />
        </Box>
        {t('reservations.dialog.cleaningAtCheckout')}
      </Box>

      {/* Frais ménage (si toggle actif) + taxe de séjour */}
      <Box sx={{ display: 'grid', gridTemplateColumns: form.createCleaning ? '1fr 1fr' : '1fr', gap: '12px' }}>
        {form.createCleaning && (
          <TextField
            label={t('reservations.dialog.cleaningFee')}
            type="number"
            value={form.cleaningFee}
            onChange={(e) => form.setCleaningFee(e.target.value)}
            fullWidth
            disabled={locked}
            inputProps={{ min: 0, step: 0.01 }}
            InputProps={{ startAdornment: <AdornIcon><CleaningServices size={15} strokeWidth={1.75} /></AdornIcon> }}
            InputLabelProps={{ shrink: true }}
            placeholder={form.estimatedCleaningPrice ? String(form.estimatedCleaningPrice) : '0'}
            sx={FIELD_SX}
          />
        )}
        <TextField
          label={t('reservations.dialog.touristTaxPerPerson')}
          type="number"
          value={form.touristTaxPerPerson}
          onChange={(e) => form.setTouristTaxPerPerson(e.target.value)}
          fullWidth
          disabled={locked}
          inputProps={{ min: 0, step: 0.01 }}
          InputProps={{
            startAdornment: <AdornIcon><ReceiptIcon size={15} strokeWidth={1.75} /></AdornIcon>,
            endAdornment: form.touristTaxAmount > 0 ? (
              <Typography sx={{ fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                = {form.touristTaxAmount.toFixed(2)} €
              </Typography>
            ) : undefined,
          }}
          InputLabelProps={{ shrink: true }}
          placeholder="0"
          sx={FIELD_SX}
        />
      </Box>
      {form.createCleaning && form.estimatedCleaningPrice != null && form.estimatedCleaningPrice > 0 && (
        <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '-12px' }}>
          {t('reservations.dialog.estimatedCleaning', { amount: form.estimatedCleaningPrice.toFixed(2) })}
        </Typography>
      )}

      {/* Code de confirmation */}
      <TextField
        label={t('reservations.fields.confirmationCode')}
        value={form.confirmationCode}
        onChange={(e) => form.setConfirmationCode(e.target.value)}
        fullWidth
        disabled={locked}
        InputProps={{ startAdornment: <AdornIcon><HashIcon size={15} strokeWidth={1.75} /></AdornIcon> }}
        InputLabelProps={{ shrink: true }}
        sx={FIELD_SX}
      />

      {/* Notes (toujours éditable) */}
      <TextField
        label={t('reservations.fields.notes')}
        value={form.notes}
        onChange={(e) => form.setNotes(e.target.value)}
        fullWidth
        multiline
        minRows={3}
        placeholder={t('reservations.dialog.notesPlaceholder')}
        InputLabelProps={{ shrink: true }}
        sx={TEXTAREA_SX}
      />
    </>
  );
};

export default ExtrasSection;
