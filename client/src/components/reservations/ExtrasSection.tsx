import React from 'react';
import { cn } from '../../utils/cn';
import { Typography, TextField, Switch } from '@mui/material';
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
      <label className={cn('flex items-center gap-[11px] text-[13.5px] font-semibold text-[var(--ink)] w-[fit-content]', locked ? 'cursor-default' : 'cursor-pointer', locked ? 'opacity-50' : 'opacity-100')}>
        <Switch
          checked={form.createCleaning}
          onChange={(e) => form.setCreateCleaning(e.target.checked)}
          sx={SWITCH_SX}
          disabled={locked}
          disableRipple
        />
        <span className="inline-flex text-[var(--accent)]">
          <CleaningServices size={16} strokeWidth={1.75} />
        </span>
        {t('reservations.dialog.cleaningAtCheckout')}
      </label>

      {/* Frais ménage (si toggle actif) + taxe de séjour */}
      <div className={cn('grid gap-3', form.createCleaning ? 'grid-cols-[1fr_1fr]' : 'grid-cols-[1fr]')}>
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
              <p className="cn-text-body1 text-[11.5px] font-semibold whitespace-nowrap text-[var(--muted)] tabular-nums">
                = {form.touristTaxAmount.toFixed(2)} €
              </p>
            ) : undefined,
          }}
          InputLabelProps={{ shrink: true }}
          placeholder="0"
          sx={FIELD_SX}
        />
      </div>
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
